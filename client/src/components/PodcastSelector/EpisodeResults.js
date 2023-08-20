import ListItem from "@mui/material/ListItem";
import Link from "@mui/material/Link";
import React, { useEffect } from "react";

import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
import MenuItem from "@mui/material/MenuItem";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";

let llmReady = false;

export function EpisodeResults({
  episodes,
  handleSetLLMReady,
  handleSetStatusMessage,
  handleSetFilePath,
  handleSetQuizQuestions,
  mode,
}) {
  const [episode, setEpisode] = React.useState("");

  useEffect(() => {
    if (episode && episode !== "") {
      // handleSetStatusMessage({
      //   message: "Retrieving audio from episode...",
      //   type: "info",
      // });

      handleSetFilePath(episode);
    }
  }, [episode]);

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
      body: JSON.stringify({ episodeUrl, mode }),
    })
      .then(async (res) => {
        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let chunk = "";

        function read() {
          return reader.read().then((data) => {
            const { value, done } = data;
            if (done) {
              return;
            }

            chunk += decoder.decode(value, { stream: true });

            const parts = chunk.split("\n");
            parts.forEach((part) => {
              if (part !== "") {
                const jsonResponse = JSON.parse(part);
                console.log(jsonResponse);
                handleSetStatusMessage({
                  message: jsonResponse.message,
                  type: "info",
                });

                if (jsonResponse.quizQuestions) {
                  //MH TODO: wait until llm ready?
                  llmReady = true;
                  handleSetQuizQuestions(jsonResponse.quizQuestions);
                } else if (
                  jsonResponse.message === "Podcast too long to transcribe"
                ) {
                  console.log("too long!");
                  llmReady = false;
                }
                // else {
                //   handleSetStatusMessage({
                //     message: "LLM ready",
                //     type: "info",
                //   });
                //   llmReady = true;
                // }
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
        handleSetLLMReady(llmReady);
      })
      .catch((err) => {
        console.log("err", err);
        handleSetStatusMessage({
          message: "Unexpected error! My bad...",
          type: "info",
        });
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
          {episodes.map((episode, index) => {
            return (
              <MenuItem key={`episodeItem${index}`} value={episode.url}>
                {episode.title}
              </MenuItem>
            );
          })}
        </Select>
      </FormControl>
    </Box>
  );
}
