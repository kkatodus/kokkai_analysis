import { useEffect, useState } from "react";
import axios from "axios";

import { sangiin_endpoint } from "../resource/resources"

import "../styles/sanitize.css"
import "../styles/general.css"

import MeetingCard from "../components/meetingCard";


function SangiinMainPage() {
    const [meeting_names, setMeetingNames] = useState([])

    useEffect(() => {
        //gets called on mount of the component

        const fetchMeetingNames = async () => {
            const meeting_names_data = await fetch(sangiin_endpoint + "meeting_names")
            const meeting_names_json = await meeting_names_data.json()
            setMeetingNames(meeting_names_json["meetings"])
        }
        //get the meetings if the array is empty in store
        if (meeting_names.length == 0) {
            fetchMeetingNames()
                .catch(() => {
                    console.error()
                    setMeetingNames([])
                })
        }
    }, [])
    return (
        <div className="full-page-container">
            <div className="header-section ">
                <h1>参議院</h1>

            </div>
            <div className="content-section">
                {meeting_names.map(meeting_name => {
                    return (
                        <MeetingCard key={meeting_name["meeting_name"]} {...meeting_name} />
                    )
                })}

            </div>
        </div>
    );
}

export default SangiinMainPage;