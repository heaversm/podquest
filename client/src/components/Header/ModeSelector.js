import React, { useEffect } from "react";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Grid from "@mui/material/Grid";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { deepPurple, amber, blueGrey } from "@mui/material/colors";
const cards = [
  {
    title: "Questions and highlights",
    text: "Get answers to your questions, or get a rundown on key topics, links, and points of discussion.",
    image: "/tile-qa.jpg",
    id: "qa",
  },
  {
    title: "Jump to the good parts",
    text: "Ask Podquest to take you to the specific spot in the audio where something occurred, without having to scrub endlessly through the timeline to find it.",
    image: "/tile-skip.jpg",
    id: "audio",
  },
  {
    title: "Test your knowledge",
    text: "Flip the script and have Podquest ask you questions to see what you remember. Podquest can be used as a study aid or even a classroom tool.",
    image: "/tile-test.jpg",
    id: "quiz",
  },
];

export function ModeSelector({ handleSetMode }) {
  return (
    <>
      <Box
        sx={{
          mt: 4,
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
          Step 1: Select Your Use Case:
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
                <CardContent
                  sx={{ display: "flex", flexGrow: 1, flexDirection: "column" }}
                >
                  <Typography gutterBottom variant="h5" component="h5">
                    {card.title}
                  </Typography>
                  <Typography sx={{ mb: 2 }}>{card.text}</Typography>
                  <Button
                    variant="contained"
                    fullWidth
                    sx={{
                      mt: "auto",
                    }}
                    onClick={() => {
                      handleSetMode(card.id);
                    }}
                  >
                    Select
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </>
  );
}
