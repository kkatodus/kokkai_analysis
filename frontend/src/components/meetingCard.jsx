import '../styles/components/meeting_card.css';
import React from 'react';
import '../styles/other/animations.css';
import {Link} from 'react-router-dom';
import Proptypes from 'prop-types';

/**
 * @param {object} props
 * @return {JSX.Element}
*/
function MeetingCard(props) {
  return (
    <Link to={'/meeting_page/'+props.meeting_name}>
      <div className="meeting-card-container grow-on-hover-small">
        <h1>{props.meeting_name}</h1>
        <h2>{props.period}</h2>
      </div>
    </Link> );
}
MeetingCard.propTypes ={
  meeting_name: Proptypes.string,
  period: Proptypes.string,
};

export default MeetingCard;
