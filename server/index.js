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
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Document } from 'langchain/document';
import { FaissStore } from 'langchain/vectorstores/faiss';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { RetrievalQAChain } from 'langchain/chains';

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

//APP CONFIGURATION
const LOAD_TRANSCRIPT_FROM_FILE = false; //MH TODO: currently loads text, but llm doesn't like this unless it has been formally called by langchain createTranscription
const LOAD_AUDIO_FROM_FILE = false;
const MAX_EPISODES = 5;
const FORCE_SRT = true; //allows us to avoid refreshing the page and re-transcribe when true, but means other modes must navigate timestamps

const MAX_FILE_SIZE = 20; //in MB. If a podcast is over this size, split it up
const MAX_DURATION = 300; //in seconds, if splitting by duration instead of size
const MAX_CHUNKS = 10; //if episode exceeds this, it's probably too slow given the current transcription process

//END APP CONFIGURATION

//LLM CONFIGURATION

import { OpenAI } from 'langchain/llms/openai';

const openAIConfiguration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0.8, //higher = more creative
});
const openai = new OpenAIApi(openAIConfiguration);

class UserLLM {
  userId = null;
  transcription = '';
  chain = null;
  llmStatus = 'not ready';
  constructor({ userId, transcription, chain, llmStatus }) {
    this.userId = userId;
    this.transcription = transcription;
    this.chain = chain;
    this.llmStatus = llmStatus;
  }
}

const userLLMS = []; //will hold each user's LLM

//SERVER CONFIGURATION

const PORT = process.env.PORT || 3001;

const app = express();

connectDB();

//APP FUNCTIONS

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

const removeQueryParams = function (origURL) {
  const url = new URL(origURL);
  console.log('rqp', url);
  const nonParamURL = url.origin + url.pathname;
  return nonParamURL;
};

const splitAudioIntoChunks = async (filePath, userLLM) => {
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
              userLLM.llmStatus = `exported chunk ${chunkIndex} of ${numChunks}`;
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
}; //end splitAudioIntoChunks

const transcribeAudioChunks = async (outputPaths, userLLM) => {
  const transcripts = [];
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

              userLLM.llmStatus = `transcribed audio file ${
                i + 1
              } of ${outputPaths.length}`;
              transcripts.push(response.data);
              resolve(transcripts);
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
};

const establishLLM = async function (mode, userLLM) {
  // console.log("establishing llm");
  const llm = new OpenAI();
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 256,
    chunkOverlap: 0,
  });
  // console.log('userLLM transcript', userLLM.transcription);

  const output = await splitter.splitDocuments([
    new Document({ pageContent: userLLM.transcription }),
  ]);
  //console.log('output', output);
  const vectorStore = await FaissStore.fromDocuments(
    output,
    new OpenAIEmbeddings()
  );

  //console.log('vector store established', vectorStore);

  const retriever = vectorStore.asRetriever();
  //console.log('retriever established', retriever);
  userLLM.chain = RetrievalQAChain.fromLLM(llm, retriever);
  // console.log('chain established', userLLM.chain);
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

const adjustTranscript = function (originalTranscript) {
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
};

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

const initiateLLM = async (mode, userLLM) => {
  console.log('establishing llm');
  userLLM.llmStatus = 'establishing llm';
  await establishLLM(mode, userLLM);
  console.log('all done');
  userLLM.llmStatus = 'ready';
  return 'ready';
};

const searchForUserLLM = function (userId) {
  //iterate through the userLLMS array and find the one with the matching userId
  const userLLM = userLLMS.find((userLLM) => {
    return userLLM.userId === userId;
  });
  return userLLM;
};

