import {configureStore} from "@reduxjs/toolkit"
import meetingVotingReducer from "../features/meeting/meetingSlice"

export default configureStore({
    reducer: {
        meeting:meetingVotingReducer,
    }
})