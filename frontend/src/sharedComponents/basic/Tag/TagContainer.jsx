import React from 'react';
import Proptypes from 'prop-types';
import Tag from './Tag';

function TagsContainer(props) {
  const { tags } = props;
  return (
    <div className="flex flex-wrap w-full border-solid">
      {tags.map((tag) => (
        <Tag key={tag} text={tag} />
      ))}
    </div>
  );
}

export default TagsContainer;

TagsContainer.defaultProps = {};
TagsContainer.propTypes = {
  tags: Proptypes.arrayOf(Proptypes.string).isRequired,
};
