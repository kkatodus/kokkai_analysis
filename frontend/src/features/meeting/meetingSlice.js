import { createSlice, nanoid, createAsyncThunk } from "@reduxjs/toolkit";
import { sangiin_votes_endpoint } from "../../resource/resources";
import axios from "axios";

const initialState={
    meeting_votings:[],
    status:"idle",
    error:null
}

export const fetchMeetingVotings = createAsyncThunk("meetings/fetchMeetingVotings", async () => {
    const response = await axios.get(sangiin_votes_endpoint)
    return [...response.data]
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

export const selectAllMeetingVotings = state => state.meeting.meeting_votings;

export const getMeetingStatus = state => state.meeting.status;
export const getMeetingError = state => state.meeting.error

export default meetingVotingsSlice.reducer