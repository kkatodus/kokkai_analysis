import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useState } from "react";

import { sangiin_endpoint } from "../resource/resources";

function TopicDetailPage() {
    const [topic, setTopic] = useState({})
    var {meeting_id, topic_id} = useParams()
    console.log(topic_id)
    useEffect(()=>{
        const fetchTopic = async () =>{
            const topic_url = sangiin_endpoint + "sangiin_party_opinions/" + meeting_id + '/' + topic_id
            const topic_data = await fetch(topic_url)
            const topic_json = await topic_data.json()
            setTopic(topic_json)
        }
        fetchTopic()
            .catch(()=>{
                console.error()
                setTopic({})
            })

    })
    return ( 
        <div>
            <h1>topic detail</h1>
            {topic_id}

        </div> 
    );
}

export default TopicDetailPage;