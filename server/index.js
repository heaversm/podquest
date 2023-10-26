import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
dotenv.config();

//required for upgrade to es modules
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import crypto from "crypto";
import axios, { all } from "axios";
import { v4 as uuidv4 } from "uuid";
import { Configuration, OpenAIApi } from "openai";
import * as nodeOpenAI from "openai";
import {
  CharacterTextSplitter,
  RecursiveCharacterTextSplitter,
} from "langchain/text_splitter";
import { Document } from "langchain/document";
import { FaissStore } from "langchain/vectorstores/faiss";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { RetrievalQAChain, loadSummarizationChain } from "langchain/chains";
import { ChatPromptTemplate } from "langchain/prompts";

import { mkdir, writeFile } from "fs/promises";
import { Readable } from "stream";
import { finished } from "stream/promises";

import ffmpeg from "fluent-ffmpeg";
import getMP3Duration from "get-mp3-duration";
import util from "util";

const statAsync = util.promisify(fs.stat); //get file sizes asynchronously to determine if above API limits

//CONFIGURATION
const LOAD_TRANSCRIPT_FROM_FILE = false; //MH TODO: currently loads text, but llm doesn't like this unless it has been formally called by langchain createTranscription
const LOAD_AUDIO_FROM_FILE = false;
const MAX_EPISODES = 5;

const NUM_QUIZ_QUESTIONS_TO_GENERATE = 5; //how many initial questions do you want the llm to come up with
const NUM_QUIZ_QUESTIONS = 5; //how many of the generated quiz questions do you want to keep
const USE_ONLY_SUMMARY = false; //ask questions only pertaining to the summary
const RESPOND_YES_NO = false; //respond with only yes or no
const BE_CONCISE = false; //be concise in your response
const USE_ONLY_CONTEXT = false;
const FORCE_SRT = true; //allows us to avoid refreshing the page and re-transcribe when true, but means other modes must navigate timestamps
const USE_KEEP_ALIVE_TIMER = false;

const MAX_FILE_SIZE = 20; //in MB. If a podcast is over this size, split it up
const MAX_DURATION = 300; //in seconds, if splitting by duration instead of size
const MAX_CHUNKS = 10; //if episode exceeds this, it's probably too slow given the current transcription process

const DO_RRF = true; //use Reciprocal Ranked Fusion

//END CONFIGURATION

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0.8, //higher = more creative
});
const openai = new OpenAIApi(configuration);

const llm = new OpenAI(); //the llm model to use (currently only openai)
let finalDocs; //will hold the output docs (shuffled or unshuffled)
let chain; //will hold the llm and retriever
let vectorStore; //will hold the vector store of docs
let summarizer; //will hold the summarization chain
let transcription; //will hold the transcription from openai
let transcripts = []; //will hold the transcripts from openai if the audio is split into chunks
let quizQuestions; //will hold the quiz questions if this mode is selected
let llmStatus = "not ready"; //will hold the status of the llm

//llm
import { OpenAI } from "langchain/llms/openai";

const PORT = process.env.PORT || 3001;

const app = express();
app.use(express.json());

// Have Node serve the files for our built React app
app.use(express.static(path.resolve(__dirname, "../client/build")));

// Handle GET requests to /api route
app.get("/api/testOpenAIConfig", async (req, res) => {
  res.json({ message: "Connected to Server" });
});

app.post("/api/searchForPodcast", async (req, res) => {
  // console.log(req.body);
  const { podcastName } = req.body;
  const apiKey = process.env.PODCAST_INDEX_API_KEY;
  const apiSecret = process.env.PODCAST_INDEX_API_SECRET;
  const apiHeaderTime = Math.floor(Date.now() / 1000);
  const sha1Algorithm = "sha1";
  const sha1Hash = crypto.createHash(sha1Algorithm);
  const data4Hash = apiKey + apiSecret + apiHeaderTime;
  sha1Hash.update(data4Hash);
  const hash4Header = sha1Hash.digest("hex");
  // console.log(`hash4Header=[${hash4Header}]`);

  const options = {
    method: "get",
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Date": "" + apiHeaderTime,
      "X-Auth-Key": apiKey,
      Authorization: hash4Header,
      "User-Agent": "Podquest/1.0",
    },
  };

  const url =
    "https://api.podcastindex.org/api/1.0/search/byterm?q=" +
    podcastName +
    "&max=10";
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
      console.log("no podcasts found");
      return res.status(400).json({ error: "No podcasts found" });
    }
  });
});

