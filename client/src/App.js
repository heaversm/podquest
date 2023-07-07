// client/src/App.js
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";

import React from "react";
import "./App.css";

import { FormContainer } from "./components/FormContainer";
import { ResultsContainer } from "./components/ResultsContainer";

function App() {
  const [podcasts, setPodcasts] = React.useState([]);

  const handleSetPodcasts = (podcastList) => {
    setPodcasts(podcastList);
  };

  return (
    <div className="App">
      <FormContainer handleSetPodcasts={handleSetPodcasts} />
      <ResultsContainer podcasts={podcasts} />
    </div>
  );
}

export default App;
