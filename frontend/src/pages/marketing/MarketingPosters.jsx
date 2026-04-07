import React from 'react';

const MarketingPosters = () => {
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 border-b-2 border-[#29828a] pb-1 inline-block">Marketing Posters</h1>
          <p className="text-gray-500 text-sm mt-1">Manage and download your clinic's marketing materials.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center h-[60vh] flex flex-col items-center justify-center">
        <svg className="w-16 h-16 text-[#29828a]/40 mb-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Coming Soon</h2>
        <p className="text-gray-500 max-w-md mx-auto">
          We are working hard to bring you a library of customizable marketing posters for your practice. Stay tuned!
        </p>
      </div>
    </div>
  );
};

export default MarketingPosters;
