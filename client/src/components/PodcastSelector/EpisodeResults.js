import ListItem from "@mui/material/ListItem";
import Link from "@mui/material/Link";
import React from "react";

import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
import MenuItem from "@mui/material/MenuItem";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import Box from "@mui/material/Box";

export function EpisodeResults({ episodes }) {
  const [episode, setEpisode] = React.useState("");

  const handleEpisodeChange = (e) => {
    e.preventDefault();
    const episodeUrl = e.target.value;
    console.log(episodeUrl);
    setEpisode(episodeUrl);
    fetch("/api/transcribeEpisode", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ episodeUrl }),
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
    <>
      {episodes && episodes.length ? (
        <Box
          className="episodesContainer"
          sx={{
            display: "flex",
          }}
        >
          <FormControl sx={{ m: 2, minWidth: 80 }} fullWidth>
            <InputLabel id="selectEpisodeLabel">Select Episode</InputLabel>
            <Select
              labelId="selectEpisodeLabel"
              id="selectEpisode"
              value={episode}
              label="Select Episode"
              onChange={handleEpisodeChange}
              autoWidth
            >
              {episodes.map((episode) => {
                return (
                  <MenuItem key={episode.title} value={episode.url}>
                    {episode.title}
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
