import express from "express";
import { getDistrctReprs } from "./getCommiteeNames.js";
const router = express.Router();

router.get("/:district_name", getDistrctReprs);

export default router;
