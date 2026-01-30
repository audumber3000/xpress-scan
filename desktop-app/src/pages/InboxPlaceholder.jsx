import React from 'react';
import { useHeader } from '../contexts/HeaderContext';

const InboxPlaceholder = () => {
  const { setTitle } = useHeader();
  React.useEffect(() => {
    setTitle && setTitle('Inbox');
  }, [setTitle]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Inbox (WhatsApp)</h2>
        <p className="text-gray-600">This view will match the web app in a later update. Use app.molarplus.com for full inbox until then.</p>
      </div>
    </div>
  );
};

export default InboxPlaceholder;
