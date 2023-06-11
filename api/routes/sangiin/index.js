import express from 'express';
import { getMeetingNames, searchSangiinMeeting } from './searchSangiinMeeting.js';
import { searchSangiinPartyOpinion } from './searchSangiinPartyOpinion.js';
import { getCommiteeNames } from './getCommiteeNames.js';
import { getRepresentatives } from './getRepresentatives.js';
const router = express.Router();


//endpoint for returning the meeting names available
router.get('/meeting_names',getMeetingNames)
//endpoint for commitee names and members
router.get('/commitee', getCommiteeNames)
//endpoint for returning all the representatives
router.get('/repr', getRepresentatives);
//endpoint for voting results per meeting
router.get('/sangiin_meeting_votes/:meeting_name', searchSangiinMeeting);
//endpoint for returning the party opinions for one topic
router.get('/sangiin_party_opinions/:meeting_name/:topic_name', searchSangiinPartyOpinion);

export default router;