import ListItem from "@mui/material/ListItem";
import Link from "@mui/material/Link";
import React from "react";

import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
import MenuItem from "@mui/material/MenuItem";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import Box from "@mui/material/Box";

export function QueryResults({ queryResults }) {
  return (
    <>
      {queryResults && queryResults.length ? (
        <Box
          className="queryResultsContainer"
          sx={{
            display: "flex",
          }}
        >
          {queryResults}
        </Box>
      ) : null}
    </>
  );
}
