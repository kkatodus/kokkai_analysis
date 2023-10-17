import React from 'react';
import { Link } from 'react-router-dom';
import Proptypes from 'prop-types';
import { colors } from '../../../resource/styling';

/**
 * @param {object} props
 * @return {JSX.Element}
 */
function MeetingCard(props) {
  const { MeetingName, Period } = props;
  return (
    <Link
      to={`/sangiin_meetings/${MeetingName}`}
      className={`transition hover:scale-105 w-11/12 m-5 rounded-lg p-2 ${colors.tertiary}`}
    >
      <h1>{MeetingName}</h1>
      <h2>{Period}</h2>
    </Link>
  );
}

MeetingCard.propTypes = {
  MeetingName: Proptypes.string.isRequired,
  Period: Proptypes.string.isRequired,
};

export default MeetingCard;
