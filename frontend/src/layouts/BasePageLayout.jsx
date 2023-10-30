import React from 'react';
import Div100vh from 'react-div-100vh';
import { Link } from 'react-router-dom';
import { MdOutlineArrowBack } from 'react-icons/md';
import Proptypes from 'prop-types';
import { colors } from '../resource/styling';

export default function BasePageLayout(props) {
  const { pageTitle, backTo, MainContent, pageSubtitle, extraStyles } = props;
  return (
    <Div100vh>
      <div className="flex flex-col h-[99%] relative">
        <div className={`h-1/6 flex items-center ${colors.primary}`}>
          <Link className="back-icon" to={backTo}>
            <MdOutlineArrowBack />
          </Link>
          <div>
            <h1 className="text-2xl px-3 ">{pageTitle}</h1>
            <h3 className="text-lg">{pageSubtitle}</h3>
          </div>
        </div>
        <div
          className={`relative h-7/8 overflow-y-scroll ${colors.secondary} ${extraStyles.content}`}
        >
          {MainContent}
        </div>
      </div>
    </Div100vh>
  );
}

BasePageLayout.defaultProps = {
  backTo: '/',
  pageSubtitle: '',
  extraStyles: {
    content: '',
  },
};

BasePageLayout.propTypes = {
  pageTitle: Proptypes.string.isRequired,
  backTo: Proptypes.string,
  MainContent: Proptypes.oneOfType([
    Proptypes.element,
    Proptypes.arrayOf(Proptypes.element),
  ]).isRequired,
  pageSubtitle: Proptypes.string,
  extraStyles: Proptypes.shape({ content: Proptypes.string }),
};
