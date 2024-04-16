import express from "express";
import { getSenkyokuPolygonData } from "./getSenkyokuPolygonData.js";

const router = express.Router();

router.get("/senkyokuPolydata", getSenkyokuPolygonData);

export default router;