app.post("/api/searchForEpisodes", async (req, res) => {
  // console.log(req.body);
  const { podcastUrl } = req.body;
  const apiKey = process.env.PODCAST_INDEX_API_KEY;
  const apiSecret = process.env.PODCAST_INDEX_API_SECRET;
  const apiHeaderTime = Math.floor(Date.now() / 1000);
  const sha1Algorithm = "sha1";
  const sha1Hash = crypto.createHash(sha1Algorithm);
  const data4Hash = apiKey + apiSecret + apiHeaderTime;
  sha1Hash.update(data4Hash);
  const hash4Header = sha1Hash.digest("hex");
  // console.log(`hash4Header=[${hash4Header}]`);

  const options = {
    method: "get",
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Date": "" + apiHeaderTime,
      "X-Auth-Key": apiKey,
      Authorization: hash4Header,
      "User-Agent": "Podquest/1.0",
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
        .json({ error: "No episodes found for this podcast" });
    }
  });
});

const getAudioFromURL = async (url) => {
  return new Promise(async (resolve, reject) => {
    try {
      const response = await fetch(url);
      // console.log("status", response.statusCode);

      if (response.status === 200) {
        if (!fs.existsSync("downloads")) await mkdir("downloads"); //Optional if you already have downloads directory
        const fileID = uuidv4();
        const fileName = `${fileID}.mp3`;
        const destination = path.resolve("./downloads", fileName);
        const fileStream = fs.createWriteStream(destination, { flags: "wx" });
        await finished(Readable.fromWeb(response.body).pipe(fileStream));
        // console.log(destination);
        return resolve(destination);
      } else {
        //reject with the error message
        return reject("Error retrieving MP3 file");
      }
    } catch (error) {
      console.error("error retrieving mp3 file", error);
    }
  }).catch((error) => {
    console.error("Unhandled rejection:", error);
  });
};

app.get("/api/getQuizQuestions", async (req, res) => {
  if (quizQuestions && quizQuestions.length > 0) {
    console.log("quizQuestions", quizQuestions);
    return res.status(200).json({ quizQuestions: quizQuestions });
  } else {
    return res.status(404).json({ error: "No quiz questions found" });
  }
});

app.get("/playAudio", (req, res) => {
  const filePath = req.body;

  // Check if the file exists
  fs.access(filePath, fs.constants.R_OK, (err) => {
    if (err) {
      console.error("Error accessing the audio file:", err);
      return res.status(404).send("Audio file not found");
    }

    // Set appropriate headers for streaming the audio
    res.set({
      "Content-Type": "audio/mpeg", // Adjust the content type based on your audio file format
      "Content-Length": fs.statSync(filePath).size,
    });

    // Create a read stream to read the audio file
    const audioStream = fs.createReadStream(filePath);

    // Pipe the audio stream to the response stream
    audioStream.pipe(res);
  });
});

