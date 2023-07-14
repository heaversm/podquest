import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";

import React from "react";
export function QueryForm({ llmReady, handleSetQueryResults }) {
  const [query, setQuery] = React.useState("");

  const handleQuerySearch = (e) => {
    e.preventDefault();
    console.log("query", query);
    fetch("/api/performUserQuery", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    })
      .then((res) => res.json())
      .then((data) => {
        console.log("data", data);
        handleSetQueryResults(data.text);
      })
      .catch((err) => {
        console.log("err", err);
      });
  };

  return (
    <>
      {llmReady && (
        <div className="PodcastFormContainer">
          <Box
            component="form"
            sx={{
              m: 2,
              display: "flex",
            }}
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
              sx={{
                mr: 2,
              }}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
            />
            <Button type="submit" variant="contained">
              Submit
            </Button>
          </Box>
        </div>
      )}
    </>
  );
}
