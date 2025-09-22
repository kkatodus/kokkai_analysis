import express from "express";
import cors from "cors";
const app = express();

var listener = app.listen(process.env.PORT || 5000, "0.0.0.0", function () {
  console.log("Your app is listening on port " + listener.address().port);
});
const allowedOrigins = [
  "http://localhost:3000",
  "https://www.kokkaidoc.com",
  "https://kokkaidoc.com",
  "https://deploy-preview",
];
app.use(express.static("public"));
app.use(
  cors({
    origin(origin, cb) {
      // allow non-browser tools with no Origin for GETs if you want; here we're strict:
      if (!origin) return cb(new Error("CORS blocked"));

      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        return cb(null, true);
      }

      // Check for deploy preview patterns (Netlify/Vercel)
      if (
        origin.includes("deploy-preview") ||
        origin.includes("vercel.app") ||
        origin.match(/https:\/\/.*\.netlify\.app$/)
      ) {
        return cb(null, true);
      }

      return cb(new Error("CORS blocked for origin " + origin));
    },
    credentials: true,
  })
);
app.use(express.json());

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
  "available parties": "manifesto/parties",
  "party manifesto data": "manifesto/party/:partyName",
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

import geoRouter from "./routes/geo/index.js";
app.use("/geo", geoRouter);

import reprRouter from "./routes/reprs/index.js";
app.use("/reprs", reprRouter);

import paymentRouter from "./routes/payment/index.js";
app.use("/payment", paymentRouter);

import donorsRouter from "./routes/donors/index.js";
app.use("/donors", donorsRouter);

import policyRouter from "./routes/policy/index.js";
app.use("/policy", policyRouter);

import manifestoRouter from "./routes/manifesto/index.js";
app.use("/manifesto", manifestoRouter);
