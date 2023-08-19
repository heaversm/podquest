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
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { Configuration, OpenAIApi } from "openai";
import {
  CharacterTextSplitter,
  RecursiveCharacterTextSplitter,
} from "langchain/text_splitter";
import { Document } from "langchain/document";
import { FaissStore } from "langchain/vectorstores/faiss";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { RetrievalQAChain, loadSummarizationChain } from "langchain/chains";

import { mkdir, writeFile } from "fs/promises";
import { Readable } from "stream";
import { finished } from "stream/promises";

const LOAD_TRANSCRIPT_FROM_FILE = false; //MH TODO: currently loads text, but llm doesn't like this unless it has been formally called by langchain createTranscription
const LOAD_AUDIO_FROM_FILE = false;
const MAX_EPISODES = 5;
const NUM_QUIZ_QUESTIONS = 5;
const USE_ONLY_SUMMARY = false;
const RESPOND_YES_NO = false;
const BE_CONCISE = false;
const USE_ONLY_CONTEXT = false;

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

let chain; //will hold the llm and retriever
let summarizer; //will hold the summarization chain
let transcription; //will hold the transcription from openai
let quizQuestions;

//llm
import { OpenAI } from "langchain/llms/openai";

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
    const transcriptionFormat = mode === "audio" ? "srt" : "text";
    console.log("filePath", filePath, transcriptionFormat);
    transcript = await openai
      .createTranscription(
        fs.createReadStream(filePath),
        "whisper-1",
        "", //prompt, unused
        transcriptionFormat
      )
      .then((response) => {
        console.log("transcription response!");
        console.log(response.data);
        return response.data;
      })
      .catch((err) => {
        console.log("transcription error!");
        console.log(err);
      });
    return transcript;
  }
};

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
    // console.log(response.data);
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
    // https
    //   .get(url, (response) => {
    //     // console.log("status", response.statusCode);
    try {
      const response = await fetch(url);
      //console.log(response);
      // console.log("status", response.statusCode);

      if (response.status === 200) {
        //
        if (!fs.existsSync("downloads")) await mkdir("downloads"); //Optional if you already have downloads directory
        const fileID = uuidv4();
        const fileName = `${fileID}.mp3`;
        const destination = path.resolve("./downloads", fileName);
        const fileStream = fs.createWriteStream(destination, { flags: "wx" });
        await finished(Readable.fromWeb(response.body).pipe(fileStream));
        console.log(destination);
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
  console.log(query, mode, quizQuestion);
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
    console.log("yesIndex", yesIndex);
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
    console.log("isCorrect", isCorrect);
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
    chainResponse = await chain.call({
      query: query,
    });
    return res.status(200).json({ text: chainResponse.text });
  }
});

function removeQueryParams(origURL) {
  const url = new URL(origURL);
  console.log("rqp", url);
  const nonParamURL = url.origin + url.pathname;
  return nonParamURL;
}

app.post("/api/transcribeEpisode", async (req, res) => {
  const { episodeUrl, mode } = req.body;
  console.log(episodeUrl, "episodeURL");
  let filePath;
  if (LOAD_AUDIO_FROM_FILE) {
    filePath = path.join(__dirname, "../audio.mp3");
  } else {
    //const nonParamURL = removeQueryParams(episodeUrl);
    //console.log(nonParamURL, "nonParamURL");
    filePath = await getAudioFromURL(episodeUrl);
  }

  //TODO: make sure we are receiving a valid mp3
  res.write(JSON.stringify({ message: "Audio Received - Transcribing..." }));
  transcription = await transcribeAudio(filePath, mode);
  // console.log("transcription2", transcription);
  res.write(
    JSON.stringify({ message: "Transcription Created - Creating Embeddings" })
  );
  const llm = new OpenAI();

  // if (mode !== "audio") {
  if (!LOAD_AUDIO_FROM_FILE) {
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: err });
      }
    });
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 256,
    chunkOverlap: 0,
  });

  const output = await splitter.splitDocuments([
    new Document({ pageContent: transcription }),
  ]);
  // console.log("output", output);
  const vectorStore = await FaissStore.fromDocuments(
    output,
    new OpenAIEmbeddings()
  );

  const retriever = vectorStore.asRetriever();
  chain = RetrievalQAChain.fromLLM(llm, retriever);

  if (mode === "quiz") {
    res.write(JSON.stringify({ message: "Generating quiz questions" }));
    let query = `what are ${NUM_QUIZ_QUESTIONS} questions you could ask a student about the podcast to see if they understood and learned from what they had heard? Ask only questions that can be proven with facts or yes and no / true or false answers, not questions about opinions or qualitative states or feelings`;

    if (USE_ONLY_SUMMARY) {
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
    console.log("quizQuestions", quizQuestionsResponse.text);
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
          quizQuestions = questions;
        }
      }
    }
  }
  res.write(
    JSON.stringify({
      message: "LLM Ready",
      done: true,
      mode: mode,
      quizQuestions: quizQuestions,
    })
  );
  return res.end();
});

// All other GET requests not handled before will return our React app
app.get("*", (req, res) => {
  res.sendFile(path.resolve(__dirname, "../client/build", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
