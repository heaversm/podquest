import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import React, { useState, useEffect } from 'react';
export function QueryForm({
  llmReady,
  handleSetQueryResults,
  handleSetStatusMessage,
  mode,
  episodeId,
  userId,
}) {
  const [query, setQuery] = React.useState('');

  const handleQuerySearch = (e) => {
    e.preventDefault();
    handleSetStatusMessage({
      message: 'Searching for answers...',
      type: 'info',
    });
    fetch('/api/performUserQuery', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        mode,
        episodeId: episodeId,
        userId: userId ? userId : null,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        handleSetStatusMessage(null);
        handleSetQueryResults(data.text);
      })
      .catch((err) => {
        console.log('err', err);
      });
  };

  return (
    <div className="PodcastFormContainer">
      <Box
        component="form"
        noValidate
        autoComplete="off"
        onSubmit={handleQuerySearch}
      >
        <TextField
          type="text"
          label="Input"
          id="query"
          name="query"
          size="small"
          fullWidth
          sx={{
            mr: 2,
          }}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          value={query}
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
    </div>
  );
}
