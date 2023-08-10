// client/src/App.js
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";

import React, { useEffect, useState, useRef } from "react";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import CssBaseline from "@mui/material/CssBaseline";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Container from "@mui/material/Container";
import Link from "@mui/material/Link";
// import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { deepPurple, amber, blueGrey } from "@mui/material/colors";
// import "./App.css";

import { PodcastForm } from "./components/PodcastSelector/PodcastForm";
import { PodcastResults } from "./components/PodcastSelector/PodcastResults";
import { EpisodeResults } from "./components/PodcastSelector/EpisodeResults";
import { QueryForm } from "./components/Query/QueryForm";
import { QueryResults } from "./components/Query/QueryResults";
import { PageIntro } from "./components/Header/PageIntro";
import { ModeSelector } from "./components/Header/ModeSelector";

//colors:
// https://mui.com/material-ui/customization/color/#color-palette
const myTheme = createTheme({
  palette: {
    primary: {
      main: deepPurple[700],
    },
    secondary: {
      main: amber[400],
    },
  },
});

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="outlined" {...props} />;
});

function App() {
  const [podcasts, setPodcasts] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [queryResults, setQueryResults] = useState([]);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [llmReady, setLLMReady] = useState(false);
  const [statusMessage, setStatusMessage] = useState(); //e.g message: "Waiting for user input...", type: "info","open: true"
  const [mode, setMode] = useState(null); //qa, audio, or quiz
  const [filePath, setFilePath] = useState(null); //path to audio file on server
  const [timeStamp, setTimestamp] = useState(null); //timestamp of audio file
  const [quizQuestion, setCurQuizQuestion] = useState(null); //current quiz question

  const prevQueryResults = useRef([]);

  const handleStatusClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }

    setStatusMessage(null);
  };

  const handleSetPodcasts = (podcastList) => {
    setPodcasts(podcastList);
  };

  const handleSetEpisodes = (episodesList) => {
    // console.log(episodesList);
    setEpisodes(episodesList);
  };

  const handleSetQueryResults = (queryResultsList) => {
    setQueryResults(queryResultsList);
  };

  const handleSetLLMReady = (llmReady) => {
    setLLMReady(llmReady);
  };

  const handleSetStatusMessage = (status) => {
    setStatusMessage(status);
  };

  const handleSetMode = (mode) => {
    setMode(`${mode}`);
  };

  const handleSetFilePath = (path) => {
    setFilePath(path);
  };

  const handleSetQuizQuestions = (questions) => {
    console.log("setting quiz questions", questions);
    setQuizQuestions(questions);
  };

  useEffect(() => {
    if (statusMessage?.message === "Searching for answers...") {
      setQueryResults([]);
    }
  }, [statusMessage]);

  useEffect(() => {
    if (podcasts && podcasts.length > 0) {
      handleSetStatusMessage({
        message: "Podcasts found",
        type: "info",
      });
    }
  }, [podcasts]);

  useEffect(() => {
    if (episodes && episodes.length > 0) {
      handleSetStatusMessage({
        message: "Episodes found",
        type: "info",
      });
    }
  }, [episodes]);

  useEffect(() => {
    console.log("app llm ready", llmReady);
  }, [llmReady]);

  useEffect(() => {
    console.log("quizQuestions", quizQuestions);
    if (quizQuestions.length > 0) {
      console.log("Picking random quiz question");
      const curQuizQuestion = pickRandomQuizQuestion();
      setCurQuizQuestion(curQuizQuestion);
    }
  }, [quizQuestions]);

  // useEffect(() => {
  //   console.log("quizQuestion", quizQuestion);
  //   if (quizQuestion !== null) {
  //     setQueryResults([quizQuestion]); //not implementing
  //   }
  // }, [quizQuestion]);

  const pickRandomQuizQuestion = () => {
    const randomQuizQuestion =
      quizQuestions[Math.floor(Math.random() * quizQuestions.length)];
    console.log("randomQuizQuestion", randomQuizQuestion);
    return randomQuizQuestion;
  };

  const parseTimestampToSeconds = (timestamp) => {
    // Timestamp format: "hh:mm:ss,SSS"
    const [hours, minutes, seconds] = timestamp.split(":").map(parseFloat);
    return hours * 3600 + minutes * 60 + seconds;
  };

  const timestampRegex = /\d{2}:\d{2}:\d{2},\d{3}/;

  const searchForTimestamp = (queryResults) => {
    // Search for the first match in the text
    const firstTimestampMatch = queryResults.match(timestampRegex);

    // Extract the first timestamp or handle the case when no timestamp is found
    const firstTimestamp = firstTimestampMatch ? firstTimestampMatch[0] : null;
    return firstTimestamp;
  };

  const fetchQuizQuestions = async () => {
    console.log("fetch quiz questions");
    const response = await fetch("/api/process-questions", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();
    console.log(data);
    return data.quizQuestions;
  };

  const audioRef = useRef(null);

  useEffect(() => {
    if (mode === "audio" && queryResults.length > 0) {
      //tell audio player to go to timestamp queryResults.timestamp
      const timeStampMatch = searchForTimestamp(queryResults);
      if (timeStampMatch) {
        const jumpTime = parseTimestampToSeconds(timeStampMatch);
        setTimestamp(jumpTime);
      }
    } else if (mode === "quiz") {
      const curQuizQuestion = pickRandomQuizQuestion();
      setCurQuizQuestion(curQuizQuestion);
    }
  }, [queryResults]);

  useEffect(() => {
    if (timeStamp !== null && audioRef.current) {
      audioRef.current.currentTime = timeStamp;
      setStatusMessage({
        message: `Moving audio to ${timeStamp} seconds`,
        type: "success",
      });
    }
  }, [timeStamp]);

  return (
    <ThemeProvider theme={myTheme}>
      <CssBaseline />
      <main className="App">
        <Box
          sx={{
            bgcolor: "background.paper",
            pt: 8,
            pb: 6,
          }}
        >
          <Container maxWidth="md">
            <PageIntro handleSetMode={handleSetMode} />
            {!mode ? (
              <ModeSelector handleSetMode={handleSetMode} />
            ) : (
              <Box align="center" className="formContainer" sx={{ mt: 8 }}>
                {llmReady ? (
                  <Box sx={{ mt: 8 }}>
                    {mode === "quiz" && quizQuestion ? (
                      <>
                        <Typography
                          component="h4"
                          variant="h5"
                          align="left"
                          color="primary.main"
                          gutterBottom
                          sx={{ mb: 2 }}
                        >
                          Step 2: Answer Questions
                        </Typography>
                      </>
                    ) : (
                      <Typography
                        component="h4"
                        variant="h5"
                        align="left"
                        color="primary.main"
                        gutterBottom
                        sx={{ mb: 2 }}
                      >
                        Step 2: Get Answers
                      </Typography>
                    )}

                    {queryResults && queryResults.length > 0 && (
                      <QueryResults queryResults={queryResults} />
                    )}
                    <QueryForm
                      llmReady={llmReady}
                      handleSetQueryResults={handleSetQueryResults}
                      handleSetStatusMessage={handleSetStatusMessage}
                      quizQuestion={quizQuestion}
                      mode={mode}
                    />
                  </Box>
                ) : (
                  <>
                    <Typography
                      component="h4"
                      variant="h5"
                      align="left"
                      color="primary.main"
                      gutterBottom
                      sx={{ mb: 4 }}
                    >
                      Step 1: Find Your Episode
                    </Typography>
                    <PodcastForm
                      handleSetPodcasts={handleSetPodcasts}
                      handleSetStatusMessage={handleSetStatusMessage}
                    />
                    {podcasts.length > 0 && (
                      <PodcastResults
                        podcasts={podcasts}
                        handleSetEpisodes={handleSetEpisodes}
                        handleSetStatusMessage={handleSetStatusMessage}
                      />
                    )}
                    {episodes.length > 0 && (
                      <EpisodeResults
                        episodes={episodes}
                        mode={mode}
                        handleSetLLMReady={handleSetLLMReady}
                        handleSetStatusMessage={handleSetStatusMessage}
                        handleSetFilePath={handleSetFilePath}
                        handleSetQuizQuestions={handleSetQuizQuestions}
                      />
                    )}
                  </>
                )}
              </Box>
            )}
          </Container>
        </Box>
        {mode === "audio" && llmReady && filePath && (
          <Container maxWidth="md">
            <Box
              maxWidth="md"
              sx={{ display: "flex", justifyContent: "center" }}
            >
              <audio ref={audioRef} id="audioPlayer" controls src={filePath}>
                Your browser does not support the audio element.
              </audio>
            </Box>
          </Container>
        )}
        {statusMessage && (
          <Snackbar
            className="statusContainer"
            open={true}
            autoHideDuration={6000}
            onClose={handleStatusClose}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          >
            <Alert
              variant="outlined"
              severity={statusMessage.type}
              sx={{ bgcolor: "background.paper" }}
              // onClose={handleStatusClose}
            >
              {statusMessage.message}
            </Alert>
          </Snackbar>
        )}
      </main>
    </ThemeProvider>
  );
}

export default App;
