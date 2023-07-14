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
import { QueryForm } from "./components/Query/QueryForm";
import { QueryResults } from "./components/Query/QueryResults";

function App() {
  const [podcasts, setPodcasts] = React.useState([]);
  const [episodes, setEpisodes] = React.useState([]);
  const [queryResults, setQueryResults] = React.useState([]);
  const [llmReady, setLLMReady] = React.useState(false);

  const handleSetPodcasts = (podcastList) => {
    setPodcasts(podcastList);
  };

  const handleSetEpisodes = (episodesList) => {
    console.log(episodesList);
    setEpisodes(episodesList);
  };

  const handleSetQueryResults = (queryResultsList) => {
    console.log(queryResultsList);
    setQueryResults(queryResultsList);
  };

  const handleSetLLMReady = (llmReady) => {
    setLLMReady(llmReady);
  };

  return (
    <div className="App">
      <PodcastForm handleSetPodcasts={handleSetPodcasts} />
      <PodcastResults
        podcasts={podcasts}
        handleSetEpisodes={handleSetEpisodes}
      />
      <EpisodeResults
        episodes={episodes}
        handleSetLLMReady={handleSetLLMReady}
      />
      <QueryForm
        llmReady={llmReady}
        handleSetQueryResults={handleSetQueryResults}
      />
      <QueryResults queryResults={queryResults} />
    </div>
  );
}

export default App;
