// client/src/App.js

import React from "react";
import "./App.css";

function App() {
  const [data, setData] = React.useState(null);
  const [podcastName, setPodcastName] = React.useState("");

  React.useEffect(() => {
    fetch("/api")
      .then((res) => res.json())
      .then((data) => setData(data.message));
  }, []);

  const handlePodcastSearch = (e) => {
    e.preventDefault();
    console.log("podcastName", podcastName);
    fetch("/api/searchForPodcast", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ podcastName }),
    })
      .then((res) => res.json())
      .then((data) => {
        console.log("data", data);
      })
      .catch((err) => {
        console.log("err", err);
      });
  };

  return (
    <div className="App">
      <div className="formContainer">
        <form onSubmit={handlePodcastSearch} method="POST">
          <label htmlFor="name">Podcast:</label>
          <input
            type="text"
            id="podcast"
            name="podcast"
            onChange={(e) => {
              setPodcastName(e.target.value);
            }}
          />
          <button type="submit">Submit</button>
        </form>
      </div>
    </div>
  );
}

export default App;
