import ListItem from "@mui/material/ListItem";
import Link from "@mui/material/Link";
import React, { useEffect, useState } from "react";

import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
import MenuItem from "@mui/material/MenuItem";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import Box from "@mui/material/Box";
import { Typography } from "@mui/material";
import { TypeAnimation } from "react-type-animation";

export function QueryResults({ queryResults, gameOver }) {
  const [queryDisplay, setQueryDisplay] = useState();

  useEffect(() => {
    if (queryResults) {
      setQueryDisplay(queryResults);
    }
  }, [queryResults]);
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
      <Typography fontStyle={"italic"}>
        {queryDisplay && (
          <TypeAnimation
            sequence={[queryDisplay]}
            wrapper="span"
            speed={50}
            // repeat={Infinity}
          />
        )}
      </Typography>
    </Box>
  );
}
