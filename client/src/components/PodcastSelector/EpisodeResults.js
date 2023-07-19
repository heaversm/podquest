import ListItem from "@mui/material/ListItem";
import Link from "@mui/material/Link";
import React, { useEffect } from "react";

import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
import MenuItem from "@mui/material/MenuItem";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";

export function EpisodeResults({
  episodes,
  handleSetLLMReady,
  handleSetStatusMessage,
}) {
  const [episode, setEpisode] = React.useState("");

  useEffect(() => {
    if (episode && episode !== "") {
      handleSetStatusMessage({
        message: "Retrieving audio from episode...",
        type: "info",
      });
    }
  }, [episode]);

  const handleEpisodeChange = (e) => {
    e.preventDefault();
    const episodeUrl = e.target.value;
    console.log(episodeUrl);
    setEpisode(episodeUrl);

    // fetch("/api/transcribeEpisode", {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify({ episodeUrl }),
    // })
    //   .then((res) => res.json())
    //   .then((data) => {
    //     console.log("data", data);
    //     if (data.llmReady) {
    //       handleSetLLMReady(true);
    //     }
    //   })
    //   .catch((err) => {
    //     console.log("err", err);
    //   });

    fetch("/api/transcribeEpisode", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ episodeUrl }),
    })
      .then(async (res) => {
        // console.log("res", res);
        // return res.json();
        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let chunk = "";

        function read() {
          return reader.read().then((data) => {
            console.log(data);

            const { value, done } = data;
            if (done) {
              console.log("All responses received");
              return;
            }

            chunk += decoder.decode(value, { stream: true });

            const parts = chunk.split("\n");
            parts.forEach((part) => {
              if (part !== "") {
                const jsonResponse = JSON.parse(part);
                console.log(jsonResponse.message);
                handleSetStatusMessage({
                  message: jsonResponse.message,
                  type: "info",
                });
              }
            });

            chunk = "";

            return read();
          });
        }

        return read();
      })
      .then(() => {
        console.log("llm ready");
        handleSetLLMReady(true);
      })
      .catch((err) => {
        console.log("err", err);
      });
  };

  return (
    <Box className="episodesContainer">
      <FormControl sx={{ mt: 2, minWidth: 80 }} fullWidth>
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
  );
}