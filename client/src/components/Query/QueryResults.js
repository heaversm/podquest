import ListItem from "@mui/material/ListItem";
import Link from "@mui/material/Link";
import React from "react";

import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
import MenuItem from "@mui/material/MenuItem";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import Box from "@mui/material/Box";
import { Typography } from "@mui/material";

export function QueryResults({ queryResults }) {
  return (
    <Box
      className="queryResultsContainer"
      border={2}
      borderColor={"primary.main"}
      borderRadius={2}
      padding={2}
      sx={{
        display: "flex",
        mb: 8,
      }}
    >
      <Typography fontStyle={"italic"}>{queryResults}</Typography>
    </Box>
  );
}
