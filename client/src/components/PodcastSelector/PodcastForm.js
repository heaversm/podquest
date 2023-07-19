import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import React from "react";
export function PodcastForm({ handleSetPodcasts, handleSetStatusMessage }) {
  const [podcastName, setPodcastName] = React.useState("");

  const handlePodcastSearch = (e) => {
    e.preventDefault();
    handleSetStatusMessage({
      message: "Searching for podcasts...",
      type: "info",
    });
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
    <Box className="podcastFormContainer">
      <Box
        component="form"
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
          fullWidth
          onChange={(e) => {
            setPodcastName(e.target.value);
          }}
        />
        <Button
          type="submit"
          variant="contained"
          sx={{
            mt: 2,
            mb: 2,
          }}
        >
          Submit
        </Button>
      </Box>
    </Box>
  );
}
