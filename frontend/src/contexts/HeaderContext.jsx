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
  const [refreshFunction, setRefreshFunction] = useState(null);
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

  return (
    <HeaderContext.Provider
      value={{
        title,
        refreshFunction,
        loading,
        setTitle,
        setRefreshFunction,
        handleRefresh,
      }}
    >
      {children}
    </HeaderContext.Provider>
  );
};



