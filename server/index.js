const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config();

const crypto = require("crypto");
const axios = require("axios");

const PORT = process.env.PORT || 3001;

const app = express();
app.use(express.json());

// Have Node serve the files for our built React app
app.use(express.static(path.resolve(__dirname, "../client/build")));

// Handle GET requests to /api route
app.get("/api", (req, res) => {
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

app.post("/api/transcribeEpisode", async (req, res) => {
  const { episodeUrl } = req.body;
  console.log(episodeUrl);
});

// All other GET requests not handled before will return our React app
app.get("*", (req, res) => {
  res.sendFile(path.resolve(__dirname, "../client/build", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});