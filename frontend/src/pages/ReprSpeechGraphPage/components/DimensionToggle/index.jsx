import React from 'react';
import PropTypes from 'prop-types';
import { colors } from 'resource/styling';
import useDisplaySize from 'state/useDisplayType';

const buttonTexts = ['1D', '2D'];
function DimensionToggle({ selectedDimension, setSelectedDimension }) {
  const { type: DisplayType } = useDisplaySize();
  const isMobile = DisplayType === 'mobile';
  const buttonClass = isMobile
    ? ' h-1/2 rounded-md font-bold m-0 px-3 '
    : 'w-100 border-2 m-2 pt-1 pb-1 pr-5 pl-5 text-center font-bold rounded-md';
  return (
    <div
      className={`h-full flex justify-center items-center flex-wrap overflow-y-scroll ${
        isMobile ? 'flex-col w-auto' : 'w-full'
      }`}
    >
      {buttonTexts.map((text) => (
        <button
          key={text}
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
