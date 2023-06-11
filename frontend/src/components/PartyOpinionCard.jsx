import '../styles/components/party_opinion_card.css';
import React from 'react';
import Proptypes from 'prop-types';
/**
 *
 * @param {object} props
 * @return {JSX.Element}
 */
function PartyOpinionCard(props) {
  const { partyOpinion, partyName } = props;
  return (
    <div className="party-opinion-card">
      <h1>{partyName}</h1>
      <p>{partyOpinion}</p>
    </div>
  );
}
PartyOpinionCard.defaultProps = {
  partyOpinion: '',
  partyName: '',
};
PartyOpinionCard.propTypes = {
  partyOpinion: Proptypes.oneOfType([Proptypes.string, Proptypes.object]),
  partyName: Proptypes.string,
};

export default PartyOpinionCard;
