import React, { useEffect, useState, useRef } from "react";

import { Link, Button, Typography, Container, Box } from "@mui/material";

import { deepPurple, amber, blueGrey } from "@mui/material/colors";
const colorSubtext = blueGrey[400];

export function Footer({ llmReady }) {
  const [blobUrl, setBlobUrl] = React.useState(null);
  const transcriptLink = useRef();

  useEffect(() => {
    if (blobUrl) {
      transcriptLink.current.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }, 100);
    }
  }, [blobUrl]);

  const downloadTranscript = (e) => {
    e.preventDefault();
    // handleSetStatusMessage({
    //   message: "Downloading transcript...",
    //   type: "info",
    // });
    fetch("/api/downloadTranscript", {
      method: "GET",
    })
      .then((res) => res.json())
      .then((data) => {
        //MH TODO: make react-y
        // console.log("data", data);
        const file = new Blob([data.transcription], {
          type: "text/plain;charset=utf-8",
        });
        const blobjectUrl = window.URL.createObjectURL(file);
        setBlobUrl(blobjectUrl);
      })
      .catch((err) => {
        console.log("err", err);
      });
  };

  const disclaimer =
    "NOTE: Downloading, transcribing, and training an LLM on your search CAN TAKE SEVERAL MINUTES. Relax. Pet your dog. Grab a snack!";

  return (
    <Container maxWidth="sm">
      {llmReady ? (
        <Box justifyContent="center" display="flex">
          {blobUrl ? (
            <Link download="transcript.srt" href={blobUrl} ref={transcriptLink}>
              Downloading...
            </Link>
          ) : (
            <Button align="center" display="block" onClick={downloadTranscript}>
              Download transcript
            </Button>
          )}
        </Box>
      ) : (
        <Typography variant="caption" align="center" display="block">
          {disclaimer}
        </Typography>
      )}
    </Container>
  );
}
