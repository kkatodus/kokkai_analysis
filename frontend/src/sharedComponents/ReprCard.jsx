import React from 'react';
import Proptypes from 'prop-types';
import CardItem from './basic/CardItem';
import TagsContainer from './basic/Tag/TagContainer';

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
    house,
    tags,
  } = props;
  const cardContent = (
    <div>
      {yomikata ? <p>{yomikata}</p> : ''}
      {house ? <p>院：{house}</p> : ''}
      {district ? <p>選挙区：{district}</p> : ''}
      {role ? <p>役職：{role}</p> : ''}
      {party ? <p>所属政党：{party}</p> : ''}
      {period ? <p>任期満了：{period}</p> : ''}
      {numberOfTermsLower ? <p>衆議院当選回数：{numberOfTermsLower}</p> : ''}
      {numberofTermsUpper ? <p>参議院当選回数：{numberofTermsUpper}</p> : ''}
      {tags ? <TagsContainer tags={tags} /> : ''}
    </div>
  );
  return (
    <CardItem
      key={`${kaiha}-${name}-${district}`}
      link={link}
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
  house: null,
  link: null,
  numberOfTermsLower: null,
  numberofTermsUpper: null,
  tags: [],
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
  house: Proptypes.string,
  numberOfTermsLower: Proptypes.number,
  numberofTermsUpper: Proptypes.number,
  tags: Proptypes.arrayOf(Proptypes.string),
};
export default ReprCard;
