import React, { useEffect } from "react";
import Typography from "@mui/material/Typography";
import Container from "@mui/material/Container";
import { Link } from "@mui/material";
import Button from "@mui/material/Button";

import { deepPurple, amber, blueGrey } from "@mui/material/colors";
const colorSubtext = blueGrey[400];

export function PageIntro({ handleSetMode, handleSetStatusMessage }) {
  return (
    <Container maxWidth="md">
      <Typography
        component="h1"
        variant="h2"
        align="center"
        color="primary.main"
        gutterBottom
      >
        <Link
          onClick={() => {
            handleSetMode(null);
          }}
          sx={{ cursor: "pointer" }}
        >
          PodQuest
        </Link>
      </Typography>
      <Typography
        component="h2"
        variant="subtitle1"
        align="center"
        color={colorSubtext}
        gutterBottom
      >
        Answers to any question about your favorite podcast episodes
      </Typography>
    </Container>
  );
}
