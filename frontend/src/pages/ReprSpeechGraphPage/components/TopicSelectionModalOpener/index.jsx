import React from 'react';
import Proptypes from 'prop-types';
import { FaGear } from "react-icons/fa6";

function TopicSelectionModalOpener({ addModal}) {
  return (
     <button onClick={() => addModal('topicSelection')} type="button" className="hover:scale-110 transition flex items-center w-auto mb-2 h-1/2">
      <FaGear className="h-7 w-7 mr-2" />
	  <h1 className="text-xl font-bold text-start whitespace-nowrap">トピックを選んでください</h1>
     </button>
  );
}

TopicSelectionModalOpener.propTypes = {
  addModal: Proptypes.func.isRequired,
};

export default TopicSelectionModalOpener;
