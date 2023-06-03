import React from 'react';
import StackedBarChart from './StackedBarChart';
import {Link} from 'react-router-dom';

import {GrLinkNext} from 'react-icons/gr';

import '../styles/components/topic_card.css';
import '../styles/other/animations.css';

/**
 * @param {object} props
 * @return {JSX.Element}
*/
function TopicCard(props) {
  const topic = props.topic;
  const meetingId = props.meeting_id;
  // eslint-disable-next-line max-len
  const {topicTitle, individualVotingResults, wholeResult, votingResults} = topic;

  if (individualVotingResults) {
    const data = [
      {'name': '投票結果', '賛成': wholeResult.yay, '反対': wholeResult.nay},
    ];
    // eslint-disable-next-line max-len, no-var
    var wholeResultChart = <StackedBarChart data={data} height={200} width={'100%'}/>;
    // eslint-disable-next-line
    var partyVotingResults = Object.entries(votingResults).map(([key, value])=>{
      const partyVotingData = [
        {'name': value.party_name, '賛成': value.yay, '反対': value.nay},
      ];
      return (
        <div key={topicTitle+value.party_name}
          className="party-vote-result-container">
          <h4>{value.party_name}</h4>
          <StackedBarChart data={partyVotingData} width={'100%'} height={100}/>

        </div>

      );
    });
  } else {
    // eslint-disable-next-line no-var
    var wholeResultChart = <h3>{wholeResult}</h3>;
    // eslint-disable-next-line no-var
    var partyVotingResults = '';
  }
  return (
    <div className="topic-card">
      <div className="topic-card-header">
        <Link to={'/topic_details/'+meetingId+'/'+topicTitle}>
          <h3>{topicTitle}</h3>

        </Link>
        <Link className={'jump-to-topic-detail-icon-link'}
          to={'/topic_details/'+meetingId+'/'+topicTitle}>

          <GrLinkNext className='jump-icon'/>
        </Link>

      </div>
      <div className="topic-card-content">
        {wholeResultChart}
        {partyVotingResults}
      </div>
    </div>
  );
}

TopicCard.propTypes={
  topic: Object,
  meeting_id: String,
};
export default TopicCard;
