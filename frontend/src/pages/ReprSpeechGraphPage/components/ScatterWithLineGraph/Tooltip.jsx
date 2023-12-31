import React from 'react';
import PropTypes from 'prop-types';
import { colors } from '../../../../resource/styling';
import { SpeechAbbrev2Kaiha } from '../../../../resource/resources';

function Tooltip({ active, payload }) {
  if (active && payload.length) {
    const reprPayload = payload[0].payload;
    const { repr, party } = reprPayload;
    return (
      <div className={`${colors.primary} p-2 rounded-md bg-opacity-25`}>
        <h1>政党:{SpeechAbbrev2Kaiha[party]}</h1>
        <h1>{repr}</h1>
      </div>
    );
  }
  return null;
}

Tooltip.propTypes = {
  active: PropTypes.bool.isRequired,
  // eslint-disable-next-line react/forbid-prop-types
  payload: PropTypes.array.isRequired,
};

export default Tooltip;
