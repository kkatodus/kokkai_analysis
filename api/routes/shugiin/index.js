import express from 'express';
const router = express.Router();

//endpoint for commitee names and members
router.get('/commitee', getCommiteeNames)
//endpoint for returning all the representatives
router.get('/repr', getRepresentatives);

export default router;