import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { useWebView } from '../contexts/WebViewContext';

// eslint-disable-next-line no-unused-vars
export default function WebViewLink({ children, to, className, ...props }) {
  const { isWebView } = useWebView();

  if (isWebView) {
    return (
      <div className={`${className} opacity-50 cursor-not-allowed`}>
        {children}
      </div>
    );
  }

  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  );
}

WebViewLink.propTypes = {
  children: PropTypes.node.isRequired,
  to: PropTypes.string.isRequired,
  className: PropTypes.string
};

WebViewLink.defaultProps = {
  className: ''
};