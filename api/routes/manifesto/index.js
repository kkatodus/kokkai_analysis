import express from "express";
import { getPartyManifesto } from "./getPartyManifesto.js";
import { getAvailableParties } from "./getAvailableParties.js";

const router = express.Router();

// Get list of available parties
router.get("/parties", getAvailableParties);

// Get manifesto data for a specific party
router.get("/party/:partyName", getPartyManifesto);

export default router;