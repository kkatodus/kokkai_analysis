import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { sangiin_endpoint } from "../resource/resources";
import "../styles/general.css"
import "../styles/pages/meeting_detail_page.css"
import TopicCard from "../components/TopicCard";

function MeetingDetailPage() {
    const [topicFilterText, setTopicFilterText ] = useState("")
    const [meeting, setMeeting] = useState({"topics":[]})
    const [meeting_period, setPeriod] = useState("")
    const [isloading, setIsLoading] = useState(true)
    const [loadFailed, setLoadFailed] = useState(false)
    const [topic_cards, setCards] = useState("")

    var { meeting_id } = useParams()
    useEffect(()=>{
        //gets called on mount of the component
        const fetchMeeting = async () =>{
            const meeting_url = sangiin_endpoint + "sangiin_meeting_votes/" + meeting_id
            const meeting_data = await fetch(meeting_url)
            const meeting_json = await meeting_data.json()
            setMeeting(meeting_json)
        }
        setIsLoading(true)
        fetchMeeting()
            .catch(()=>{
                console.error()
                setLoadFailed(true)
            })
        setIsLoading(false)
    },[])

    useEffect(()=>{
        
        setPeriod(meeting.period)
        var cards = meeting.topics.map(topic=>{
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
        setCards(cards)
        if(meeting.topics.length === 0){
        }else{
            setLoadFailed(false)
           
        }

    },[meeting, topicFilterText])

    var handleTopicFilterInputChange=e=>{
        setTopicFilterText(e.target.value)
    }

    return ( 
        <div className="meeting-detail-page">
            <div className="header-section">
                <h2>{meeting_id}</h2>
                <h3>{meeting_period}</h3>
            </div>
            <div className="user-input-container">
                <label className="input-label">フィルタ: </label>
                <input className="topic-filter-input" onChange={handleTopicFilterInputChange}></input>

            </div>
            <div className="content-section meeting-detail-content">
                {isloading?<h1>Loading</h1>:loadFailed?<h1>Load failed</h1>:topic_cards}
            </div>
        </div>
    );
}

export default MeetingDetailPage;