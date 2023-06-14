import React from 'react';
import Proptypes from 'prop-types';
import CardItem from './basic/CardItem';

function ReprCard(props) {
  /* eslint-disable no-unused-vars */
  const { kaiha, name, yomikata, district, period } = props;
  return <CardItem key={`${kaiha}-${name}-${district}`} cardTitle={name} />;
}

ReprCard.propTypes = {
  kaiha: Proptypes.string.isRequired,
  name: Proptypes.string.isRequired,
  yomikata: Proptypes.string.isRequired,
  district: Proptypes.string.isRequired,
  period: Proptypes.string.isRequired,
};
export default ReprCard;
