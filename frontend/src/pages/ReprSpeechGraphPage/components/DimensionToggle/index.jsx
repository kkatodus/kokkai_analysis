import React from 'react';
import PropTypes from 'prop-types';
import { colors } from '../../../../resource/styling';

const buttonTexts = ['1D', '2D'];
function DimensionToggle({ selectedDimension, setSelectedDimension }) {
  const buttonClass =
    'w-100 border-2 m-2 pt-1 pb-1 pr-5 pl-5 text-center font-bold rounded-md';
  return (
    <div className="h-full w-full flex justify-center items-center flex-wrap">
      {buttonTexts.map((text) => (
        <button
          type="button"
          className={`${buttonClass} ${
            text === selectedDimension ? colors.secondary : ''
          }`}
          onClick={() => setSelectedDimension(text)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

DimensionToggle.propTypes = {
  selectedDimension: PropTypes.string.isRequired,
  setSelectedDimension: PropTypes.func.isRequired,
};

export default DimensionToggle;
