import React from 'react';
import Proptypes from 'prop-types';
import { FaGear } from 'react-icons/fa6';
import useDisplaySize from 'state/useDisplayType';

function TopicSelectionModalOpener({ addModal }) {
  const { type: DisplayType } = useDisplaySize();
  const isMobile = DisplayType === 'mobile';
  return (
    <button
      onClick={() => addModal('topicSelection')}
      type="button"
      className={`hover:scale-110 transition flex items-center w-auto  h-1/2 ${
        isMobile ? 'h-8 w-8' : 'mb-2'
      }`}
    >
      <FaGear className={`h-7 w-7 mr-2 ${isMobile ? 'h-8 w-8' : ''}`} />
      <h1
        className={`text-xl font-bold text-start whitespace-nowrap ${
          isMobile ? 'hidden' : ''
        }`}
      >
        トピックを選んでください
      </h1>
    </button>
  );
}

TopicSelectionModalOpener.propTypes = {
  addModal: Proptypes.func.isRequired,
};

export default TopicSelectionModalOpener;
