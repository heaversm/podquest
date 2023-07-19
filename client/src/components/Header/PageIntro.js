import React, { useEffect } from "react";
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
import Alert from "@mui/material/Alert";

import { deepPurple, amber, blueGrey } from "@mui/material/colors";
const colorSubtext = blueGrey[400];
const cards = [
  {
    title: "Summaries & highlights",
    text: "Get a rundown on all the key topics, links, and points of discussion.",
    image: "https://source.unsplash.com/random?wallpapers",
  },
  {
    title: "Jump to the good parts",
    text: "Ask Podquest to take you to the specific spot in the audio where something occurred, without having to scrub endlessly through the timeline to find it.",
    image: "https://source.unsplash.com/random?wallpapers",
  },
  {
    title: "Test your knowledge",
    text: "Flip the script and have Podquest ask you questions. Podquest can be used as a study aid or even a classroom tool.",
    image: "https://source.unsplash.com/random?wallpapers",
  },
];

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
      </Container>
      <Box
        sx={{
          mt: 8,
        }}
      >
        <Typography
          gutterBottom
          variant="h4"
          component="h3"
          color="primary.main"
          align="center"
          sx={{
            mb: 4,
          }}
        >
          Use Cases
        </Typography>
        <Grid container spacing={4}>
          {cards.map((card, index) => (
            <Grid item key={`card${index}`} xs={12} sm={6} md={4}>
              <Card
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <CardMedia
                  component="div"
                  sx={{
                    // 16:9
                    pt: "56.25%",
                  }}
                  image={card.image}
                />
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography gutterBottom variant="h5" component="h5">
                    {card.title}
                  </Typography>
                  <Typography>{card.text}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </>
  );
}
