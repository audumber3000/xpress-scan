import React, { createContext, useCallback, useContext, useState } from 'react';

const HeaderContext = createContext();

export const useHeader = () => {
  const context = useContext(HeaderContext);
  if (!context) {
    return {
      title: '',
      refreshFunction: null,
      setTitle: () => {},
      setRefreshFunction: () => {},
      sidebarCollapsed: false,
      setSidebarCollapsed: () => {},
    };
  }
  return context;
};

export const HeaderProvider = ({ children }) => {
  const [title, setTitle] = useState('');
  const [titlePath, setTitlePath] = useState('');
  const [refreshFunction, setRefreshFunction] = useState(null);
  const [refreshPath, setRefreshPath] = useState('');
  const [loading, setLoading] = useState(false);
  // Chrome the page can drive. A screen that opens a wide panel of its own
  // (the calendar's appointment drawer) needs the nav out of the way, and the
  // nav is rendered above the router, so the request has to travel up here.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // All callbacks are wrapped in useCallback so their identity is stable across
  // re-renders. Without this, consumers that put `setTitle` / `setRefreshFunction`
  // in a useEffect dependency array would re-run the effect on every provider
  // render, causing infinite render + API-call loops on pages like /payments
  // and /patients (which both set the refresh function inside an effect).
  const handleRefresh = useCallback(async () => {
    if (refreshFunction) {
      setLoading(true);
      try {
        await refreshFunction();
      } finally {
        setLoading(false);
      }
    }
  }, [refreshFunction]);

  const updateTitle = useCallback((nextTitle) => {
    setTitle(nextTitle);
    setTitlePath(window.location.pathname);
  }, []);

  const updateRefreshFunction = useCallback((nextRefreshFunction) => {
    setRefreshFunction(() => {
      if (typeof nextRefreshFunction === 'function') {
        return nextRefreshFunction();
      }
      return nextRefreshFunction || null;
    });
    setRefreshPath(window.location.pathname);
  }, []);

  return (
    <HeaderContext.Provider
      value={{
        title,
        titlePath,
        refreshFunction,
        refreshPath,
        loading,
        setTitle: updateTitle,
        setRefreshFunction: updateRefreshFunction,
        handleRefresh,
        sidebarCollapsed,
        setSidebarCollapsed,
      }}
    >
      {children}
    </HeaderContext.Provider>
  );
};
