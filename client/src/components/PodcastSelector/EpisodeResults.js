import ListItem from '@mui/material/ListItem';
import Link from '@mui/material/Link';
import React, { useEffect } from 'react';

import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import MenuItem from '@mui/material/MenuItem';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';

let llmReady = false;

export function EpisodeResults({
  episodes,
  handleSetLLMReady,
  handleSetStatusMessage,
  handleSetFilePath,
  handleSetQuizQuestions,
  handlePollForStatus,
  mode,
}) {
  const [episode, setEpisode] = React.useState('');

  useEffect(() => {
    if (episode && episode !== '') {
      handleSetFilePath(episode);
    }
  }, [episode]);

  const handleEpisodeChange = (e, child) => {
    e.preventDefault();
    const episodeUrl = e.target.value;
    const episodeTitle = child.props.children; //the child is the MenuItem component, the children of this is the value of the MenuItem
    console.log(episodeTitle);
    setEpisode(episodeUrl);

    if (!episodeTitle) {
      return;
    }

    handleSetStatusMessage({
      message: 'Transcribing audio, get comfortable...',
      type: 'info',
    });

    fetch('/api/transcribeEpisode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ episodeUrl, mode, episodeTitle }),
    })
      .then((res) => {
        return res.json();
      })
      .then((data) => {
        console.log('transcribeData', data.message);
        // handleSetQuizQuestions(data.quizQuestions);
        handlePollForStatus();
      })
      .catch((err) => {
        console.log('err', err);
      });
  };

  return (
    <Box className="episodesContainer">
      <FormControl sx={{ mt: 2, minWidth: 80 }} fullWidth>
        <InputLabel id="selectEpisodeLabel">
          Select Episode
        </InputLabel>
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
              <MenuItem
                key={`episodeItem${index}`}
                value={episode.url}
              >
                {episode.title}
              </MenuItem>
            );
          })}
        </Select>
      </FormControl>
    </Box>
  );
}
