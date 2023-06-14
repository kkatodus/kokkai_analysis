import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { TbTriangleFilled } from 'react-icons/tb';

export default function Accordion(props) {
  const { title, content, extraStyles } = props;
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <div className="flex flex-col items-center  w-4/5 bg-slate-200 p-5 m-2 relative">
      <div className="flex justify-start w-full">
        <h1 className={`text-3xl ${extraStyles.title}`}>{title}</h1>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={`transiton duration-75 px-2 ${
            isExpanded ? 'rotate-180' : 'rotate-90'
          }`}
        >
          <TbTriangleFilled />
        </button>
      </div>
      <div
        className={`w-full transition duration-75 
		${isExpanded ? 'visible opacity-100 ' : 'collapse absolute top-0 opacity-0 '} 
		${extraStyles.content}`}
      >
        {content}
      </div>
    </div>
  );
}

Accordion.defaultProps = {
  title: '',
  content: '',
  extraStyles: {
    title: '',
    content: '',
  },
};
Accordion.propTypes = {
  title: PropTypes.string,
  content: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(PropTypes.element),
  ]),
  extraStyles: PropTypes.shape({
    title: PropTypes.string,
    content: PropTypes.string,
  }),
};
