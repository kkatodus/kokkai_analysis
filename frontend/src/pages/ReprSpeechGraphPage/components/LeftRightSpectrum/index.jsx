import React from 'react';
import PropTypes from 'prop-types';
import { CgArrowsH } from 'react-icons/cg';

function LeftRightSpectrum({ leftLabel, rightLabel }) {
  return (
    <div className="h-[100%] items-center p-1 font-bold flex text-center justify-around bg-gradient-to-r from-red-400 to-blue-500">
      <span>{leftLabel}</span>
      <CgArrowsH className="font-extrabold text-3xl" />
      <span>{rightLabel}</span>
    </div>
  );
}

LeftRightSpectrum.propTypes = {
  leftLabel: PropTypes.string,
  rightLabel: PropTypes.string,
};

LeftRightSpectrum.defaultProps = {
  leftLabel: '後ろ向き',
  rightLabel: '前向き',
};

export default LeftRightSpectrum;
