import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { selectMeetingByName, selectAllMeetingVotings, fetchMeetingVotings } from "../features/meeting/meetingSlice"

import "../styles/general.css"
import "../styles/pages/meeting_detail_page.css"
import TopicCard from "../components/TopicCard";

function MeetingDetailPage() {
    const [topicFilterText, setTopicFilterText ] = useState("")
    const dispatch = useDispatch()
    const meetings = useSelector(selectAllMeetingVotings)
    var { meeting_id } = useParams()
    var meeting = useSelector((state) =>selectMeetingByName(state, meeting_id))
    if(meeting){
        var meeting_period = meeting.period
        var meeting_topic_cards = meeting.topics.map(topic=>{
            if (topicFilterText === ""){
                return(
                    <TopicCard key={topic.topic_title + topic.topic_date} topic={topic}/>
                )
            }else if(topic.topic_title.includes(topicFilterText)){
                return(
                    <TopicCard key={topic.topic_title + topic.topic_date} topic={topic}/>
                )
            }
            
        })
    }
    var main_content = meeting? meeting_topic_cards:<h1>Loading</h1>
    useEffect(()=>{
        //gets called on mount of the component
    
        //get the meetings if the array is empty in store
        if (meetings.length === 0){
            dispatch(fetchMeetingVotings())
        }
    },[])

    var handleTopicFilterInputChange=e=>{
        setTopicFilterText(e.target.value)
    }

    return ( 
        <div className="full-page-container">
            <div className="header-section">
                <h1>{meeting_id}</h1>
                <h2>{meeting_period}</h2>
            </div>
            <div className="user-input-container">
                <label>フィルタ: </label>
                <input className="topic-filter-input" onChange={handleTopicFilterInputChange}></input>

            </div>
            <div className="content-section meeting-detail-content">
                {main_content}
            </div>
        </div>
    );
}

export default MeetingDetailPage;