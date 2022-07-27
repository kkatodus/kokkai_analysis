import React, { PureComponent } from 'react';
import { 
    BarChart,
    Bar,
    XAxis,
    YAxis,
    ResponsiveContainer,
    Tooltip,
    Label,
    LabelList } from 'recharts';

import "../styles/components/topic_card.css";
import "../styles/other/animations.css";


function TopicCard(props) {
    var topic = props.topic;
    var { topic_title, topic_date, individual_voting_results, whole_result, voting_results } = topic;

    if (individual_voting_results){
        const data = [
            { name: "投票結果", "賛成": whole_result.yay, "反対": whole_result.nay},
        ];
        var content = 
            <ResponsiveContainer height={200} width={"100%"}>
                <BarChart
                    layout='vertical'
                    data={data}
                    stackOffset="expand"
                >
                    <XAxis hide type="number"/>
                    <YAxis 
                        hide
                        type="category"
                        dataKey="name"
                        stroke="#FFFFF"
                        fontSize={12}
                    />
                    <Tooltip/>
                    <Bar dataKey="反対" fill="#dd7876" stackId="a">
                    <LabelList
                        dataKey="反対"
                        position="center"
                    />
                    </Bar>
                    <Bar dataKey="賛成" fill="#82ba7f" stackId="a">
                    <LabelList
                        dataKey="賛成"
                        position="center"
                    />
                    </Bar>
                    
                </BarChart>

            </ResponsiveContainer>;
    }else{
        var content = <h3>{whole_result}</h3>
    }
    return ( 
        <div className="topic-card">
            <div className="topic-card-header">
                {topic_title}
            </div>
            <div className="topic-card-content">
                {content}
            </div>
        </div>
     );
}

export default TopicCard;