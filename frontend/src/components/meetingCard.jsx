import '../styles/components/meeting_card.css';
import React from 'react';
import '../styles/other/animations.css';
import { Link } from 'react-router-dom';
import Proptypes from 'prop-types';

/**
 * @param {object} props
 * @return {JSX.Element}
 */
function MeetingCard(props) {
  const { MeetingName, Period } = props;
  return (
    <Link to={`/sangiin_meetings/${MeetingName}`}>
      <div className="meeting-card-container grow-on-hover-small">
        <h1>{MeetingName}</h1>
        <h2>{Period}</h2>
      </div>
    </Link>
  );
}

MeetingCard.propTypes = {
  MeetingName: Proptypes.string.isRequired,
  Period: Proptypes.string.isRequired,
};

export default MeetingCard;
