import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";

import React from "react";
export function FormContainer({ handleSetPodcasts }) {
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
}
