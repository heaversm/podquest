import React, { useEffect } from "react";
import Typography from "@mui/material/Typography";
import Container from "@mui/material/Container";

import { deepPurple, amber, blueGrey } from "@mui/material/colors";
const colorSubtext = blueGrey[400];

export function PageIntro() {
  return (
    <>
      <Container>
        <Typography
          component="h1"
          variant="h2"
          align="center"
          color="primary.main"
          gutterBottom
        >
          PodQuest
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
        <Typography variant="caption" align="center" display="block">
          Note: I can only transcribe podcasts of around 20MB currently (I
          know...). I'm working on it!
        </Typography>
      </Container>
    </>
  );
}
