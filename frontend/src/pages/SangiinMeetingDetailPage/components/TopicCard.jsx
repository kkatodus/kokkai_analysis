import React from 'react';
import Proptypes from 'prop-types';
import StackedBarChart from './StackedBarChart';

import { colors } from '../../../resource/styling';
import { getSangiinHoureiLink } from '../../../resource/resources';

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
          className={`w-5/12 flex items-center flex-col ${colors.secondary} my-2 rounded-sm`}
        >
          <h4 className="text-xs">{value.party_name}</h4>
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
    <a
      href={getSangiinHoureiLink(meetingId.substring(1, 4))}
      className={`${colors.tertiary} mt-1 mb-1 ms-2 p-1 rounded-lg relative`}
    >
      <div
        className={`${colors.primary} rounded-lg p-2 h-20 overflow-y-scroll`}
      >
        {/* eslint-disable-next-line camelcase */}
        <h4 className="text-sm">{topic_title}</h4>
      </div>
      <div className="pt-2 justify-around flex flex-wrap">
        {wholeResultChart}
        {partyVotingResults}
      </div>
    </a>
  );
}

TopicCard.propTypes = {
  topic: Proptypes.shape({
    individual_voting_results: Proptypes.bool,
    topic_title: Proptypes.string,
    topic_data: Proptypes.string,
    whole_result: Proptypes.oneOfType([Proptypes.string, Proptypes.object]),
    voting_results: Proptypes.oneOfType([
      Proptypes.arrayOf(Proptypes.object),
      Proptypes.number,
    ]),
  }).isRequired,
  meetingId: Proptypes.string.isRequired,
};
export default TopicCard;
