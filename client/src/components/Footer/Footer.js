import React, { useEffect } from "react";
import Typography from "@mui/material/Typography";
import Container from "@mui/material/Container";

import { deepPurple, amber, blueGrey } from "@mui/material/colors";
const colorSubtext = blueGrey[400];

export function Footer() {
  const disclaimer =
    "NOTE: Downloading, transcribing, and training an LLM on your search CAN TAKE SEVERAL minutes. Relax. Pet your dog. Grab a snack, Breathe...";

  return (
    <Container maxWidth="sm">
      <Typography variant="caption" align="center" display="block">
        {disclaimer}
      </Typography>
    </Container>
  );
}
