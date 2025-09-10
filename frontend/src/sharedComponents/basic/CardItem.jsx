import React from 'react';
import PropTypes from 'prop-types';
import { colors } from 'resource/styling';
import useDisplaySize from 'state/useDisplayType';
import WebViewLink from '../../components/WebViewLink';

export default function CardItem(props) {
	const { type: DisplayType } = useDisplaySize();
	const isMobile = DisplayType === 'mobile';
	/* eslint-disable no-unused-vars */
	const { cardTitle, cardContent, cardImage, cardIcon, link } = props;

	if (link) {
	return (
		<WebViewLink
		to={link}
		className={`w-[250px] max-h-[300px] p-2 m-2 flex flex-col items-center rounded-xl ${colors.primary} transition hover:scale-105 cursor-pointer overflow-hidden ${isMobile ? 'w-[150px] max-h-[200px]' : ''}`}
		>
		<div className="relative flex-shrink-0">
			{cardImage ? <img src={cardImage} alt="" /> : cardIcon}
		</div>
		<div className="w-full flex-1 flex flex-col min-h-0 overflow-hidden">
			<h1 className={`text-2xl flex-shrink-0 ${isMobile ? 'text-sm font-bold' : ''}`}>{cardTitle}</h1>
			<div className="flex-1 overflow-y-hidden">{cardContent}</div>
		</div>
		</WebViewLink>
	);
	}
	return (
	<div
		className={`w-[250px] p-2 m-2 flex flex-col items-center rounded-xl ${colors.primary} transition hover:scale-105 overflow-hidden`}
	>
		<div className="relative flex-shrink-0">
		{cardImage ? <img src={cardImage} alt="" /> : cardIcon}
		</div>
		<div className="w-full flex-1 flex flex-col min-h-0 overflow-hidden">
		<h1 className="text-2xl flex-shrink-0">{cardTitle}</h1>
		<div className="flex-1 overflow-auto">{cardContent}</div>
		</div>
	</div>
	);
}

CardItem.defaultProps = {
  cardTitle: '',
  cardContent: '',
  cardImage: undefined,
  cardIcon: undefined,
  link: undefined,
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
  link: PropTypes.string,
};
