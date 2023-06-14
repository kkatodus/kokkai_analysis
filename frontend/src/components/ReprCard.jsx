import React from 'react';
import Proptypes from 'prop-types';
import CardItem from './basic/CardItem';

function ReprCard(props) {
  /* eslint-disable no-unused-vars */
  const { kaiha, name, yomikata, district, period, role, party, link } = props;
  const cardContent = (
    <div>
      {yomikata ? <p>{yomikata}</p> : ''}
      {district ? <p>選挙区：{district}</p> : ''}
      {role ? <p>役職：{role}</p> : ''}
      {party ? <p>所属政党：{party}</p> : ''}
      {period ? <p>任期満了：{period}</p> : ''}
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
};
export default ReprCard;
