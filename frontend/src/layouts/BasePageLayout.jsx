import React from 'react';
import { Link } from 'react-router-dom';
import { MdOutlineArrowBack } from 'react-icons/md';
import Proptypes from 'prop-types';
import { colors } from '../resource/styling';

export default function BasePageLayout(props) {
  const { pageTitle, backTo, MainContent } = props;
  return (
    <div className="flex flex-col h-screen relative">
      <div className={`h-1/6 flex items-center ${colors.primary}`}>
        <Link className="back-icon" to={backTo}>
          <MdOutlineArrowBack />
        </Link>
        <h1 className="text-4xl px-3 ">{pageTitle}</h1>
      </div>
      <div
        className={`flex flex-col items-center relative h-5/6 overflow-y-scroll bg-slate-300 ${colors.secondary}`}
      >
        {MainContent}
      </div>
    </div>
  );
}

BasePageLayout.defaultProps = {
  backTo: '/',
};

BasePageLayout.propTypes = {
  pageTitle: Proptypes.string.isRequired,
  backTo: Proptypes.string,
  MainContent: Proptypes.oneOfType([
    Proptypes.element,
    Proptypes.arrayOf(Proptypes.element),
  ]).isRequired,
};
