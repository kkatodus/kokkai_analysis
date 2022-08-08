import { createSlice, createAsyncThunk} from "@reduxjs/toolkit";
import { sangiin_votes_endpoint } from "../../resource/resources";
import axios from "axios";

const initialState = {
    status:"idle",
    error:null,
    meeting_votings:[]
}

export const fetchMeetingVotings = createAsyncThunk("meetings/fetchMeetingVotings", async () => {
    try {
        const response = await axios.get(sangiin_votes_endpoint)
        return [...response.data]   
    } catch(err){
        console.log(err.message)
        return [];
    }
})


const meetingVotingsSlice = createSlice({
    name:"meeting",
    initialState,
    reducers:{}, 
    extraReducers(builder){
        builder
        .addCase(fetchMeetingVotings.pending,(state, action)=>{
            state.status = "loading"
        })
        .addCase(fetchMeetingVotings.fulfilled, (state, action)=>{
            state.status = "succeeded"
            const loadedMeetings = action.payload
            state.meeting_votings = loadedMeetings
        })
        .addCase(fetchMeetingVotings.rejected, (state, action)=>{
            state.status = "failed"
            state.error = action.error.message
        })
        
    }
})


export const selectAllMeetingVotings = (state) => state.meeting.meeting_votings;

export const selectMeetingByName = (state, meeting_id) =>
    state.meeting.meeting_votings.find(meeting_voting => meeting_voting.meeting_name === meeting_id);

export const getMeetingStatus = state => state.meeting.status;
export const getMeetingError = state => state.meeting.error

export default meetingVotingsSlice.reducer