import React from 'react';
import Div100vh from 'react-div-100vh';
import { Link } from 'react-router-dom';
import { MdOutlineArrowBack } from 'react-icons/md';
import Proptypes from 'prop-types';
import { colors } from '../resource/styling';
import useDisplaySize from '../state/useDisplayType';

export default function BasePageLayout(props) {
  const {
    pageTitle,
    backTo,
    MainContent,
    pageSubtitle,
    extraStyles,
    headerComponent,
  } = props;
  const { type: DisplayType } = useDisplaySize();
  const isMobile = DisplayType === 'mobile';
  return (
    <Div100vh>
      <div className="flex flex-col h-[99%] relative">
        <div
          className={`${
            isMobile ? 'h-[10%]' : 'h-1/6'
          } flex items-center w-full border-b-4 border-slate-500 ${
            colors.primary
          }`}
        >
          <Link className="back-icon" to={backTo}>
            <MdOutlineArrowBack />
          </Link>
          <div className={`${headerComponent ? 'w-[30%]' : 'w-full'}`}>
            <h1 className={`${isMobile ? 'text-md' : 'text-2xl px-3'}  `}>
              {pageTitle}
            </h1>
            <h3 className="text-lg">{pageSubtitle}</h3>
          </div>
          {headerComponent && (
            <div className="h-full w-[70%]">{headerComponent}</div>
          )}
        </div>
        <div
          className={`${
            isMobile ? 'h-[90%]' : 'h-7/8'
          } relative  overflow-y-scroll ${colors.secondary} ${
            extraStyles.content
          }`}
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
  MainContent: '',
  extraStyles: {
    content: '',
  },
  headerComponent: null,
};

BasePageLayout.propTypes = {
  pageTitle: Proptypes.string.isRequired,
  backTo: Proptypes.string,
  MainContent: Proptypes.oneOfType([Proptypes.element, Proptypes.string]),
  headerComponent: Proptypes.element,
  pageSubtitle: Proptypes.string,
  extraStyles: Proptypes.shape({ content: Proptypes.string }),
};
