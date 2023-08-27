import React from 'react';
import PropTypes from 'prop-types';
import { colors } from '../../resource/styling';

export default function CardItem(props) {
  /* eslint-disable no-unused-vars */
  const { cardTitle, cardContent, cardImage, cardIcon } = props;
  return (
    <div
      className={`w-5/6 h-auto p-2 m-2 flex flex-col items-center rounded-xl ${colors.primary} transition hover:scale-105 cursor-pointer`}
    >
      <div className="relative ">
        {cardImage ? <img src={cardImage} alt="" /> : cardIcon}
      </div>
      <div className={`w-full `}>
        <h1 className="text-2xl">{cardTitle}</h1>
        <div>{cardContent}</div>
      </div>
    </div>
  );
}

CardItem.defaultProps = {
  cardTitle: '',
  cardContent: '',
  cardImage: undefined,
  cardIcon: undefined,
};
CardItem.propTypes = {
  cardTitle: PropTypes.string,
  cardContent: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.element),
    PropTypes.string,
    PropTypes.element,
  ]),
  cardImage: PropTypes.string,
  cardIcon: PropTypes.element,
};
