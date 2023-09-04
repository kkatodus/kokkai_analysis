import express from "express";
import { getSpeechSummary } from "./getSpeechSummary.js";
const router = express.Router();

//endpoint for speech reprs
router.get("", getSpeechSummary);

export default router;
