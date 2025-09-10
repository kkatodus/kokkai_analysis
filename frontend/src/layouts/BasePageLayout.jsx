import React from 'react';
import Div100vh from 'react-div-100vh';
import { Link } from 'react-router-dom';
import ModalManager from 'modals';
import { MdOutlineArrowBack } from 'react-icons/md';
import Proptypes from 'prop-types';
import { colors } from '../resource/styling';
import useDisplaySize from '../state/useDisplayType';
import { useWebView } from '../contexts/WebViewContext';

export default function BasePageLayout(props) {
  const {
    pageTitle,
    backTo,
    MainContent,
    pageSubtitle,
    extraStyles,
    headerComponent,
	showPageTitle,
  } = props;
  const { type: DisplayType } = useDisplaySize();
  const { isWebView } = useWebView();
  const isMobile = DisplayType === 'mobile';
  return (
    <Div100vh>
      <div className="flex flex-col h-[99%] relative">
        <ModalManager />

        <div
          className={`${
            isMobile ? 'h-[10%]' : 'h-1/6'
          } flex items-center w-full border-b-4 border-slate-500 ${
            colors.primary
          }`}
        >
          {!isWebView && (
            <Link className="back-icon" to={backTo}>
              <MdOutlineArrowBack />
            </Link>
          )}
          <div className={`${headerComponent ? '' : 'w-full'}`}>
            <h1 className={`${isMobile ? 'text-sm' : 'text-2xl px-3'}  ${showPageTitle ? '' : 'hidden'}`}>
              {pageTitle}
            </h1>
            <h3 className={`${showPageTitle ? '' : 'hidden'} text-lg`}>{pageSubtitle}</h3>
          </div>
          {headerComponent && (
            <div className="h-full flex-1">{headerComponent}</div>
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
  showPageTitle: true,
};

BasePageLayout.propTypes = {
  pageTitle: Proptypes.string.isRequired,
  backTo: Proptypes.string,
  MainContent: Proptypes.oneOfType([Proptypes.element, Proptypes.string]),
  headerComponent: Proptypes.element,
  pageSubtitle: Proptypes.string,
  extraStyles: Proptypes.shape({ content: Proptypes.string }),
  showPageTitle: Proptypes.bool,
};
