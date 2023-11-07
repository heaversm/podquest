import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

//required for upgrade to es modules
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import crypto from 'crypto';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { Configuration, OpenAIApi } from 'openai';
import {
  CharacterTextSplitter,
  RecursiveCharacterTextSplitter,
} from 'langchain/text_splitter';
import { Document } from 'langchain/document';
import { FaissStore } from 'langchain/vectorstores/faiss';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import {
  RetrievalQAChain,
  loadSummarizationChain,
} from 'langchain/chains';

import { mkdir, writeFile } from 'fs/promises';
import { Readable } from 'stream';
import { finished } from 'stream/promises';

import ffmpeg from 'fluent-ffmpeg';
import getMP3Duration from 'get-mp3-duration';
import util from 'util';

import connectDB from './db.js';
import { nanoid } from 'nanoid';
import PodcastEpisode from './models/PodcastEpisode.js';
import PodcastQueries from './models/PodcastQueries.js';
import PodcastUsers from './models/PodcastUsers.js';

const statAsync = util.promisify(fs.stat); //get file sizes asynchronously to determine if above API limits

//CONFIGURATION
const LOAD_TRANSCRIPT_FROM_FILE = false; //MH TODO: currently loads text, but llm doesn't like this unless it has been formally called by langchain createTranscription
const LOAD_AUDIO_FROM_FILE = false;
const MAX_EPISODES = 5;

const BE_CONCISE = false; //be concise in your response
const USE_ONLY_CONTEXT = false;
const FORCE_SRT = true; //allows us to avoid refreshing the page and re-transcribe when true, but means other modes must navigate timestamps

const MAX_FILE_SIZE = 20; //in MB. If a podcast is over this size, split it up
const MAX_DURATION = 300; //in seconds, if splitting by duration instead of size
const MAX_CHUNKS = 10; //if episode exceeds this, it's probably too slow given the current transcription process

//END CONFIGURATION

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0.8, //higher = more creative
});
const openai = new OpenAIApi(configuration);

const llm = new OpenAI(); //the llm model to use (currently only openai)
let chain; //will hold the llm and retriever
let summarizer; //will hold the summarization chain
let transcription; //will hold the transcription from openai
let transcripts = []; //will hold the transcripts from openai if the audio is split into chunks
let llmStatus = 'not ready'; //will hold the status of the llm

//llm
import { OpenAI } from 'langchain/llms/openai';

const PORT = process.env.PORT || 3001;

const app = express();

connectDB();

app.use(express.json());

// Have Node serve the files for our built React app
app.use(express.static(path.resolve(__dirname, '../client/build')));

// Handle GET requests to /api route
app.get('/api/testOpenAIConfig', async (req, res) => {
  res.json({ message: 'Connected to Server' });
});

app.post('/api/searchForPodcast', async (req, res) => {
  // console.log(req.body);
  const { podcastName } = req.body;
  const apiKey = process.env.PODCAST_INDEX_API_KEY;
  const apiSecret = process.env.PODCAST_INDEX_API_SECRET;
  const apiHeaderTime = Math.floor(Date.now() / 1000);
  const sha1Algorithm = 'sha1';
  const sha1Hash = crypto.createHash(sha1Algorithm);
  const data4Hash = apiKey + apiSecret + apiHeaderTime;
  sha1Hash.update(data4Hash);
  const hash4Header = sha1Hash.digest('hex');
  // console.log(`hash4Header=[${hash4Header}]`);

  const options = {
    method: 'get',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Date': '' + apiHeaderTime,
      'X-Auth-Key': apiKey,
      Authorization: hash4Header,
      'User-Agent': 'Podquest/1.0',
    },
  };

  const url =
    'https://api.podcastindex.org/api/1.0/search/byterm?q=' +
    podcastName +
    '&max=10';
  //TODO: handle non results, timeout.
  //TODO: replace with fetch
  await axios.get(url, options).then((response) => {
    if (response.data?.feeds?.length > 0) {
      const feeds = response.data.feeds;
      const podcasts = [];
      feeds.forEach((feed) => {
        podcasts.push({
          title: feed.title,
          url: feed.url,
        });
      });
      // console.log(podcasts);
      res.json({ podcasts });
    } else {
      console.log('no podcasts found');
      return res.status(400).json({ error: 'No podcasts found' });
    }
  });
});

