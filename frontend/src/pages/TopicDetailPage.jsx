import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useState } from "react";

import { sangiin_endpoint } from "../resource/resources";
import "../styles/general.css"
import '../styles/pages/topic_detail_page.css'
import PartyOpinionCard from "../components/PartyOpinionCard";


function TopicDetailPage() {
    const [topic, setTopic] = useState({})
    var [isloading, setIsLoading] = useState(true)
    var [noOpinions, setNoOpinions] = useState(true)
    var [party_opinions, setPartyOpinions] = useState([])
    var {meeting_id, topic_id} = useParams()
    useEffect(()=>{
        const fetchTopic = async () =>{
            const topic_url = sangiin_endpoint + "sangiin_party_opinions/" + meeting_id + '/' + topic_id
            
            const topic_data = await fetch(topic_url)
            const topic_json = await topic_data.json()
            setTopic(topic_json)
        }

        setIsLoading(true)
        fetchTopic()
            .catch(()=>{
                console.error()
                setTopic({})
            })
        setIsLoading(false)
        if(Object.keys(topic).length !== 0){
            setNoOpinions(false)
        }else{
            setNoOpinions(true)
        }

    },[])

    useEffect(()=>{
        if(Object.keys(topic).length !== 0){
            setNoOpinions(false)
        }else{
            setNoOpinions(true)
        }


    },[topic])

    var party_opinion_cards = Object.entries(topic).map(
        ([key, value]) => {
        return <PartyOpinionCard key={key} party_opinion={value} party_name={key}/>}
    )

    return ( 
        <div className="topic-detail-page">
            <div className="header-section">
                <p>{topic_id}</p>
            </div>
            <div className="content-section topic-detail-content">
                 {isloading?<h1>Loading</h1>:noOpinions?<h1>該当する答弁がありません</h1>:party_opinion_cards}
            </div>
            

        </div> 
    );
}

export default TopicDetailPage;