import React from 'react';
import { BsFillPersonFill } from 'react-icons/bs';
import PropTypes from 'prop-types';
import { colors } from '../../resource/styling';

export default function CardItem(props) {
  /* eslint-disable no-unused-vars */
  const { cardTitle, cardContent, cardImage } = props;
  return (
    <div
      className={`w-5/6 h-auto p-2 m-2 flex flex-col items-center ${colors.primary}`}
    >
      <div className="relative ">
        <BsFillPersonFill className="text-7xl" />
      </div>
      <div className={`flex w-full `}>
        <h1 className="text-2xl">{cardTitle}</h1>
        <div>{cardContent}</div>
      </div>
    </div>
  );
}

CardItem.defaultProps = {
  cardTitle: '',
  cardContent: '',
  cardImage: '',
};
CardItem.propTypes = {
  cardTitle: PropTypes.string,
  cardContent: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.element),
    PropTypes.string,
  ]),
  cardImage: PropTypes.string,
};