app.post('/api/searchForEpisodes', async (req, res) => {
  // console.log(req.body);
  const { podcastUrl } = req.body;
  const apiKey = process.env.PODCAST_INDEX_API_KEY;
  const apiSecret = process.env.PODCAST_INDEX_API_SECRET;
  const apiHeaderTime = Math.floor(Date.now() / 1000);
  const sha1Algorithm = 'sha1';
  const sha1Hash = crypto.createHash(sha1Algorithm);
  const data4Hash = apiKey + apiSecret + apiHeaderTime;
  sha1Hash.update(data4Hash);
  const hash4Header = sha1Hash.digest('hex');
  // console.log(`hash4Header=[${hash4Header}]`);

  const options = {
    method: 'get',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Date': '' + apiHeaderTime,
      'X-Auth-Key': apiKey,
      Authorization: hash4Header,
      'User-Agent': 'Podquest/1.0',
    },
  };

  const url = `https://api.podcastindex.org/api/1.0/episodes/byfeedurl?max=${MAX_EPISODES}&url=${podcastUrl}`;
  await axios.get(url, options).then((response) => {
    // console.log(response.data);
    if (response.data?.items?.length > 0) {
      const items = response.data.items;
      const mp3s = items.map((item) => {
        return {
          title: item.title,
          url: item.enclosureUrl,
        };
      });
      // console.log(mp3s);
      return res.status(200).json({
        mp3s: mp3s,
      });
    } else {
      return res
        .status(400)
        .json({ error: 'No episodes found for this podcast' });
    }
  });
});

const getAudioFromURL = async (url) => {
  return new Promise(async (resolve, reject) => {
    try {
      const response = await fetch(url);
      // console.log("status", response.statusCode);

      if (response.status === 200) {
        if (!fs.existsSync('downloads')) await mkdir('downloads'); //Optional if you already have downloads directory
        const fileID = uuidv4();
        const fileName = `${fileID}.mp3`;
        const destination = path.resolve('./downloads', fileName);
        const fileStream = fs.createWriteStream(destination, {
          flags: 'wx',
        });
        await finished(
          Readable.fromWeb(response.body).pipe(fileStream)
        );
        // console.log(destination);
        return resolve(destination);
      } else {
        //reject with the error message
        return reject('Error retrieving MP3 file');
      }
    } catch (error) {
      console.error('error retrieving mp3 file', error);
    }
  }).catch((error) => {
    console.error('Unhandled rejection:', error);
  });
};

app.get('/playAudio', (req, res) => {
  const filePath = req.body;

  // Check if the file exists
  fs.access(filePath, fs.constants.R_OK, (err) => {
    if (err) {
      console.error('Error accessing the audio file:', err);
      return res.status(404).send('Audio file not found');
    }

    // Set appropriate headers for streaming the audio
    res.set({
      'Content-Type': 'audio/mpeg', // Adjust the content type based on your audio file format
      'Content-Length': fs.statSync(filePath).size,
    });

    // Create a read stream to read the audio file
    const audioStream = fs.createReadStream(filePath);

    // Pipe the audio stream to the response stream
    audioStream.pipe(res);
  });
});

app.post('/api/performUserQuery', async (req, res) => {
  const { query, mode, episodeId, userId } = req.body;
  console.log(
    'query,mode,question,episodeId',
    query,
    mode,
    episodeId,
    userId
  );
  let chainResponse;

  if (mode === 'audio') {
    let finalQuery = `The question is: ${query}. Respond with the timestamp from the podcast where the answer to the question can be found. The format should only be a valid timestamp of the format hh:mm:ss. If the answer to the question cannot be found in the podcast, respond with "Answer not found".`;
    chainResponse = await chain.call({
      query: finalQuery,
    });
    return res.status(200).json({ text: chainResponse.text });
  } else {
    chainResponse = await chain.call({
      query: query,
    });

    const queryResponse = chainResponse.text;

    //MH TODO: check if query exists for this podcast and return the cached result? Or generate new each time?
    const podcastQuery = new PodcastQueries({
      userRef: userId ? userId : '',
      episodeRef: episodeId,
      query: query,
      queryResponse: queryResponse,
    });

    await podcastQuery.save();
    return res.status(200).json({ text: queryResponse });
  }
});

function removeQueryParams(origURL) {
  const url = new URL(origURL);
  console.log('rqp', url);
  const nonParamURL = url.origin + url.pathname;
  return nonParamURL;
}

