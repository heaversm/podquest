import React from "react";

import { Link, Box, Container, Typography } from "@mui/material";

import { deepPurple, amber, blueGrey } from "@mui/material/colors";

export function Feedback() {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box
        maxWidth="md"
        sx={{
          display: "flex",
          justifyContent: "center",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <Typography variant="h6" component="h4">
          Thoughts?
        </Typography>
        <Typography>
          <Link
            color={deepPurple[700]}
            href="https://docs.google.com/forms/d/10qZrQpWpTjVul9fgbLVvC-b563xlu_xQRbREy1OwbaE/edit#settings"
          >
            {" "}
            Take the survey
          </Link>
          , or contact{" "}
          <Link href="mailto:mheavers@mozilla.com?subject='Podquest'">
            mheavers@mozilla.com
          </Link>{" "}
          or @mheavers on Slack.
        </Typography>
      </Box>
    </Container>
  );
}
