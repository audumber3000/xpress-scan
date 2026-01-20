import React, { useEffect } from "react";
import { useHeader } from "../contexts/HeaderContext";

const Xray = () => {
  const { setTitle } = useHeader();

  useEffect(() => {
    setTitle('X-ray');
  }, [setTitle]);

  return (
    <div className="flex flex-col items-center justify-center h-full bg-gray-50 p-6">
      <div className="max-w-md w-full bg-white border border-gray-200 rounded-lg p-8 text-center">
        <svg className="w-16 h-16 text-blue-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Desktop App Required</h2>
        <p className="text-gray-600 mb-4">
          X-ray feature requires the Windows desktop app to connect with TWAIN-compatible RVG sensors.
        </p>
        <p className="text-sm text-gray-500 mb-6">
          The X-ray feature uses the TWAIN protocol which is only available on Windows. Please download and install the desktop app for Windows to use this feature.
        </p>
        <button
          onClick={() => window.open('#', '_blank')}
          className="px-6 py-3 bg-[#2a276e] hover:bg-[#1a1548] text-white rounded-lg font-medium transition-colors"
        >
          Download Desktop App for Windows
        </button>
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">System Requirements:</h3>
          <ul className="text-xs text-gray-600 text-left space-y-1">
            <li>• Windows 10 or later</li>
            <li>• TWAIN-compatible RVG sensor with driver installed</li>
            <li>• Desktop app installed on Windows</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Xray;

