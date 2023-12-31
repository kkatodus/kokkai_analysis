import React from 'react';
import Proptypes from 'prop-types';
import { colors } from '../../../../resource/styling';

function TopicSelector({ topics, selectedTopic, setSelectedTopic }) {
  const buttonClass =
    'w-100 border-2 m-2 pt-1 pb-1 pr-5 pl-5 text-center font-bold rounded-md';
  return (
    <div className="h-full w-full flex items-center justify-left flex-wrap overflow-y-scroll">
      {topics.map((topic) => {
        if (topic === selectedTopic) {
          return (
            <button
              onClick={() => setSelectedTopic(topic)}
              className={`${buttonClass} ${colors.secondary} `}
              type="button"
              key={topic}
            >
              {topic}
            </button>
          );
        }
        return (
          <button
            type="button"
            className={buttonClass}
            onClick={() => setSelectedTopic(topic)}
          >
            {topic}
          </button>
        );
      })}
    </div>
  );
}

TopicSelector.propTypes = {
  topics: Proptypes.arrayOf(Proptypes.string).isRequired,
  selectedTopic: Proptypes.string.isRequired,
  setSelectedTopic: Proptypes.func.isRequired,
};

export default TopicSelector;
