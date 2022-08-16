import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { sangiin_endpoint } from "../resource/resources";
import "../styles/general.css"
import "../styles/pages/meeting_detail_page.css"
import TopicCard from "../components/TopicCard";

function MeetingDetailPage() {
    const [topicFilterText, setTopicFilterText ] = useState("")
    const [meeting, setMeeting] = useState({topics:[]})
    var { meeting_id } = useParams()
    if(meeting){
        var meeting_period = meeting.period
        var meeting_topic_cards = meeting.topics.map(topic=>{
            if (topicFilterText === ""){
                return(
                    <TopicCard key={topic.topic_title + topic.topic_date} meeting_id ={meeting_id} topic={topic}/>
                )
            }else if(topic.topic_title.includes(topicFilterText)){
                return(
                    <TopicCard key={topic.topic_title + topic.topic_date} meeting_id={meeting_id} topic={topic}/>
                )
            }
            
        })
    }
    var main_content = meeting? meeting_topic_cards:<h1>Loading</h1>
    useEffect(()=>{
        //gets called on mount of the component
        const fetchMeeting = async () =>{
            const meeting_url = sangiin_endpoint + "sangiin_meeting_votes/" + meeting_id
            const meeting_data = await fetch(meeting_url)
            const meeting_json = await meeting_data.json()
            setMeeting(meeting_json)
        }
        
        fetchMeeting()
            .catch(()=>{
                console.error()
                setMeeting({})
            })
        //get the meetings if the array is empty in store
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