async function splitAudioIntoChunks(filePath) {
  return new Promise((resolve, reject) => {
    console.log('splitting into chunks');
    const buffer = fs.readFileSync(filePath);
    const duration = getMP3Duration(buffer);

    const inputDurationSeconds = duration / 1000;
    const chunkDurationSeconds = MAX_DURATION;
    const numChunks = Math.min(
      Math.ceil(inputDurationSeconds / chunkDurationSeconds),
      MAX_CHUNKS
    );
    const promises = [];
    const outputPaths = [];
    const chunkDurations = [];

    async function exportChunksSequentially() {
      for (let chunkIndex = 0; chunkIndex < numChunks; chunkIndex++) {
        const startTime = chunkIndex * chunkDurationSeconds;
        const endTime = Math.min(
          (chunkIndex + 1) * chunkDurationSeconds,
          inputDurationSeconds
        );

        await new Promise((resolveChunk, rejectChunk) => {
          let tempPath = filePath.replace('.mp3', '');
          const outputPath = `${tempPath}_${chunkIndex}.mp3`;
          outputPaths.push(outputPath);
          ffmpeg(filePath)
            .setStartTime(startTime)
            .setDuration(endTime - startTime)
            .output(outputPath)
            .on('end', () => {
              llmStatus = `exported chunk ${chunkIndex} of ${numChunks}`;
              console.log(
                `Chunk ${chunkIndex} exported successfully`
              );
              resolveChunk();
            })
            .on('error', (err) => {
              console.error(
                `Error exporting chunk ${chunkIndex}:`,
                err.message
              );
              rejectChunk(err);
            })
            .run();
        });
      } //end for
    } //end exportChunksSequentially
    exportChunksSequentially()
      .then(() => {
        console.log('All chunks exported successfully');
        resolve(outputPaths);
      })
      .catch((err) => {
        console.error('Error exporting chunks:', err.message);
        reject(err);
      });
  });
} //end splitAudioIntoChunks

async function transcribeAudioChunks(outputPaths, mode) {
  transcripts = [];
  return new Promise((resolve, reject) => {
    async function transcribeAudioChunkSequentially() {
      for (let i = 0; i < outputPaths.length; i++) {
        const filePath = outputPaths[i];
        const transcriptionFormat = 'srt';
        await new Promise(async (resolve, reject) => {
          openai
            .createTranscription(
              fs.createReadStream(filePath),
              'whisper-1',
              '', //prompt, unused
              transcriptionFormat
            )
            .then((response) => {
              console.log(`whisper transcribed ${filePath}`);

              llmStatus = `transcribed audio file ${i + 1} of ${
                outputPaths.length
              }`;
              transcripts.push(response.data);
              resolve();
            })
            .catch((err) => {
              console.log('transcription error!', err);
              reject(err);
            });
        });
      }
    }

    transcribeAudioChunkSequentially()
      .then(() => {
        console.log('All chunks exported successfully');
        resolve(transcripts);
      })
      .catch((err) => {
        console.error('Error exporting chunks:', err.message);
        reject(err);
      });
  });
}

const establishLLM = async function (transcript, mode) {
  // console.log("establishing llm");
  const llm = new OpenAI();
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 256,
    chunkOverlap: 0,
  });

  const output = await splitter.splitDocuments([
    new Document({ pageContent: transcript }),
  ]);
  // console.log("output", output);
  const vectorStore = await FaissStore.fromDocuments(
    output,
    new OpenAIEmbeddings()
  );

  const retriever = vectorStore.asRetriever();
  chain = RetrievalQAChain.fromLLM(llm, retriever);
  return output;
};

const removeFile = async (filePath) => {
  if (!LOAD_AUDIO_FROM_FILE) {
    fs.unlink(filePath, (err) => {
      if (err) {
        console.log(filePath);
        console.error('error removing file');
        return { status: 'error', error: err };
      } else {
        return { status: 'success' };
      }
    });
  } else {
    return { status: 'success' };
  }
};

