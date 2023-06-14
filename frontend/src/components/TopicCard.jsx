import React from 'react';
import { Link } from 'react-router-dom';
import Proptypes from 'prop-types';
import { GrLinkNext } from 'react-icons/gr';
import StackedBarChart from './StackedBarChart';

import '../styles/components/topic_card.css';
import '../styles/other/animations.css';

/* eslint-disable camelcase */
/* eslint-disable no-var */
/* eslint-disable vars-on-top */
/* eslint-disable block-scoped-var */
/**
 * @param {object} props
 * @return {JSX.Element}
 */
function TopicCard(props) {
  const { topic, meetingId } = props;
  const {
    topic_title,
    individual_voting_results,
    whole_result,
    voting_results,
  } = topic;
  if (individual_voting_results) {
    const data = [
      { name: '投票結果', 賛成: whole_result.yay, 反対: whole_result.nay },
    ];
    var wholeResultChart = (
      <StackedBarChart data={data} height={50} width="100%" />
    );
    // eslint-disable-next-line
    var partyVotingResults = Object.entries(voting_results).map((entry) => {
      // eslint-disable-next-line no-unused-vars
      const [index, value] = entry;
      const partyVotingData = [
        { name: value.party_name, 賛成: value.yay, 反対: value.nay },
      ];
      return (
        // eslint-disable-next-line camelcase
        <div
          key={topic_title + value.party_name}
          className="party-vote-result-container"
        >
          <h4>{value.party_name}</h4>
          <StackedBarChart data={partyVotingData} width="100%" height={20} />
        </div>
      );
    });
  } else {
    // eslint-disable-next-line no-var, camelcase, no-redeclare
    var wholeResultChart = <h3>{whole_result}</h3>;
    // eslint-disable-next-line no-var, no-redeclare
    var partyVotingResults = '';
  }
  return (
    <div className="topic-card">
      <div className="topic-card-header">
        {/* eslint-disable-next-line camelcase */}
        <Link to={`/sangiin_topic_details/${meetingId}/${topic_title}`}>
          {/* eslint-disable-next-line camelcase */}
          <h3>{topic_title}</h3>
        </Link>
        {/* eslint-disable-next-line camelcase, max-len */}
        <Link
          className="jump-to-topic-detail-icon-link"
          to={`/topic_details/${meetingId}/${topic_title}`}
        >
          <GrLinkNext className="jump-icon" />
        </Link>
      </div>
      <div className="topic-card-content">
        {wholeResultChart}
        {partyVotingResults}
      </div>
    </div>
  );
}

TopicCard.propTypes = {
  topic: Proptypes.shape({
    individual_voting_results: Proptypes.bool,
    topic_title: Proptypes.string,
    topic_data: Proptypes.string,
    whole_result: Proptypes.oneOfType([Proptypes.string, Proptypes.element]),
    voting_results: Proptypes.arrayOf(Proptypes.element),
  }).isRequired,
  meetingId: Proptypes.string.isRequired,
};
export default TopicCard;
