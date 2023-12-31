import express from "express";
import cors from "cors";
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
  "speech summary": "speeches",
  "lower house speech summary": "speeches/lower",
  "upper house speech summary": "speeches/upper",
  "position stats": "stats/position",
};

app.get("", (request, response) => {
  response.send(api_guide);
});

import sangiinRouter from "./routes/sangiin/index.js";
app.use("/sangiin", sangiinRouter);

import shugiinRouter from "./routes/shugiin/index.js";
app.use("/shugiin", shugiinRouter);

import speechRouter from "./routes/speeches/index.js";
app.use("/speeches", speechRouter);

import statsRouter from "./routes/stats/index.js";
app.use("/stats", statsRouter);
