import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import Link from "@mui/material/Link";
import React from "react";
export function ResultsContainer({ podcasts }) {
  return (
    <div className="podcastContainer">
      {
        //display an unordered list of podcasts
        <List>
          {podcasts &&
            podcasts.length > 0 &&
            podcasts.map((podcast) => {
              return (
                <ListItem key={podcast.title}>
                  <Link className="podcast" href={podcast.url}>
                    {podcast.title}
                  </Link>
                </ListItem>
              );
            })}
        </List>
      }
    </div>
  );
}
