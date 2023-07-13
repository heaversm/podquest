// client/src/App.js
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";

import React, { useEffect } from "react";
import "./App.css";

import { PodcastForm } from "./components/PodcastSelector/PodcastForm";
import { PodcastResults } from "./components/PodcastSelector/PodcastResults";
import { EpisodeResults } from "./components/PodcastSelector/EpisodeResults";

function App() {
  const [podcasts, setPodcasts] = React.useState([]);
  const [episodes, setEpisodes] = React.useState([]);

  const handleSetPodcasts = (podcastList) => {
    setPodcasts(podcastList);
  };

  const handleSetEpisodes = (episodesList) => {
    console.log(episodesList);
    setEpisodes(episodesList);
  };

  return (
    <div className="App">
      <PodcastForm handleSetPodcasts={handleSetPodcasts} />
      <PodcastResults
        podcasts={podcasts}
        handleSetEpisodes={handleSetEpisodes}
      />
      <EpisodeResults episodes={episodes} />
    </div>
  );
}

export default App;
