import express, { Router } from "express";
import serverless from "serverless-http";

const app = express();

var listener = app.listen(process.env.PORT || 5000, function () {
  console.log("Your app is listening on port " + listener.address().port);
});
app.use(express.static("public"));
app.use(cors());

//endpoint for api guide
var api_guide = {
  "sangiin meeting names": "sangiin/meeting_names",
  "sangiin commitee names": "sangiin/commitee",
  "sangiin representatives": "sangiin/repr",
  "sangiin vote results": "sangiin/sangiin_meeting_votes/:meeting_name",
  "sangiin party opinions":
    "sangiin/sangiin_party_opinions/:meeting_name/:topic_name",
  "shugiin commitees": "shugiin/commitee",
  "shugiin representatives": "shugiin/repr",
};

app.get("", (request, response) => {
  response.send(api_guide);
});

import sangiinRouter from "../../routes/sangiin/index.js";
app.use("/sangiin", sangiinRouter);

import shugiinRouter from "../../routes/shugiin/index.js";
app.use("/shugiin", shugiinRouter);

export const handler = serverless(app);
