import React from 'react';
import Proptypes from 'prop-types';
import CardItem from './basic/CardItem';

function ReprCard(props) {
  /* eslint-disable no-unused-vars */
  const {
    kaiha,
    name,
    yomikata,
    district,
    period,
    role,
    party,
    link,
    numberOfTermsLower,
    numberofTermsUpper,
  } = props;
  const cardContent = (
    <div>
      {yomikata ? <p>{yomikata}</p> : ''}
      {district ? <p>選挙区：{district}</p> : ''}
      {role ? <p>役職：{role}</p> : ''}
      {party ? <p>所属政党：{party}</p> : ''}
      {period ? <p>任期満了：{period}</p> : ''}
      {numberOfTermsLower ? <p>衆議院当選回数：{numberOfTermsLower}</p> : ''}
      {numberofTermsUpper ? <p>参議院当選回数：{numberofTermsUpper}</p> : ''}
    </div>
  );
  return (
    <CardItem
      key={`${kaiha}-${name}-${district}`}
      cardTitle={name}
      cardContent={cardContent}
    />
  );
}

ReprCard.defaultProps = {
  kaiha: null,
  yomikata: null,
  district: null,
  period: null,
  role: null,
  party: null,
  link: null,
  numberOfTermsLower: null,
  numberofTermsUpper: null,
};
ReprCard.propTypes = {
  kaiha: Proptypes.string,
  name: Proptypes.string.isRequired,
  yomikata: Proptypes.string,
  district: Proptypes.string,
  period: Proptypes.string,
  role: Proptypes.string,
  party: Proptypes.string,
  link: Proptypes.string,
  numberOfTermsLower: Proptypes.number,
  numberofTermsUpper: Proptypes.number,
};
export default ReprCard;