app.post("/api/performUserQuery", async (req, res) => {
  const { query, mode, quizQuestion } = req.body;
  console.log("query,mode,quiz", query, mode, quizQuestion);
  let chainResponse;

  if (mode === "quiz") {
    let isCorrect = null;

    let finalQuery = `The user answered this question: ${quizQuestion}. The user's answer was: ${query}. Is this correct?"`;

    if (USE_ONLY_CONTEXT) {
      finalQuery += `Use only the context of the question and answer to determine if the user is correct.`;
    }

    if (RESPOND_YES_NO) {
      finalQuery += `Respond with only "yes" or "no"`;
    } else if (BE_CONCISE) {
      finalQuery += "Be concise in your response.";
    }

    chainResponse = await chain.call({
      query: finalQuery,
    });

    const chainResponseText = chainResponse.text
      .trim()
      .toLowerCase()
      .replace(/[^a-zA-Z ]/g, "");
    console.log("chainResponseText", chainResponseText);

    let yesIndex, noIndex;
    //look for word yes in chain response text and parse it out...
    yesIndex = chainResponseText.indexOf("yes");
    if (yesIndex === -1) {
      noIndex = chainResponseText.indexOf("no");
      if (noIndex === -1) {
        //perform sentiment analysis to determine positivity / negativity
        const sentimentResponse = await chain.call({
          query: `Analyze the sentiment of the following text: ${chainResponse.text}. Respond with only "positive" or "negative"`,
        });
        //convert sentimentResponse.text to a lowercase string:
        let sentimentResponseText = sentimentResponse.text.trim();
        sentimentResponseText.replace(/[^a-zA-Z ]/g, "");
        sentimentResponseText = sentimentResponseText.toLowerCase();

        console.log("sentimentResponse", sentimentResponseText);

        if (sentimentResponseText == "positive") {
          console.log("true");
          isCorrect = true;
        } else {
          console.log("false");
          isCorrect = false;
        }
      } else {
        isCorrect = false;
      }
    } else {
      isCorrect = true;
    }
    return res
      .status(200)
      .json({ text: chainResponse.text, isCorrect: isCorrect });
  } else if (mode === "audio") {
    let finalQuery = `The question is: ${query}. Respond with the timestamp from the podcast where the answer to the question can be found. The format should only be a valid timestamp of the format hh:mm:ss. If the answer to the question cannot be found in the podcast, respond with "Answer not found".`;
    chainResponse = await chain.call({
      query: finalQuery,
    });
    return res.status(200).json({ text: chainResponse.text });
  } else {
    const generatedQueries = await generateQueries(query);
    console.log("generatedQueries", generatedQueries);
    const altQueryDocs = {};

    const promises = generatedQueries.map(async (generatedQuery) => {
      const docsFromAltQuery = await vectorSearch(generatedQuery);
      console.log("docsFromAltQuery", docsFromAltQuery);
      altQueryDocs[`${generatedQuery}`] = docsFromAltQuery;
    });

    // console.log("all results", altQueryDocs);
    Promise.all(promises).then(async () => {
      console.log("all results", altQueryDocs);
      const rankedResults = reciprocalRankFusion(altQueryDocs);
      //TODO:MH - these are not sorting properly - given object
      console.log("Final reranked results", rankedResults);
      const sortedObject = sortObjectByValues(unsortedObject);
      console.log("sorted final reranked results", sortedObject);
      chainResponse = await chain.call({
        query: query,
      });
      return res.status(200).json({ text: chainResponse.text });
    });
  }
});

function sortObjectByValues(obj) {
  const sortedKeys = Object.keys(obj).sort((a, b) => obj[b] - obj[a]);
  const sortedObject = {};

  for (const key of sortedKeys) {
    sortedObject[key] = obj[key];
  }

  return sortedObject;
}

