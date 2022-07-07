import { useEffect, useState } from "react";
import { sangiin_votes_endpoint } from "../resource/resources";
import "../styles/sanitize.css"
import "../styles/general.css"


function SangiinMainPage() {
    var [meetings, setMeetings] = useState([])

    useEffect(()=>{
        //getting data from api about the voting results
        const getSangiinVoteResults = async () => {
            const response = await fetch(sangiin_votes_endpoint)
            var response_json = await response.json()
            setMeetings(response_json)
        }
        
        getSangiinVoteResults()
        .catch(console.error)
    },[])

    return ( 
        <div className="full-page-container">
            <div className="header-section ">
                <h1>Sangiin Main</h1>

            </div>
            <div className="content-section">
                {meetings.map(meeting=>{
                    var meeting_name = meeting["meeting_name"]
                    return(
                        <h1 key={meeting_name}>{meeting_name}</h1>
                    )
                })}

            </div>
        </div>
    );
}

export default SangiinMainPage;