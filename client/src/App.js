// client/src/App.js
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";

import React from "react";
import "./App.css";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import Link from "@mui/material/Link";

const FormContainer = ({ handleSetPodcasts }) => {
  const [podcastName, setPodcastName] = React.useState("");

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
        const { podcasts } = data;
        handleSetPodcasts(podcasts);
      })
      .catch((err) => {
        console.log("err", err);
      });
  };

  return (
    <div className="formContainer">
      <Box
        component="form"
        sx={{
          m: 2,
          display: "flex",
        }}
        noValidate
        autoComplete="off"
        onSubmit={handlePodcastSearch}
        method="POST"
      >
        <TextField
          type="text"
          label="Podcast Name"
          id="podcast"
          name="podcast"
          size="small"
          sx={{
            mr: 2,
          }}
          onChange={(e) => {
            setPodcastName(e.target.value);
          }}
        />
        <Button type="submit" variant="contained">
          Submit
        </Button>
      </Box>
    </div>
  );
};

const ResultsContainer = ({ podcasts }) => {
  return (
    <div className="podcastContainer">
      {
        //display an unordered list of podcasts
        <List>
          {podcasts &&
            podcasts.length > 0 &&
            podcasts.map((podcast) => {
              return (
                <ListItem key={podcast.title}>
                  <Link className="podcast" href={podcast.url}>
                    {podcast.title}
                  </Link>
                </ListItem>
              );
            })}
        </List>
      }
    </div>
  );
};

function App() {
  const [podcasts, setPodcasts] = React.useState([]);

  const handleSetPodcasts = (podcastList) => {
    console.log("handle", podcastList);
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
