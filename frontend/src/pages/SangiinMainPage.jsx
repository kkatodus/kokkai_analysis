import { useEffect, useState } from "react";
//redux stuff
import {useSelector, useDispatch } from "react-redux";
import {fetchMeetingVotings, getMeetingError, getMeetingStatus, selectAllMeetingVotings } from "../features/meeting/meetingSlice";

import "../styles/sanitize.css"
import "../styles/general.css"

import MeetingCard from "../components/meetingCard";


function SangiinMainPage() {
    const meetings = useSelector(selectAllMeetingVotings)
    const meeting_status = useSelector(getMeetingStatus)
    const meeting_error = useSelector(getMeetingError)
    const dispatch = useDispatch()

    useEffect(()=>{
        //gets called on mount of the component

        //get the meetings if the array is empty in store
        if (meetings.length == 0){
            dispatch(fetchMeetingVotings())
        }
    },[])

    return ( 
        <div className="full-page-container">
            <div className="header-section ">
                <h1>Sangiin Main</h1>

            </div>
            <div className="content-section">
                {meetings.map(meeting=>{
                    return(
                        <MeetingCard key={meeting.meeting_name} {...meeting}/>
                    )
                })}

            </div>
        </div>
    );
}

export default SangiinMainPage;