function adjustTranscript(originalTranscript) {
  const modifiedTranscript = originalTranscript.replace(
    /^\s*$/gm,
    ''
  );

  // console.log(modifiedTranscript);

  const newTranscript = modifiedTranscript.trim().split('\n\n');
  //console.log(newTranscript);

  const newTranscriptEntries = [];

  newTranscript.map((entry) => {
    const lines = entry.split('\n');
    newTranscriptEntries.push(lines);
  });

  let lineCounter = 1;
  let adjustModeIndex;
  let finalTranscript = [];

  function timeToMillis(time) {
    const [hours, minutes, seconds, milliseconds] =
      time.split(/[:,.]/);
    return (
      parseInt(hours) * 3600000 +
      parseInt(minutes) * 60000 +
      parseInt(seconds) * 1000 +
      parseInt(milliseconds)
    );
  }

  function millisToTime(millis) {
    const date = new Date(millis);
    return date.toISOString().substr(11, 12).replace('.', ',');
  }

  newTranscriptEntries.forEach((entry, index) => {
    const entryIndex = parseInt(entry[0]);
    if (index === 0) {
      // console.log(entry);
      finalTranscript.push(entry);
    }
    if (index !== 0) {
      const prevIndex = parseInt(newTranscriptEntries[index - 1][0]);
      // console.log(prevIndex, entryIndex);
      if (entryIndex - prevIndex !== 1 && !adjustModeIndex) {
        // console.log("adjusts mode",index);
        adjustModeIndex = index;
      }

      if (adjustModeIndex) {
        const prevEntry = newTranscriptEntries[index - 1]; //
        // console.log(prevEntry);

        const prevLine = parseInt(prevEntry[0]);
        entry[0] = `${prevLine + 1}`;

        const prevTime = prevEntry[1];
        const prevTimestamps = prevTime.split(' --> ');
        const prevEndTime = prevTimestamps[1];
        // console.log(prevEndTime);
        const curTime = newTranscriptEntries[index][1];
        const curTimestamps = curTime.split(' --> ');
        // console.log(curTimestamps);

        const offsetMillis = timeToMillis(prevEndTime);
        const startMillis = timeToMillis(curTimestamps[0]);
        const endMillis = timeToMillis(curTimestamps[1]);
        const diffMillis = endMillis - startMillis;
        // console.log(offsetMillis, startMillis, endMillis);

        const adjustedStart = offsetMillis;
        const adjustedEnd = adjustedStart + diffMillis;
        // console.log(adjustedStart, adjustedEnd);
        const adjustedTimeStart = millisToTime(adjustedStart);
        const adjustedTimeEnd = millisToTime(adjustedEnd);
        // console.log(adjustedTimeStart, adjustedTimeEnd);
        const joinedTimestampString = [
          adjustedTimeStart,
          adjustedTimeEnd,
        ].join(' --> ');
        // console.log(joinedTimestampString);
        entry[1] = joinedTimestampString;
        // console.log(entry);
        finalTranscript.push(entry);
      } else {
        finalTranscript.push(entry);
      }
    }
  });

  const formattedTranscript = finalTranscript
    .map((array) => array.join('\n'))
    .join('\n\n');
  // console.log(formattedTranscript);
  return formattedTranscript;
}

app.get('/api/getUserId', async (req, res) => {
  // console.log("return transcript", transcription);
  const id = nanoid();
  //TODO: save user to db
  const userEntry = new PodcastUsers({
    userId: id,
  });
  await userEntry.save();
  res.json({ id: id });
});

app.get('/api/downloadTranscript', async (req, res) => {
  // console.log("return transcript", transcription);
  res.json({ transcription: transcription });
});

app.get('/api/getStatus', async (req, res) => {
  if (llmStatus === 'ready') {
    return res.status(200).json({ status: llmStatus });
  } else {
    return res.status(202).json({ status: llmStatus });
  }
});

const transcribeAudio = async (filePath, mode) => {
  let transcript;
  if (LOAD_TRANSCRIPT_FROM_FILE) {
    transcript = fs.readFileSync(
      path.join(__dirname, '../', 'transcript_w_timestamps.txt'),
      'utf8'
    );
    // console.log(transcript, "transcription");
    return transcript;
    // return JSON.stringify(transcript);
  } else {
    // const transcriptionFormat = mode === "audio" ? "srt" : "text";
    let transcriptionFormat;
    if (FORCE_SRT) {
      transcriptionFormat = 'srt';
    } else {
      transcriptionFormat = mode === 'audio' ? 'srt' : 'text';
    }

    // console.log("filePath", filePath, transcriptionFormat);
    transcript = await openai
      .createTranscription(
        fs.createReadStream(filePath),
        'whisper-1',
        '', //prompt, unused
        transcriptionFormat
      )
      .then((response) => {
        // console.log(response.data);
        return response.data;
      })
      .catch((err) => {
        console.log('transcription error!', err);
        return 'maxlength';
      });
    return transcript;
  }
};

const initiateLLM = async (transcription, mode) => {
  console.log('establishing llm');
  llmStatus = 'establishing llm';
  const output = await establishLLM(transcription, mode);
  console.log('all done');
  llmStatus = 'ready';
  return 'ready';
};

