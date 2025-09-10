import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useLocation } from 'react-router-dom';

const WebViewContext = createContext();

export const useWebView = () => {
  const context = useContext(WebViewContext);
  if (!context) {
    throw new Error('useWebView must be used within a WebViewProvider');
  }
  return context;
};

export function WebViewProvider({ children }) {
  const [isWebView, setIsWebView] = useState(false);
  const [initialPath, setInitialPath] = useState(null);
  const [isNavigationLocked, setIsNavigationLocked] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Detect if running specifically in kokkai doc app
    const checkWebView = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      
      // Check for specific kokkai doc app identifier
      // Option 1: Check if webview param has kokkai value
      const urlParams = new URLSearchParams(window.location.search);
      const isKokkaiParam = urlParams.get('webview') === 'kokkai' || urlParams.has('kokkai');
      
      // Option 2: Check if user agent contains kokkai doc identifier
      const isKokkaiUA = /kokkai[\s-]?doc/i.test(userAgent);
      
      // Option 3: Check if custom header or property is set by the app
      const isKokkaiApp = window.isKokkaiDoc === true;
      
      // Only return true if it's specifically the kokkai doc app
      return isKokkaiParam || isKokkaiUA || isKokkaiApp;
    };

    const webViewDetected = checkWebView();
    setIsWebView(webViewDetected);

    // Store initial path when webview is detected and not already set
    if (webViewDetected && !initialPath) {
      setInitialPath(location.pathname);
      setIsNavigationLocked(true);
    }
  }, [location.pathname, initialPath]);

  // Prevent navigation away from initial path in webview
  useEffect(() => {
    if (isWebView && isNavigationLocked && initialPath && location.pathname !== initialPath) {
      // Redirect back to initial path
      window.history.replaceState(null, '', initialPath);
    }
  }, [isWebView, isNavigationLocked, initialPath, location.pathname]);

  // Prevent browser back button in webview
  useEffect(() => {
    if (isWebView && isNavigationLocked) {
      const handlePopstate = (event) => {
        event.preventDefault();
        if (initialPath) {
          window.history.pushState(null, '', initialPath);
        }
      };

      window.addEventListener('popstate', handlePopstate);
      // Push current state to prevent back navigation
      window.history.pushState(null, '', window.location.pathname);

      return () => {
        window.removeEventListener('popstate', handlePopstate);
      };
    }
    return undefined;
  }, [isWebView, isNavigationLocked, initialPath]);

  const value = useMemo(() => ({
    isWebView,
    initialPath,
    isNavigationLocked,
    setIsNavigationLocked,
  }), [isWebView, initialPath, isNavigationLocked]);

  return (
    <WebViewContext.Provider value={value}>
      {children}
    </WebViewContext.Provider>
  );
}

WebViewProvider.propTypes = {
  children: PropTypes.node.isRequired
};