import React from 'react';
import Proptypes from 'prop-types';
import useDisplaySize from 'state/useDisplayType';
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
  const { type: DisplayType } = useDisplaySize();
  const isMobile = DisplayType === 'mobile';
  const cardContent = (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0">
        {yomikata ? <p className={`${isMobile ? 'text-xs' : ''}`}>{yomikata}</p> : ''}
        {house ? <p className={`${isMobile ? 'text-xs' : ''}`}>院：{house}</p> : ''}
        {district ? <p className={`${isMobile ? 'text-xs' : ''}`}>選挙区：{district}</p> : ''}
        {role ? <p className={`${isMobile ? 'text-xs' : ''}`}>役職：{role}</p> : ''}
        {party ? <p className={`${isMobile ? 'text-xs' : ''}`}>所属政党：{party}</p> : ''}
        {period ? <p className={`${isMobile ? 'text-xs' : ''}`}>任期満了：{period}</p> : ''}
        {numberOfTermsLower ? <p className={`${isMobile ? 'text-xs' : ''}`}>衆議院当選回数：{numberOfTermsLower}</p> : ''}
        {numberofTermsUpper ? <p className={`${isMobile ? 'text-xs' : ''}`}>参議院当選回数：{numberofTermsUpper}</p> : ''}
      </div>
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
