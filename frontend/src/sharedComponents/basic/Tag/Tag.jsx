import React from 'react';
import Proptypes from 'prop-types';

function Tag(props) {
  const { text } = props;
  return <span className="m-1 rounded-lg p-1 border-2">{text}</span>;
}

Tag.defaultProps = {};
Tag.propTypes = { text: Proptypes.string.isRequired };

export default Tag;
