import express from "express";
import { getSpeechSummary } from "./getSpeechSummary.js";
import { getReprOpinions } from "./getReprOpinions.js";
import { getOneSummary } from "./getOneSummary.js";
import { getTopicVisualization } from "./getTopicVisualization.js";

const router = express.Router();

router.get("", getSpeechSummary);

// //endpoint for one speech repr summary
router.get("/summary/:party/:reprName", getOneSummary);

// //endpoint for repr opinion
router.get("/opinion/:party/:reprName/:topic", getReprOpinions);

//endpoint for topic scatter visualization
router.get("/visualization/:topic", getTopicVisualization);

export default router;
