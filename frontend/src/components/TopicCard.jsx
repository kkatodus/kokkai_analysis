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
            { name: "NE Send", yay: whole_result.yay, nay: whole_result.nay},
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
                    <Bar dataKey="nay" fill="#dd7876" stackId="a">
                    <LabelList
                        dataKey="nay"
                        position="center"
                    />
                    </Bar>
                    <Bar dataKey="yay" fill="#82ba7f" stackId="a">
                    <LabelList
                        dataKey="yay"
                        position="center"
                    />
                    </Bar>
                    <Bar dataKey="inprogress" fill="#76a8dd" stackId="a">
                    <LabelList
                        dataKey="inprogress"
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