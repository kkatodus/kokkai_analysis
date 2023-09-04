import express from "express";
import { getSpeechSummary } from "./getSpeechSummary.js";
import { getReprOpinions } from "./getReprOpinions.js";
import { getOneSummary } from "./getOneSummary.js";
const router = express.Router();

//endpoint for speech reprs
router.get("", getSpeechSummary);

//endpoint for one speech repr summary
router.get("/:party/:reprName", getOneSummary);

//endpoint for repr opinion
router.get("/opinion/:party/:reprName/:topic/:idx", getReprOpinions);

export default router;
