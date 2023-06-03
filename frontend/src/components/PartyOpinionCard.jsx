import '../styles/components/party_opinion_card.css';
import React from 'react';
/**
 *
 * @param {object} props
 * @return {JSX.Element}
 */
function PartyOpinionCard(props) {
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
  party_opinion: Object,
  party_name: String,
};

export default PartyOpinionCard;
