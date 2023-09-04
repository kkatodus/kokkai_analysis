import express from "express";
import { getSpeechSummary } from "./getSpeechSummary.js";
import { getReprOpinions } from "./getReprOpinions.js";
const router = express.Router();

//endpoint for speech reprs
router.get("", getSpeechSummary);

//endpoint for repr opinion
router.get("/opinion/:reprName", getReprOpinions);

export default router;
