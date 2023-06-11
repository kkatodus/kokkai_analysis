import React from 'react';
import PropTypes from 'prop-types';

export default function Accordion(props) {
  const { title, content } = props;
  return (
    <div>
      <div>
        <h1>{title}</h1>
      </div>
      <div>{content}</div>
    </div>
  );
}

Accordion.defaultProps = {
  title: '',
  content: '',
};
Accordion.propTypes = {
  title: PropTypes.string,
  content: PropTypes.element,
};
