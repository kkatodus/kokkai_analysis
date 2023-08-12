import React from 'react';
import { Link } from 'react-router-dom';
import { MdOutlineArrowBack } from 'react-icons/md';
import Proptypes from 'prop-types';
import { colors } from '../resource/styling';

export default function BasePageLayout(props) {
  const { pageTitle, backTo, MainContent, extraStyles } = props;
  return (
    <div className="flex flex-col h-screen relative overflow-hidden">
      <div className={`flex items-center h-1/8 ${colors.primary}`}>
        {backTo && (
          <Link className="back-icon" to={backTo}>
            <MdOutlineArrowBack />
          </Link>
        )}

        <h1 className="text-3xl">{pageTitle}</h1>
      </div>
      <div
        className={`flex flex-col items-center relative h-7/8 overflow-y-scroll ${colors.secondary} ${extraStyles.content}`}
      >
        {MainContent}
      </div>
    </div>
  );
}

BasePageLayout.defaultProps = {
  backTo: undefined,
  extraStyles: { content: '' },
};

BasePageLayout.propTypes = {
  pageTitle: Proptypes.string.isRequired,
  backTo: Proptypes.string,
  MainContent: Proptypes.oneOfType([
    Proptypes.element,
    Proptypes.arrayOf(Proptypes.element),
  ]).isRequired,
  extraStyles: Proptypes.shape({
    content: Proptypes.string,
  }),
};
