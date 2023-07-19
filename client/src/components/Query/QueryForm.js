import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";

import React from "react";
export function QueryForm({
  llmReady,
  handleSetQueryResults,
  handleSetStatusMessage,
}) {
  const [query, setQuery] = React.useState("");

  const handleQuerySearch = (e) => {
    e.preventDefault();
    handleSetStatusMessage({
      message: "Searching for answers...",
      type: "info",
    });
    fetch("/api/performUserQuery", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    })
      .then((res) => res.json())
      .then((data) => {
        handleSetQueryResults(data.text);
      })
      .catch((err) => {
        console.log("err", err);
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
          label="Question"
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
