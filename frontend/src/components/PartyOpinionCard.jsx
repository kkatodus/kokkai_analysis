import '../styles/components/party_opinion_card.css';
import React from 'react';
import Proptypes from 'prop-types';
/**
 *
 * @param {object} props
 * @return {JSX.Element}
 */
function PartyOpinionCard(props) {
  console.log(props);
  const partyOpinion = props.party_opinion['speech'];
  const partyName = props.party_name;
  return (
    <div className='party-opinion-card'>
      <h1>{partyName}</h1>
      <p>{partyOpinion}</p>
    </div>
  );
}
PartyOpinionCard.propTypes = {
  party_opinion: Proptypes.oneOfType([
    Proptypes.string, Proptypes.object,
  ]),
  party_name: Proptypes.string,
};

export default PartyOpinionCard;
