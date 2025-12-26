import React, { useState } from "react";
import RealisticDentalChart, { CONDITION_LABELS, TOOTH_NAMES } from "../components/RealisticDentalChart";

const DentalChartDemo = () => {
  // Sample teeth data with various conditions (FDI Numbering)
  const [teethData, setTeethData] = useState({
    18: { status: 'present', surfaces: { O: 'filling_amalgam', M: 'filling_amalgam' } }, // UR 3rd Molar
    16: { status: 'present', surfaces: { O: 'cavity', D: 'cavity' } }, // UR 1st Molar
    11: { status: 'present', surfaces: {} }, // UR Central Incisor
    26: { status: 'present', surfaces: { O: 'crown', M: 'crown', D: 'crown', B: 'crown', L: 'crown' } }, // UL 1st Molar
    36: { status: 'rootCanal', surfaces: { O: 'filling_composite' } }, // LL 1st Molar
    28: { status: 'missing', surfaces: {} }, // UL 3rd Molar
    13: { status: 'implant', surfaces: {} }, // UR Canine
  });

  const [selectedTooth, setSelectedTooth] = useState(null);

  const handleToothSelect = (toothNum) => {
    setSelectedTooth(toothNum === selectedTooth ? null : toothNum);
  };

  const handleSurfaceConditionChange = (toothNum, surface, condition) => {
    setTeethData(prev => {
      const toothData = prev[toothNum] || { status: 'present', surfaces: {} };
      const newSurfaces = { ...toothData.surfaces };
      if (condition === 'none') {
        delete newSurfaces[surface];
      } else {
        newSurfaces[surface] = condition;
      }
      return {
        ...prev,
        [toothNum]: {
          ...toothData,
          surfaces: newSurfaces,
        },
      };
    });
  };

  const handleToothStatusChange = (toothNum, status) => {
    setTeethData(prev => {
      const toothData = prev[toothNum] || { status: 'present', surfaces: {} };
      return {
        ...prev,
        [toothNum]: {
          ...toothData,
          status: status,
        },
      };
    });
  };

  return (
    <div className="w-full h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              🦷 Ultra-Realistic Dental Chart
            </h1>
            <p className="text-gray-600 text-lg">
              FDI World Dental Federation Numbering System (International Standard)
            </p>
          </div>

          {/* Dental Chart - Scroll is contained inside the chart component */}
          <div className="bg-white rounded-xl shadow-xl p-4 sm:p-8 mb-8">
          <RealisticDentalChart
            teethData={teethData}
            selectedTooth={selectedTooth}
            onToothSelect={handleToothSelect}
            onSurfaceConditionChange={handleSurfaceConditionChange}
            onToothStatusChange={handleToothStatusChange}
            editable={true}
          />
        </div>

        {/* Selected Tooth Info */}
        {selectedTooth && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8 animate-fadeIn">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">🦷</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Tooth #{selectedTooth}
                </h3>
                <p className="text-gray-600">{TOOTH_NAMES[selectedTooth]}</p>
              </div>
            </div>

            {teethData[selectedTooth] && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-700 font-medium">Status:</span>
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                    {teethData[selectedTooth].status}
                  </span>
                </div>

                {Object.entries(teethData[selectedTooth].surfaces || {}).length > 0 && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-gray-700 font-medium mb-2">Surface Conditions:</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(teethData[selectedTooth].surfaces).map(([surface, condition]) => (
                        <span
                          key={surface}
                          className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold"
                        >
                          {surface}: {CONDITION_LABELS[condition]}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Features List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Realistic Anatomy</h3>
            <p className="text-gray-600 text-sm">
              Each tooth type has accurate anatomical shapes - incisors, canines, premolars, and molars with proper cusps and roots.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Beautiful Gradients</h3>
            <p className="text-gray-600 text-sm">
              Realistic enamel to root color transitions, shadows, highlights, and shine effects make teeth look 3D.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Fully Interactive</h3>
            <p className="text-gray-600 text-sm">
              Click any tooth to mark cavities, fillings, crowns, root canals, or mark teeth as missing/implants.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">5-Surface System</h3>
            <p className="text-gray-600 text-sm">
              Mark conditions on all 5 surfaces: Mesial, Occlusal, Distal, Buccal, and Lingual with color-coded overlays.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Dual View System</h3>
            <p className="text-gray-600 text-sm">
              Side view shows full anatomy, while top/occlusal view shows the biting surface for molars and premolars.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Visual Indicators</h3>
            <p className="text-gray-600 text-sm">
              Green ring for selected teeth, orange ring for affected teeth, and transparent color overlays show conditions.
            </p>
          </div>
        </div>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default DentalChartDemo;

