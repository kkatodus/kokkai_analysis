import React from 'react';
import PropTypes from 'prop-types';
import { CgArrowsH } from 'react-icons/cg';

function LeftRightSpectrum({ leftLabel, rightLabel }) {
	return (
	<div className="items-center p-1 font-bold flex text-center justify-between bg-gradient-to-r from-red-400 to-blue-500">
		<span className="flex-1 text-xs px-1" title={leftLabel}>{leftLabel}</span>
			<CgArrowsH className="font-extrabold text-xl flex-shrink-0 mx-1" />
		<span className="flex-1 text-xs px-1" title={rightLabel}>{rightLabel}</span>
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
