import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import React, { useState } from "react";
export function QueryForm({
  llmReady,
  handleSetQueryResults,
  handleSetStatusMessage,
  quizQuestion,
  mode,
}) {
  const [query, setQuery] = React.useState("");
  const [totalPoints, setTotalPoints] = useState(0); //current quiz question

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
      body: JSON.stringify({ query, mode }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (mode === "quiz") {
          console.log("isCorrect?", data.isCorrect ? "true" : "false");
          if (data.isCorrect) {
            let curPoints = totalPoints;
            setTotalPoints((curPoints += 1));
            handleSetStatusMessage({
              message: data.isCorrect ? "Correct!" : "Incorrect!",
              type: data.isCorrect ? "success" : "error",
            });
          }
        }
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
        {quizQuestion && mode === "quiz" && (
          <Typography
            component="h5"
            variant="h6"
            align="left"
            color="primary.main"
            gutterBottom
            sx={{ mb: 2 }}
          >
            {quizQuestion}
          </Typography>
        )}
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
        {totalPoints !== null && <Typography>Points: {totalPoints}</Typography>}
      </Box>
    </div>
  );
}
