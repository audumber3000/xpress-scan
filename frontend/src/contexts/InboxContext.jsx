import React, { createContext, useContext, useState } from 'react';

const InboxContext = createContext(null);

export const useInboxActions = () => {
  const context = useContext(InboxContext);
  return context || { inboxActions: null, setInboxActions: () => {} };
};

export const InboxProvider = ({ children }) => {
  const [inboxActions, setInboxActions] = useState(null);

  return (
    <InboxContext.Provider value={{ inboxActions, setInboxActions }}>
      {children}
    </InboxContext.Provider>
  );
};

