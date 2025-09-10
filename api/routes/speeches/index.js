import express from "express";
import { getSpeechSummary } from "./getSpeechSummary.js";
import { getReprOpinions } from "./getReprOpinions.js";
import { getOneSummary } from "./getOneSummary.js";
import { getTopicVisualization } from "./getTopicVisualization.js";
import { getStaticAvailabilities } from "./getStaticAvailabilities.js";
import { getDiachronicAvailabilities } from "./getDiachronicAvailabilities.js";
import { getStaticData } from "./getStaticData.js";
import { getDiachronicData } from "./getDiachronicData.js";

const router = express.Router();

router.get("", getSpeechSummary);

// //endpoint for one speech repr summary
router.get("/summary/:party/:reprName", getOneSummary);

// //endpoint for repr opinion
router.get("/opinion/:party/:reprName/:topic", getReprOpinions);

//endpoint for topic scatter visualization
router.get("/visualization/:topic", getTopicVisualization);

//endpoint for static availabilities
router.get("/static", getStaticAvailabilities);

//endpoint for diachronic availabilities
router.get("/diachronic", getDiachronicAvailabilities);

//endpoint for diachronic data
router.get("/diachronic/:topic/:axis", getDiachronicData);

//endpoint for static data
router.get("/static/:topic/:axis", getStaticData);



export default router;
