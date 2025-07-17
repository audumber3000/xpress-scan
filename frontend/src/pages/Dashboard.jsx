import React from "react";

const cardStyles = [
  "col-span-2 row-span-1 min-h-[120px]",
  "col-span-1 row-span-1 min-h-[120px]",
  "col-span-1 row-span-2 min-h-[250px]",
  "col-span-2 row-span-1 min-h-[120px]",
  "col-span-1 row-span-1 min-h-[120px]",
  "col-span-1 row-span-1 min-h-[120px]",
];

const Dashboard = () => {
  return (
    <div className="flex flex-col h-full w-full p-0 bg-gray-50">
      <div className="flex-1 w-full h-full max-w-none mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-4 px-8 pt-8">Welcome to the Dashboard</h1>
        <p className="text-green-600 font-medium mb-8 px-8">This is your clinic's main dashboard. Analytics and quick stats will appear here soon.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-[120px] px-8 pb-8 h-[calc(100vh-120px)]">
          {cardStyles.map((style, idx) => (
            <div
              key={idx}
              className={`bg-white rounded-2xl shadow flex flex-col items-center justify-center border border-gray-100 ${style} h-full w-full`}
            >
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-2">
                <span className="text-2xl text-gray-300">📊</span>
              </div>
              <div className="text-gray-400 font-semibold text-lg">No data available</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 