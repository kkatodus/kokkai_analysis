import React from 'react';
import StackedBarChart from './StackedBarChart';
import { Link } from 'react-router-dom';

import {GrLinkNext} from "react-icons/gr"

import "../styles/components/topic_card.css";
import "../styles/other/animations.css";

function TopicCard(props) {
    var topic = props.topic;
    var meeting_id = props.meeting_id;
    var { topic_title, topic_date, individual_voting_results, whole_result, voting_results } = topic;

    if (individual_voting_results){
        const data = [
            { name: "投票結果", "賛成": whole_result.yay, "反対": whole_result.nay},
        ];
        var whole_result_chart = <StackedBarChart data={data} height={200} width={"100%"}/>
        var party_voting_chart = Object.entries(voting_results).map(([key, value])=>{
            var party_voting_data = [{name: value.party_name, "賛成": value.yay, "反対": value.nay}]
            return(
                <div key={topic_title+value.party_name} className="party-vote-result-container">
                    <h4>{value.party_name}</h4>
                    <StackedBarChart data={party_voting_data} width={"100%"} height={100}/>

                </div>
                
            )
        })
            
    }else{
        var whole_result_chart = <h3>{whole_result}</h3>
        var party_voting_chart = ""
    }
    return ( 
        <div className="topic-card">
            <div className="topic-card-header">
                <Link to={"/topic_details/"+topic_date+topic_title}>
                    <h3>{topic_title}</h3>
                
                </Link>
                <Link className={"jump-to-topic-detail-icon-link"} to={"/topic_details/"+meeting_id+'/'+topic_title}>
                
                    <GrLinkNext className='jump-icon'/>
                </Link>

            </div>
            <div className="topic-card-content">
                {whole_result_chart}
                {party_voting_chart}
        
                
            </div>
        </div>
     );
}

export default TopicCard;