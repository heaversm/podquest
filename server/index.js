const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
const fs = require("fs");
dotenv.config();

const crypto = require("crypto");
const axios = require("axios");
const https = require("https");
const { v4: uuidv4 } = require("uuid");

const { Configuration, OpenAIApi } = require("openai");
const {
  CharacterTextSplitter,
  RecursiveCharacterTextSplitter,
} = require("langchain/text_splitter");
const { Document } = require("langchain/document");
const { FaissStore } = require("langchain/vectorstores/faiss");
const { OpenAIEmbeddings } = require("langchain/embeddings/openai");
const { RetrievalQAChain } = require("langchain/chains");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

//llm
const { OpenAI } = require("langchain/llms/openai");

const transcribeAudio = async (filePath) => {
  const transcription = await openai
    .createTranscription(fs.createReadStream(filePath), "whisper-1")
    .then((response) => {
      console.log(response.data);
      return response.data;
    })
    .catch((err) => {
      console.log(err);
    });
  return transcription;
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

  const url =
    "https://api.podcastindex.org/api/1.0/episodes/byfeedurl?max=2&url=" +
    podcastUrl;
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
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (response.statusCode === 200) {
          const chunks = [];

          response.on("data", (chunk) => {
            chunks.push(chunk);
          });

          response.on("end", () => {
            const chunkedBuffer = Buffer.concat(chunks);
            const fileID = uuidv4();
            const fileName = `${fileID}.mp3`;

            fs.writeFileSync(fileName, chunkedBuffer);
            const filePath = path.join(__dirname, `../${fileName}`);
            return resolve(filePath);
          });
        } else {
          //reject with the error message
          return reject("Error retrieving MP3 file");
        }
      })
      .on("error", (error) => {
        console.error("Error retrieving MP3 file:", error);
        return res.status(400).json({ error: error });
      });
  });
};

app.post("/api/transcribeEpisode", async (req, res) => {
  const { episodeUrl } = req.body;
  console.log(episodeUrl);
  const tempURL =
    "https://media.rss.com/digitalfuturestold/2023_03_07_20_45_19_d06c1ad6-ac3f-4f01-93fc-a9a01a7b76f2.mp3";
  const filePath = await getAudioFromURL(tempURL);
  console.log(filePath);
  const transcription = await transcribeAudio(filePath);

  const llm = new OpenAI();

  fs.unlink(filePath, (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: err });
    }
  });

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 256,
    chunkOverlap: 0,
  });

  const output = await splitter.splitDocuments([
    new Document({ pageContent: transcription.text }),
  ]);
  // console.log(output);
  const vectorStore = await FaissStore.fromDocuments(
    output,
    new OpenAIEmbeddings()
  );
  const retriever = vectorStore.asRetriever();
  // console.log("Retriever created", retriever);
  const chain = RetrievalQAChain.fromLLM(llm, retriever);
  const chainResponse = await chain.call({
    query: "What is this podcast about?",
  });
  console.log({ chainResponse });
});

// All other GET requests not handled before will return our React app
app.get("*", (req, res) => {
  res.sendFile(path.resolve(__dirname, "../client/build", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});