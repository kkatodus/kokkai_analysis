import React from 'react';
import Proptypes from 'prop-types';
import useDisplaySize from 'state/useDisplayType';

function Tag(props) {
  const { text } = props;
  const { type: DisplayType } = useDisplaySize();
  const isMobile = DisplayType === 'mobile';

  return (
    <span
      className={`m-1 rounded-lg p-1 border-2 ${isMobile ? 'text-xs' : ''}`}
    >
      {text}
    </span>
  );
}

Tag.defaultProps = {};
Tag.propTypes = { text: Proptypes.string.isRequired };

export default Tag;
