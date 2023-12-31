import express from "express";
import { getSpeechSummary } from "./getSpeechSummary.js";
import { getReprOpinions } from "./getReprOpinions.js";
import { getOneSummary } from "./getOneSummary.js";
import { getTopicVisualization } from "./getTopicVisualization.js";

const router = express.Router();

router.get("", getSpeechSummary);

//endpoint for speech reprs summary
router.get("/:house", getSpeechSummary);

//endpoint for one speech repr summary
router.get("/:house/:party/:reprName", getOneSummary);

//endpoint for repr opinion
router.get("/opinion/:house/:party/:reprName/:topic", getReprOpinions);

router.get("/visualization/:topic", getTopicVisualization);

export default router;
