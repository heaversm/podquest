// client/src/App.js
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

import React, { useEffect, useState, useRef } from 'react';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import CssBaseline from '@mui/material/CssBaseline';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Snackbar from '@mui/material/Snackbar';
import MuiAlert from '@mui/material/Alert';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { deepPurple, amber, blueGrey } from '@mui/material/colors';
// import "./App.css";

import {
  useEventListener,
  useLocalStorage,
} from '@uidotdev/usehooks';

import { PodcastForm } from './components/PodcastSelector/PodcastForm';
import { PodcastResults } from './components/PodcastSelector/PodcastResults';
import { EpisodeResults } from './components/PodcastSelector/EpisodeResults';
import { QueryForm } from './components/Query/QueryForm';
import { QueryResults } from './components/Query/QueryResults';
import { PageIntro } from './components/Header/PageIntro';
import { ModeSelector } from './components/Header/ModeSelector';
import { Footer } from './components/Footer/Footer';
import { Feedback } from './components/Feedback/Feedback';

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
  return (
    <MuiAlert elevation={6} ref={ref} variant="outlined" {...props} />
  );
});

function App() {
  const [podcasts, setPodcasts] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [queryResults, setQueryResults] = useState([]);
  const [llmReady, setLLMReady] = useState(false);
  const [statusMessage, setStatusMessage] = useState(); //e.g message: "Waiting for user input...", type: "info","open: true"
  const [mode, setMode] = useState(null); //qa or audio
  const [filePath, setFilePath] = useState(null); //path to audio file on server
  const [timeStamp, setTimestamp] = useState(null); //timestamp of audio file
  const [episodeId, setEpisodeId] = useState(null); //stores the db episode id of the searched for podcast
  const [userId, setUserId] = useLocalStorage('podquestId', null);

  const handleStatusClose = (event, reason) => {
    if (reason === 'clickaway') {
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

  const handleSetEpisodeId = (id) => {
    console.log('setting episode id', id);
    setEpisodeId(id);
  };

  const resetUserLLM = async () => {
    return new Promise((resolve, reject) => {
      fetch('/api/resetUserLLM', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: userId }),
      })
        .then((res) => {
          return res.json();
        })
        .then((data) => {
          resolve(data.status);
        })
        .catch((err) => {
          console.log('err', err);
          reject(err);
        });
    });
  };

  const testCoral = () => {
    console.log('testCoral');
    fetch('/api/coral/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: '' }),
    })
      .then((res) => {
        return res.json();
      })
      .then((data) => {
        console.log('data', data);
      })
      .catch((err) => {
        console.log('err', err);
      });
  };

  const getEpisodeId = () => {
    console.log('get episode id from server', filePath);
    fetch('/api/getEpisodeId', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ episodeUrl: filePath }),
    })
      .then((res) => {
        return res.json();
      })
      .then((data) => {
        console.log('episode id', data.episodeId);
        setEpisodeId(data.episodeId);
      })
      .catch((err) => {
        console.log('err', err);
      });
  };

  const handlePollForStatus = () => {
    fetch('/api/getStatus', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    })
      .then((res) => {
        return res.json();
      })
      .then((data) => {
        console.log('status data', data.status);
        if (data.status === 'ready') {
          console.log('llm ready');

          setLLMReady(true);
          setStatusMessage({
            message: 'LLM Ready!',
            type: 'info',
          });
        } else {
          handleSetStatusMessage({
            message: data.status,
            type: 'info',
          });
          setTimeout(handlePollForStatus, 5000);
        }
      })
      .catch((err) => {
        console.log('err', err);
      });
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
    if (mode === null) {
      setMode(null);
      setStatusMessage(null);
      setQueryResults([]);
    } else {
      setMode(`${mode}`);
    }
  };

  const handleSetFilePath = (path) => {
    setFilePath(path);
  };

  const assignNewUserId = async () => {
    return new Promise((resolve, reject) => {
      //we need to get the user id from the server
      console.log('getting new user id from server');
      fetch('/api/getUserId', {
        method: 'GET',
      })
        .then((res) => {
          return res.json();
        })
        .then((data) => {
          if (data.id) {
            console.log('user id set:', data.id);
            setUserId(data.id);
            resolve(data.id);
          }
        })
        .catch((err) => {
          reject(`Error getting user id: ${err}`);
        });
    });
  };

  useEffect(() => {
    if (statusMessage?.message === 'Searching for answers...') {
      setQueryResults([]);
    }
  }, [statusMessage]);

  useEffect(() => {
    if (podcasts && podcasts.length > 0) {
      handleSetStatusMessage({
        message: 'Podcasts found',
        type: 'info',
      });
    }
  }, [podcasts]);

  useEffect(() => {
    if (llmReady && !episodeId) {
      getEpisodeId();
    }
  }, [llmReady]);

  const parseTimestampToSeconds = (timestamp) => {
    // Timestamp format: "hh:mm:ss,SSS"
    const [hours, minutes, seconds] = timestamp
      .split(':')
      .map(parseFloat);
    return hours * 3600 + minutes * 60 + seconds;
  };

  const timestampRegex = /\d{2}:\d{2}:\d{2},\d{3}/;

  const searchForTimestamp = (queryResults) => {
    // Search for the first match in the text
    const firstTimestampMatch = queryResults.match(timestampRegex);

    // Extract the first timestamp or handle the case when no timestamp is found
    const firstTimestamp = firstTimestampMatch
      ? firstTimestampMatch[0]
      : null;
    return firstTimestamp;
  };

  const audioRef = useRef(null);

  useEffect(() => {
    if (mode === 'audio' && queryResults.length > 0) {
      //tell audio player to go to timestamp queryResults.timestamp
      const timeStampMatch = searchForTimestamp(queryResults);
      if (timeStampMatch) {
        const jumpTime = parseTimestampToSeconds(timeStampMatch);
        setTimestamp(jumpTime);
      }
    }
  }, [queryResults]);

  useEffect(() => {
    if (timeStamp !== null && audioRef.current) {
      audioRef.current.currentTime = timeStamp;
      setStatusMessage({
        message: `Skipping to ${timeStamp} seconds`,
        type: 'info',
      });
      audioRef.current.play();
    }
  }, [timeStamp]);

  useEffect(() => {
    const handleLoad = async () => {
      console.log('loaded');
      if (userId) {
        console.log('user exists, resetting llm status', userId);
        const userStatus = await resetUserLLM();
      } else {
        console.log('user does not exist');
        const assignedId = await assignNewUserId();
        console.log('assignedId', assignedId);
      }
    };
    window.addEventListener('load', handleLoad);
    return () => {
      window.removeEventListener('load', handleLoad);
    };
  }, []);

  return (
    <ThemeProvider theme={myTheme}>
      <CssBaseline />
      <main className="App">
        <Box
          sx={{
            bgcolor: 'background.paper',
            pt: 4,
            pb: 6,
          }}
        >
          <Container maxWidth="md">
            <PageIntro
              handleSetMode={handleSetMode}
              handleSetStatusMessage={handleSetStatusMessage}
            />
            <Button onClick={testCoral}>Test Coral</Button>
            {!mode && <ModeSelector handleSetMode={handleSetMode} />}
            {mode && (
              <Box
                align="center"
                className="formContainer"
                sx={{ mt: 8 }}
              >
                {llmReady ? (
                  <Box sx={{ mt: 8 }}>
                    <Typography
                      component="h4"
                      variant="h5"
                      align="left"
                      color="primary.main"
                      gutterBottom
                      sx={{ mb: 2 }}
                    >
                      Step 2:{' '}
                      {mode === 'audio'
                        ? 'Jump to the good parts'
                        : 'Get answers'}
                    </Typography>
                    {queryResults && queryResults.length > 0 && (
                      <QueryResults queryResults={queryResults} />
                    )}

                    <QueryForm
                      llmReady={llmReady}
                      handleSetQueryResults={handleSetQueryResults}
                      handleSetStatusMessage={handleSetStatusMessage}
                      mode={mode}
                      episodeId={episodeId}
                      userId={userId}
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
                        handleSetStatusMessage={
                          handleSetStatusMessage
                        }
                      />
                    )}
                    {episodes.length > 0 && (
                      <EpisodeResults
                        episodes={episodes}
                        handleSetEpisodeId={handleSetEpisodeId}
                        mode={mode}
                        handleSetLLMReady={handleSetLLMReady}
                        handleSetStatusMessage={
                          handleSetStatusMessage
                        }
                        handleSetFilePath={handleSetFilePath}
                        handlePollForStatus={handlePollForStatus}
                        userId={userId}
                      />
                    )}
                  </>
                )}
              </Box>
            )}
          </Container>
        </Box>
        {mode === 'audio' && llmReady && filePath && (
          <Container maxWidth="md">
            <Box
              maxWidth="md"
              sx={{
                display: 'flex',
                mb: 4,
                justifyContent: 'center',
              }}
            >
              <audio
                ref={audioRef}
                id="audioPlayer"
                controls
                src={filePath}
              >
                Your browser does not support the audio element.
              </audio>
            </Box>
          </Container>
        )}
        <Footer llmReady={llmReady} userId={userId} />
        <Feedback />
        {statusMessage && (
          <Snackbar
            className="statusContainer"
            open={true}
            // autoHideDuration={6000}
            onClose={handleStatusClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'center',
            }}
          >
            <Alert
              variant="outlined"
              severity={statusMessage.type}
              sx={{ bgcolor: 'background.paper' }}
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
