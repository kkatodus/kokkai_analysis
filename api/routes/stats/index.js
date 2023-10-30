import express from "express";
import { getCity2PosCSV } from "./getCity2PosCSV.js";
import { getCity2PosJSON } from "./getCity2PosJSON.js";
import { getCityPopulationOverYears } from "./getCityPopulationOverYears.js";

const router = express.Router();

router.get("/city2poscsv", getCity2PosCSV);
router.get("/city2posjson", getCity2PosJSON);
router.get("/city_population_over_years", getCityPopulationOverYears);

export default router;