function reciprocalRankFusion(altQueryDocs, k = 60) {
  const fusedScores = {};
  console.log("Initial individual search result ranks:");

  for (const query in altQueryDocs) {
    if (altQueryDocs.hasOwnProperty(query)) {
      const docScores = altQueryDocs[query];
      console.log(`For query '${query}':`, docScores);
    }
  }

  for (const query in altQueryDocs) {
    console.log(query);
    if (altQueryDocs.hasOwnProperty(query)) {
      const docObj = altQueryDocs[query];
      console.log(`doc scores for query ${query} `, docObj);
      for (let rank = 0; rank < Object.keys(docObj).length; rank++) {
        const sortedDocs = Object.entries(docObj).sort((a, b) => b[1] - a[1]);
        console.log("sorted docs[rank]=", sortedDocs[rank]);
        const [score, doc] = sortedDocs[rank];
        console.log("score", score);
        console.log("doc", doc);
        const docID = doc.id;
        const fusedDoc = fusedScores[docID];
        if (!fusedDoc) {
          fusedScores[docID] = 0;
        }
        const previousScore = fusedScores[docID];
        fusedScores[docID] += 1 / (rank + k);
        console.log(
          `Updating score for ${docObj.id} from ${previousScore} to ${fusedScores[doc]} based on rank ${rank} in query '${query}'`
        );
      }
    }
  }

  const sortedFusedScores = Object.fromEntries(
    Object.entries(fusedScores).sort((a, b) => b[1] - a[1])
  );

  return sortedFusedScores;
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function vectorSearch(query) {
  const docs = await vectorStore.similaritySearch(query);
  // console.log("vectordocs", docs);
  docs.forEach((documentObject, index) => {
    const pageContentLines = documentObject.pageContent.split("\n");
    const lineNumber = pageContentLines[0];
    documentObject.id = pageContentLines[0];
    documentObject.score = index;
  });
  return docs;

  // console.log("selected docs", selectedDocs);
  // const scores = {};
  // selectedDocs.forEach((doc) => {
  //   const randomScore = (Math.random() * (0.9 - 0.7) + 0.7).toFixed(2);
  //   scores[doc] = parseFloat(randomScore);
  // });

  // const sortedScores = Object.fromEntries(
  //   Object.entries(scores).sort((a, b) => b[1] - a[1])
  // );

  // console.log("scores", sortedScores);

  // return sortedScores;
}

async function generateQueries(originalQuery) {
  const query = `You are a helpful assistant that generates alternative queries that could be asked to a large language model related to the users original query: ${originalQuery}. OUTPUT A COMMA SEPARATED LIST (CSV) of 4 alternative queries. The queries themselves should not be listed by number. Do not include the original query in the array`;
  const response = await chain.call({
    query: query,
  });

  console.log(response.text);
  // const lines = response.text.split("\n");
  // const generatedQueries = lines.map((line) => line.trim());
  const generatedQueries = response.text.trim().split(", ");
  return generatedQueries;
}

function removeQueryParams(origURL) {
  const url = new URL(origURL);
  console.log("rqp", url);
  const nonParamURL = url.origin + url.pathname;
  return nonParamURL;
}

async function splitAudioIntoChunks(filePath) {
  return new Promise((resolve, reject) => {
    console.log("splitting into chunks");
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
          let tempPath = filePath.replace(".mp3", "");
          const outputPath = `${tempPath}_${chunkIndex}.mp3`;
          outputPaths.push(outputPath);
          ffmpeg(filePath)
            .setStartTime(startTime)
            .setDuration(endTime - startTime)
            .output(outputPath)
            .on("end", () => {
              llmStatus = `exported chunk ${chunkIndex} of ${numChunks}`;
              console.log(`Chunk ${chunkIndex} exported successfully`);
              resolveChunk();
            })
            .on("error", (err) => {
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
        console.log("All chunks exported successfully");
        resolve(outputPaths);
      })
      .catch((err) => {
        console.error("Error exporting chunks:", err.message);
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
        const transcriptionFormat = "srt";
        await new Promise(async (resolve, reject) => {
          openai
            .createTranscription(
              fs.createReadStream(filePath),
              "whisper-1",
              "", //prompt, unused
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
              console.log("transcription error!", err);
              reject(err);
            });
        });
      }
    }

    transcribeAudioChunkSequentially()
      .then(() => {
        console.log("All chunks exported successfully");
        resolve(transcripts);
      })
      .catch((err) => {
        console.error("Error exporting chunks:", err.message);
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

  if (DO_RRF) {
    //random shuffle
    finalDocs = output
      .map((value) => ({ value, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ value }) => value);

    finalDocs.forEach((documentObject, index) => {
      const pageContentLines = documentObject.pageContent.split("\n");
      const lineNumber = pageContentLines[0];
      documentObject.id = pageContentLines[0];
      documentObject.score = index;
    });
  } else {
    finalDocs = output;
  }

  vectorStore = await FaissStore.fromDocuments(
    finalDocs,
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
        console.error("error removing file");
        return { status: "error", error: err };
      } else {
        return { status: "success" };
      }
    });
  } else {
    return { status: "success" };
  }
};

function adjustTranscript(originalTranscript) {
  const modifiedTranscript = originalTranscript.replace(/^\s*$/gm, "");

  // console.log(modifiedTranscript);

  const newTranscript = modifiedTranscript.trim().split("\n\n");
  //console.log(newTranscript);

  const newTranscriptEntries = [];

  newTranscript.map((entry) => {
    const lines = entry.split("\n");
    newTranscriptEntries.push(lines);
  });

  let lineCounter = 1;
  let adjustModeIndex;
  let finalTranscript = [];

  function timeToMillis(time) {
    const [hours, minutes, seconds, milliseconds] = time.split(/[:,.]/);
    return (
      parseInt(hours) * 3600000 +
      parseInt(minutes) * 60000 +
      parseInt(seconds) * 1000 +
      parseInt(milliseconds)
    );
  }

  function millisToTime(millis) {
    const date = new Date(millis);
    return date.toISOString().substr(11, 12).replace(".", ",");
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
        const prevTimestamps = prevTime.split(" --> ");
        const prevEndTime = prevTimestamps[1];
        // console.log(prevEndTime);
        const curTime = newTranscriptEntries[index][1];
        const curTimestamps = curTime.split(" --> ");
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
        const joinedTimestampString = [adjustedTimeStart, adjustedTimeEnd].join(
          " --> "
        );
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
    .map((array) => array.join("\n"))
    .join("\n\n");
  // console.log(formattedTranscript);
  return formattedTranscript;
}

app.get("/api/downloadTranscript", async (req, res) => {
  // console.log("return transcript", transcription);
  res.json({ transcription: transcription });
});

app.get("/api/getStatus", async (req, res) => {
  if (llmStatus === "ready") {
    return res.status(200).json({ status: llmStatus });
  } else {
    return res.status(202).json({ status: llmStatus });
  }
});

const transcribeAudio = async (filePath, mode) => {
  let transcript;
  if (LOAD_TRANSCRIPT_FROM_FILE) {
    transcript = fs.readFileSync(
      path.join(__dirname, "../", "transcript_w_timestamps.txt"),
      "utf8"
    );
    // console.log(transcript, "transcription");
    return transcript;
    // return JSON.stringify(transcript);
  } else {
    // const transcriptionFormat = mode === "audio" ? "srt" : "text";
    let transcriptionFormat;
    if (FORCE_SRT) {
      transcriptionFormat = "srt";
    } else {
      transcriptionFormat = mode === "audio" ? "srt" : "text";
    }

    // console.log("filePath", filePath, transcriptionFormat);
    transcript = await openai
      .createTranscription(
        fs.createReadStream(filePath),
        "whisper-1",
        "", //prompt, unused
        transcriptionFormat
      )
      .then((response) => {
        // console.log(response.data);
        return response.data;
      })
      .catch((err) => {
        console.log("transcription error!", err);
        return "maxlength";
      });
    return transcript;
  }
};

async function transcribeEpisode(episodeUrl, mode) {
  let keepAliveTimer;
  let filePath;
  llmStatus = "downloading audio";
  if (LOAD_AUDIO_FROM_FILE) {
    filePath = path.join(__dirname, "../audio.mp3");
  } else {
    try {
      filePath = await getAudioFromURL(episodeUrl);
    } catch (error) {
      console.log("error getting audio file", error);
      // return res.status(500).json({ error: error });
    }
  }

  //MH TODO: check file size
  const generateTranscriptions = async () => {
    llmStatus = "getting file size";
    const stats = await statAsync(filePath);

    const fileSizeInMB = stats.size / 1024 / 1024;
    console.log("fs in MB", fileSizeInMB, "max", MAX_FILE_SIZE);

    if (fileSizeInMB > MAX_FILE_SIZE) {
      console.log("file size too large, splitting audio");
      llmStatus = "splitting audio";
      try {
        const outputPaths = await splitAudioIntoChunks(filePath);

        llmStatus = "transcribing chunks";
        console.log("transcribing chunks");

        await transcribeAudioChunks(outputPaths, mode).then(
          (chunkedTranscripts) => {
            transcription = chunkedTranscripts.join(""); // Combine all chunk transcripts

            //TODO: need to adjust transcript timestamps to account for chunking
            llmStatus = "reassembling audio";
            const adjustedTranscript = adjustTranscript(transcription);
            transcription = adjustedTranscript;
            console.log("final transcription", transcription);
            llmStatus = "audio transcribed";
            //remove chunked audio
            outputPaths.forEach((outputPath) => {
              removeFile(outputPath);
            });
            //remove original audio
            removeFile(filePath);
          }
        );
      } catch (error) {
        console.log("error splitting audio", error);
      }
    } else {
      console.log("file size ok");
      try {
        console.log("transcribing audio");
        llmStatus = "transcribing audio";
        transcription = await transcribeAudio(filePath, mode);
        console.log("transcription");
      } catch (error) {
        console.log("error transcribing audio", error);
        return error;
      }

      const removeResult = removeFile(filePath);
      if (removeResult.status === "error") {
        console.error(removeResult.error);
        return removeResult.error;
      }
    }

    console.log("establishing llm");
    llmStatus = "establishing llm";
    const output = await establishLLM(transcription, mode);
    llmStatus = "generating quiz";
    console.log("llm established, generating quiz questions");

    // let query = `You are a college teacher, asking college students questions about the stories mentioned in the podcast whose answers summarize the key topics. Be creative. Generate 5 quiz questions. Do not include mention of any line numbers or timestamps in your questions.`;

    let query = `Generate 5 quiz questions about the topics discussed in the episode. Do not include mention of any line numbers or timestamps in your questions.`;

    if (USE_ONLY_SUMMARY) {
      //MH - currently fails because output is not returned from establishLLM
      summarizer = loadSummarizationChain(llm, { type: "map_reduce" }); //stuff, map_reduce, refine
      const summary = await summarizer.call({
        input_documents: output,
      });
      console.log("summary", summary);

      query += ` Use only this summary to generate the questions: ${summary}`;
    }

    const quizQuestionsResponse = await chain.call({
      query: query,
    });
    console.log("all quiz questions generated", quizQuestionsResponse.text);

    if (quizQuestionsResponse?.text) {
      const inputText = quizQuestionsResponse.text;
      const lines = inputText.split("\n");
      if (lines.length > 0) {
        const questions = lines
          .map((line) => line.trim()) // Remove leading/trailing whitespace
          .filter((line) => line.length > 0) // Filter out empty lines
          .filter((line) => /^\d+\.\s/.test(line)) // Filter lines that start with a number and a period
          .map((line) => line.replace(/^\d+\.\s/, "")); // Remove the numbering
        if (questions.length > 0) {
          if (NUM_QUIZ_QUESTIONS_TO_GENERATE !== NUM_QUIZ_QUESTIONS) {
            const sliceIndex =
              NUM_QUIZ_QUESTIONS_TO_GENERATE - NUM_QUIZ_QUESTIONS;
            //keep only the questions from the sliceIndex to the end of the array
            quizQuestions = questions.slice(sliceIndex, questions.length - 1);
          } else {
            quizQuestions = questions;
          }
          // console.log("final quiz questions", quizQuestions);
        }
      }
    }
    if (USE_KEEP_ALIVE_TIMER) {
      clearInterval(keepAliveTimer);
    }
    return;
  }; //end generateTranscriptions

  await generateTranscriptions();
  console.log("all done");
  llmStatus = "ready";
  return "ready";
}

app.post("/api/transcribeEpisode", async (req, res) => {
  const { episodeUrl, mode } = req.body;
  transcribeEpisode(episodeUrl, mode);
  llmStatus = "initializing";
  res.status(202).json({ message: "Transcription in progress" });
});

// All other GET requests not handled before will return our React app
app.get("*", (req, res) => {
  res.sendFile(path.resolve(__dirname, "../client/build", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