async function transcribeEpisode(episodeUrl, mode, episodeTitle) {
  let filePath;
  llmStatus = 'downloading audio';
  if (LOAD_AUDIO_FROM_FILE) {
    filePath = path.join(__dirname, '../audio.mp3');
  } else {
    try {
      filePath = await getAudioFromURL(episodeUrl);
    } catch (error) {
      console.log('error getting audio file', error);
      // return res.status(500).json({ error: error });
    }
  }

  const generateTranscriptions = async () => {
    llmStatus = 'getting file size';
    const stats = await statAsync(filePath);

    const fileSizeInMB = stats.size / 1024 / 1024;
    console.log('fs in MB', fileSizeInMB, 'max', MAX_FILE_SIZE);
    //TODO:MH - there are still instances where being under MAX_FILE_SIZE results in a BODY LENGTH EXCEEDED ERROR from Whisper

    if (fileSizeInMB > MAX_FILE_SIZE) {
      console.log('file size too large, splitting audio');
      llmStatus = 'splitting audio';
      try {
        const outputPaths = await splitAudioIntoChunks(filePath);

        llmStatus = 'transcribing chunks';
        console.log('transcribing chunks');

        await transcribeAudioChunks(outputPaths, mode).then(
          (chunkedTranscripts) => {
            transcription = chunkedTranscripts.join(''); // Combine all chunk transcripts

            //TODO: need to adjust transcript timestamps to account for chunking
            llmStatus = 'reassembling audio';
            const adjustedTranscript =
              adjustTranscript(transcription);
            transcription = adjustedTranscript;
            // console.log('final transcription', transcription);
            llmStatus = 'audio transcribed';
            //remove chunked audio
            outputPaths.forEach((outputPath) => {
              removeFile(outputPath);
            });
            //remove original audio
            removeFile(filePath);
          }
        );
      } catch (error) {
        console.log('error splitting audio', error);
      }
    } else {
      console.log('file size ok');
      try {
        console.log('transcribing audio');
        llmStatus = 'transcribing audio';
        transcription = await transcribeAudio(filePath, mode);
        // console.log('transcription',transcription);
      } catch (error) {
        console.log('error transcribing audio', error);
        return error;
      }
    }

    const episodeId = nanoid();
    const episodeEntry = new PodcastEpisode({
      episodeId: episodeId,
      episodeUrl: episodeUrl,
      episodeTitle: episodeTitle,
      episodeTranscript: transcription,
    });

    await episodeEntry.save();

    const removeResult = removeFile(filePath);
    if (removeResult.status === 'error') {
      console.error(removeResult.error);
      return removeResult.error;
    }

    initiateLLM(transcription, mode);
  }; //end generateTranscriptions

  await generateTranscriptions();
}

app.post('/api/searchForTranscript', async (req, res) => {
  const { episodeUrl, mode } = req.body;
  console.log('searching for transcript', episodeUrl);
  //find out if this url already exists in the db
  const podcastEpisode = await PodcastEpisode.findOne({
    episodeUrl: episodeUrl,
  });
  if (podcastEpisode) {
    console.log(
      'episode url found, id is:',
      podcastEpisode.episodeId
    );
    //set the transcription global and establish llm from there
    if (podcastEpisode.episodeTranscript) {
      transcription = podcastEpisode.episodeTranscript;
      initiateLLM(transcription, mode);
      return res.status(200).json({
        transcript: true,
        episodeId: podcastEpisode.episodeId,
        message: 'episode transcript found',
      });
    } else {
      console.log(
        'episode url found, but episode transcript not found'
      );
      return res.status(200).json({
        message: 'episode transcript not found',
      });
    }
  } else {
    console.log('episode url not found, need to transcribe');
    return res.status(404).json({
      message: 'episode url not found',
    });
  }
});

app.post('/api/transcribeEpisode', async (req, res) => {
  const { episodeUrl, mode, episodeTitle } = req.body;
  transcribeEpisode(episodeUrl, mode, episodeTitle);
  llmStatus = 'initializing';
  res.status(202).json({ message: 'Transcription in progress' });
});

app.post('/api/getEpisodeId', async (req, res) => {
  const { episodeUrl } = req.body;
  console.log('getEpisodeId from URL', episodeUrl);

  const podcastEpisode = await PodcastEpisode.findOne({
    episodeUrl: episodeUrl,
  });
  if (podcastEpisode.episodeId) {
    res.status(200).json({
      message: 'episode found',
      episodeId: podcastEpisode.episodeId,
    });
  } else {
    res.status(404).json({ message: 'episode not found' });
  }
});

// All other GET requests not handled before will return our React app
app.get('*', (req, res) => {
  res.sendFile(
    path.resolve(__dirname, '../client/build', 'index.html')
  );
});

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
