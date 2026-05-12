import React, { createContext, useContext, useState } from 'react';

const HeaderContext = createContext();

export const useHeader = () => {
  const context = useContext(HeaderContext);
  if (!context) {
    return {
      title: '',
      refreshFunction: null,
      setTitle: () => {},
      setRefreshFunction: () => {},
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

  const handleRefresh = async () => {
    if (refreshFunction) {
      setLoading(true);
      try {
        await refreshFunction();
      } finally {
        setLoading(false);
      }
    }
  };

  const updateTitle = (nextTitle) => {
    setTitle(nextTitle);
    setTitlePath(window.location.pathname);
  };

  const updateRefreshFunction = (nextRefreshFunction) => {
    setRefreshFunction(() => {
      if (typeof nextRefreshFunction === 'function') {
        return nextRefreshFunction();
      }
      return nextRefreshFunction || null;
    });
    setRefreshPath(window.location.pathname);
  };

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
      }}
    >
      {children}
    </HeaderContext.Provider>
  );
};






