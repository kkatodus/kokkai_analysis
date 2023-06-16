import express from 'express';
import { getCommiteeNames } from './getCommiteeNames.js';
import { getRepresentatives } from './getRepresentatives.js';
const router = express.Router();

//endpoint for commitee names and members
router.get('/commitee', getCommiteeNames)
//endpoint for returning all the representatives
router.get('/repr', getRepresentatives);

export default router;