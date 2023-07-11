import ListItem from "@mui/material/ListItem";
import Link from "@mui/material/Link";
import React from "react";

import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
import MenuItem from "@mui/material/MenuItem";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import Box from "@mui/material/Box";

export function PodcastResults({ podcasts, handleSetEpisodes }) {
  const [podcast, setPodcast] = React.useState("");

  const handlePodcastChange = (e) => {
    e.preventDefault();
    const podcastUrl = e.target.value;
    console.log(podcastUrl);
    setPodcast(podcastUrl);
    fetch("/api/searchForEpisodes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ podcastUrl }),
    })
      .then((res) => res.json())
      .then((data) => {
        console.log("data", data);
        const { mp3s } = data;
        handleSetEpisodes(mp3s);
      })
      .catch((err) => {
        console.log("err", err);
      });
  };

  return (
    <>
      {podcasts && podcasts.length ? (
        <Box
          className="podcastContainer"
          sx={{
            display: "flex",
          }}
        >
          <FormControl sx={{ m: 2, minWidth: 80 }} fullWidth>
            <InputLabel id="selectPodcastLabel">Select Podcast</InputLabel>
            <Select
              labelId="selectPodcastLabel"
              id="selectPodcast"
              value={podcast}
              label="Select Podcast"
              onChange={handlePodcastChange}
              autoWidth
            >
              {podcasts.map((podcast) => {
                return (
                  <MenuItem key={podcast.title} value={podcast.url}>
                    {podcast.title}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
        </Box>
      ) : null}
    </>
  );
}