const transcribeEpisode = async function (
  episodeUrl,
  mode,
  episodeTitle,
  userId
) {
  let userLLM = searchForUserLLM(userId);
  if (!userLLM) {
    userLLM = new UserLLM({
      userId: userId,
      transcription: '',
      chain: null,
      llmStatus: 'transcribing episode',
    });
    userLLMS.push(userLLM);
  }

  let filePath;
  if (LOAD_AUDIO_FROM_FILE) {
    filePath = path.join(__dirname, '../audio.mp3');
  } else {
    try {
      filePath = await getAudioFromURL(episodeUrl);
    } catch (error) {
      console.log('error getting audio file', error);
    }
  }

  const generateTranscriptions = async () => {
    userLLM.llmStatus = 'getting file size';
    const stats = await statAsync(filePath);

    const fileSizeInMB = stats.size / 1024 / 1024;
    console.log('fs in MB', fileSizeInMB, 'max', MAX_FILE_SIZE);
    //TODO:MH - there are still instances where being under MAX_FILE_SIZE results in a BODY LENGTH EXCEEDED ERROR from Whisper

    if (fileSizeInMB > MAX_FILE_SIZE) {
      console.log('file size too large, splitting audio');
      userLLM.llmStatus = 'splitting audio';
      try {
        const outputPaths = await splitAudioIntoChunks(
          filePath,
          userLLM
        );

        userLLM.llmStatus = 'transcribing chunks';
        console.log('transcribing chunks');

        await transcribeAudioChunks(outputPaths, mode).then(
          (chunkedTranscripts) => {
            const joinedChunkedTranscript =
              chunkedTranscripts.join(''); // Combine all chunk transcripts

            //TODO: need to adjust transcript timestamps to account for chunking
            userLLM.llmStatus = 'reassembling audio';
            const adjustedTranscript = adjustTranscript(
              joinedChunkedTranscript
            );
            userLLM.transcription = adjustedTranscript;
            console.log('final transcription', userLLM.transcription);
            userLLM.llmStatus = 'audio transcribed';
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
        userLLM.llmStatus = 'transcribing audio';
        userLLM.transcription = await transcribeAudio(filePath, mode);
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
      episodeTranscript: userLLM.transcription,
    });

    await episodeEntry.save();

    const removeResult = removeFile(filePath);
    if (removeResult.status === 'error') {
      console.error(removeResult.error);
      return removeResult.error;
    }

    console.log(
      'transcript: ',
      userLLM.transcription ? 'found' : 'not found'
    );

    await initiateLLM(mode, userLLM);
  }; //end generateTranscriptions

  await generateTranscriptions();
};

app.use(express.json());

// Have Node serve the files for our built React app
app.use(express.static(path.resolve(__dirname, '../client/build')));

//APP ROUTES

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
  const userLLM = searchForUserLLM(userId);

  if (!userLLM) {
    return res.status(404).json({ status: 'user not found' });
  }

  if (!userLLM.chain) {
    return res.status(404).json({ status: 'no llm chain found' });
  }
  console.log('userLLM:', userLLM.userId);
  console.log(
    'Perform User Query: query,mode,question,episodeId',
    query,
    mode,
    episodeId,
    userId
  );
  let chainResponse;

  if (mode === 'audio') {
    let finalQuery = `The question is: ${query}. Respond with the timestamp from the podcast where the answer to the question can be found. The format should only be a valid timestamp of the format hh:mm:ss. If the answer to the question cannot be found in the podcast, respond with "Answer not found".`;
    chainResponse = await userLLM.chain.call({
      query: finalQuery,
    });
    return res.status(200).json({ text: chainResponse.text });
  } else {
    chainResponse = await userLLM.chain.call({
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

app.get('/api/getUserId', async (req, res) => {
  const id = nanoid();
  //TODO: save user to db
  const userEntry = new PodcastUsers({
    userId: id,
  });
  await userEntry.save();
  res.json({ id: id });
});

app.post('/api/downloadTranscript', async (req, res) => {
  const { userId } = req.body;
  const userLLM = searchForUserLLM(userId);
  if (!userLLM) {
    return res.status(404).json({ status: 'user not found' });
  } else {
    if (userLLM.transcription) {
      return res.status(200).json({
        transcription: userLLM.transcription,
      });
    } else {
      return res.status(404).json({
        message: 'transcript not found',
      });
    }
  }
});

app.post('/api/getStatus', async (req, res) => {
  const { userId } = req.body;
  const userLLM = searchForUserLLM(userId);
  if (!userLLM) {
    return res.status(404).json({ status: 'user not found' });
  }
  if (userLLM.llmStatus === 'ready') {
    return res.status(200).json({ status: userLLM.llmStatus });
  } else {
    return res.status(202).json({ status: userLLM.llmStatus });
  }
});

app.post('/api/searchForTranscript', async (req, res) => {
  const { episodeUrl, mode, userId } = req.body;
  console.log('searching for transcript for episode:', episodeUrl);
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
      console.log('episode transcript found');
      let userLLM = searchForUserLLM(userId);
      if (!userLLM) {
        userLLM = new UserLLM({
          userId: userId,
          transcription: podcastEpisode.episodeTranscript,
          chain: null,
          llmStatus: 'establishing LLM',
        });
        userLLMS.push(userLLM);
      } else {
        console.log('userLLM found', userLLM);
        if (!userLLM.transcription) {
          userLLM.transcription = podcastEpisode.episodeTranscript;
          userLLM.llmStatus = 'establishing LLM';
        }
      }

      await initiateLLM(mode, userLLM);
      return res.status(200).json({
        transcript: true,
        episodeId: podcastEpisode.episodeId,
        message: 'episode transcript found',
      });
    } else {
      console.log(
        'episode url found, but episode transcript not found'
      );
      return res.status(404).json({
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
  const { episodeUrl, mode, episodeTitle, userId } = req.body;
  transcribeEpisode(episodeUrl, mode, episodeTitle, userId);
  res.status(202).json({ message: 'Transcription in progress' });
});

app.post('/api/getEpisodeId', async (req, res) => {
  const { episodeUrl } = req.body;
  console.log('getEpisodeId from URL', episodeUrl);

  const podcastEpisode = await PodcastEpisode.findOne({
    episodeUrl: episodeUrl,
  });
  if (podcastEpisode?.episodeId) {
    res.status(200).json({
      message: 'episode found',
      episodeId: podcastEpisode.episodeId,
    });
  } else {
    res.status(404).json({ message: 'episode not found' });
  }
});

app.post('/api/resetUserLLM', async (req, res) => {
  const { userId } = req.body;
  console.log('reset request received for user:', userId);
  const userLLM = searchForUserLLM(userId);
  if (!userLLM) {
    //
    userLLMS.push({
      userId: userId,
      transcription: '',
      chain: null,
      llmStatus: 'not ready',
    });
    //user has visited before, but is no longer in the userLLMS array
    return res.status(200).json({
      status: 'previous user, but not in user array. User added',
    });
  } else {
    userLLM.transcription = '';
    userLLM.chain = null;
    userLLM.llmStatus = 'not ready';
    return res.status(200).json({ status: 'user llm reset' });
  }
});

app.post('/api/coral/search', async (req, res) => {
  return res.status(200).json({
    results: [
      {
        id: 'doc1',
        title: 'Sample Doc Title',
        text: 'Sample Doc Text',
        url: 'https://sampledoc.com',
        created_at: '2023-11-25T20:09:31Z',
      },
    ],
  });
});

// All other GET requests not handled before will return our React app
app.get('*', (req, res) => {
  //MH TODO: this is resolving to "no such file or directory" but somehow still serving the index file
  res.sendFile(
    path.resolve(__dirname, '../client/build', 'index.html')
  );
});

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
