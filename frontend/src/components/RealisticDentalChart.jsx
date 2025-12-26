import React, { useState } from 'react';
import { Odontogram } from 'react-odontogram';

const UNIVERSAL_UPPER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
const UNIVERSAL_LOWER = [32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17];

const TOOTH_NAMES = {
  1: 'UR 3rd Molar', 2: 'UR 2nd Molar', 3: 'UR 1st Molar', 4: 'UR 2nd Premolar', 5: 'UR 1st Premolar',
  6: 'UR Canine', 7: 'UR Lateral Incisor', 8: 'UR Central Incisor',
  9: 'UL Central Incisor', 10: 'UL Lateral Incisor', 11: 'UL Canine', 12: 'UL 1st Premolar',
  13: 'UL 2nd Premolar', 14: 'UL 1st Molar', 15: 'UL 2nd Molar', 16: 'UL 3rd Molar',
  17: 'LL 3rd Molar', 18: 'LL 2nd Molar', 19: 'LL 1st Molar', 20: 'LL 2nd Premolar',
  21: 'LL 1st Premolar', 22: 'LL Canine', 23: 'LL Lateral Incisor', 24: 'LL Central Incisor',
  25: 'LR Central Incisor', 26: 'LR Lateral Incisor', 27: 'LR Canine', 28: 'LR 1st Premolar',
  29: 'LR 2nd Premolar', 30: 'LR 1st Molar', 31: 'LR 2nd Molar', 32: 'LR 3rd Molar',
};

const SURFACE_COLORS = {
  none: '#ffffff',
  cavity: '#ef4444',
  filling_amalgam: '#6b7280',
  filling_composite: '#fbbf24',
  filling_gold: '#fcd34d',
  crown: '#8b5cf6',
  rootCanal: '#f97316',
  fracture: '#dc2626',
};

const CONDITION_LABELS = {
  cavity: 'Cavity',
  filling_amalgam: 'Amalgam',
  filling_composite: 'Composite',
  filling_gold: 'Gold',
  crown: 'Crown',
  rootCanal: 'Root Canal',
  fracture: 'Fracture',
};

const STATUS_COLORS = {
  present: '#10b981',
  missing: '#ef4444',
  implant: '#3b82f6',
  rootCanal: '#f97316',
};

const STATUS_LABELS = {
  present: 'Present',
  missing: 'Missing',
  implant: 'Implant',
  rootCanal: 'Root Canal',
};

// Realistic tooth images - using high-quality SVG paths for anatomical accuracy
const getRealisticToothImage = (toothNum, view = 'side') => {
  const baseTooth = {
    width: 60,
    height: 80,
    viewBox: "0 0 60 80"
  };

  if (view === 'side') {
    // Side view - anatomical profile
    return (
      <svg {...baseTooth} className="w-full h-full drop-shadow-md">
        <defs>
          <linearGradient id={`enamel-${toothNum}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{stopColor: '#ffffff', stopOpacity: 1}} />
            <stop offset="70%" style={{stopColor: '#f8f8f8', stopOpacity: 1}} />
            <stop offset="100%" style={{stopColor: '#f0f0f0', stopOpacity: 1}} />
          </linearGradient>
          <linearGradient id={`root-${toothNum}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{stopColor: '#f0f0f0', stopOpacity: 1}} />
            <stop offset="50%" style={{stopColor: '#d4c4a8', stopOpacity: 1}} />
            <stop offset="100%" style={{stopColor: '#b8a476', stopOpacity: 1}} />
          </linearGradient>
        </defs>
        
        {/* Tooth crown */}
        {toothNum >= 1 && toothNum <= 8 && (
          // Upper right teeth - slight angle
          <path 
            d="M 20 10 L 40 10 L 42 15 L 41 35 L 38 40 L 22 40 L 19 35 L 18 15 Z" 
            fill={`url(#enamel-${toothNum})`} 
            stroke="#e0e0e0" 
            strokeWidth="0.5"
          />
        )}
        {toothNum >= 9 && toothNum <= 16 && (
          // Upper left teeth - slight angle
          <path 
            d="M 20 10 L 40 10 L 42 15 L 41 35 L 38 40 L 22 40 L 19 35 L 18 15 Z" 
            fill={`url(#enamel-${toothNum})`} 
            stroke="#e0e0e0" 
            strokeWidth="0.5"
          />
        )}
        {toothNum >= 17 && toothNum <= 32 && (
          // Lower teeth - inverted
          <path 
            d="M 20 40 L 40 40 L 42 45 L 41 65 L 38 70 L 22 70 L 19 65 L 18 45 Z" 
            fill={`url(#enamel-${toothNum})`} 
            stroke="#e0e0e0" 
            strokeWidth="0.5"
          />
        )}
        
        {/* Tooth root */}
        {toothNum >= 1 && toothNum <= 16 && (
          <path 
            d="M 22 40 L 38 40 L 35 65 L 30 72 L 25 65 Z" 
            fill={`url(#root-${toothNum})`} 
            stroke="#c4b5a0" 
            strokeWidth="0.5"
          />
        )}
        {toothNum >= 17 && toothNum <= 32 && (
          <path 
            d="M 22 70 L 38 70 L 35 75 L 30 78 L 25 75 Z" 
            fill={`url(#root-${toothNum})`} 
            stroke="#c4b5a0" 
            strokeWidth="0.5"
          />
        )}
      </svg>
    );
  } else {
    // Top view - occlusal surface
    return (
      <svg {...baseTooth} className="w-full h-full drop-shadow-md">
        <defs>
          <radialGradient id={`occlusal-${toothNum}`}>
            <stop offset="0%" style={{stopColor: '#ffffff', stopOpacity: 1}} />
            <stop offset="100%" style={{stopColor: '#f5f5f5', stopOpacity: 1}} />
          </radialGradient>
        </defs>
        
        {/* Central Incisors - rectangular */}
        {[8, 9, 24, 25].includes(toothNum) && (
          <rect x="15" y="20" width="30" height="40" rx="3" fill={`url(#occlusal-${toothNum})`} stroke="#e0e0e0" strokeWidth="0.5" />
        )}
        
        {/* Lateral Incisors - rounded rectangle */}
        {[7, 10, 23, 26].includes(toothNum) && (
          <rect x="16" y="22" width="28" height="36" rx="5" fill={`url(#occlusal-${toothNum})`} stroke="#e0e0e0" strokeWidth="0.5" />
        )}
        
        {/* Canines - pointed oval */}
        {[6, 11, 22, 27].includes(toothNum) && (
          <ellipse cx="30" cy="40" rx="12" ry="20" fill={`url(#occlusal-${toothNum})`} stroke="#e0e0e0" strokeWidth="0.5" />
        )}
        
        {/* Premolars - two cusps */}
        {[4, 5, 12, 13, 20, 21, 28, 29].includes(toothNum) && (
          <path d="M 20 25 L 40 25 L 42 35 L 38 45 L 22 45 L 18 35 Z" fill={`url(#occlusal-${toothNum})`} stroke="#e0e0e0" strokeWidth="0.5" />
        )}
        
        {/* Molars - multiple cusps */}
        {[1, 2, 3, 14, 15, 16, 17, 18, 19, 30, 31, 32].includes(toothNum) && (
          <path d="M 15 20 L 45 20 L 48 30 L 45 40 L 40 50 L 20 50 L 15 40 L 12 30 Z" fill={`url(#occlusal-${toothNum})`} stroke="#e0e0e0" strokeWidth="0.5" />
        )}
      </svg>
    );
  }
};

const RealisticToothUnit = ({ toothNum, isUpper, status, surfaces, isSelected, onToothPress }) => {
  const getSurfaceColor = (surface) => {
    return SURFACE_COLORS[surfaces?.[surface]] || SURFACE_COLORS.none;
  };

  const isAffected = status !== 'present' || Object.keys(surfaces || {}).some(s => surfaces[s] !== 'none');

  return (
    <div className="flex flex-col items-center space-y-2">
      {/* Side View */}
      <div className="relative">
        <button
          onClick={() => onToothPress(toothNum)}
          className={`relative transition-all hover:scale-105 ${isSelected ? 'ring-2 ring-green-500 ring-offset-2' : ''}`}
        >
          <div className="w-16 h-20 relative">
            {status === 'missing' ? (
              <svg viewBox="0 0 60 80" className="w-full h-full">
                <line x1="15" y1="15" x2="45" y2="65" stroke="#ef4444" strokeWidth="3" />
                <line x1="45" y1="15" x2="15" y2="65" stroke="#ef4444" strokeWidth="3" />
              </svg>
            ) : status === 'implant' ? (
              <svg viewBox="0 0 60 80" className="w-full h-full">
                <rect x="25" y="10" width="10" height="20" fill="#3b82f6" />
                <rect x="18" y="30" width="24" height="40" rx="3" fill="#e5e7eb" stroke={STATUS_COLORS[status]} strokeWidth="2" />
              </svg>
            ) : (
              <div className="relative">
                {getRealisticToothImage(toothNum, 'side')}
                
                {/* Surface condition overlays */}
                {Object.entries(surfaces || {}).map(([surface, condition]) => (
                  condition !== 'none' && (
                    <div key={surface} className="absolute inset-0 flex items-center justify-center">
                      <div 
                        className="w-3 h-3 rounded-full opacity-70" 
                        style={{ backgroundColor: getSurfaceColor(surface) }}
                        title={`${surface}: ${CONDITION_LABELS[condition]}`}
                      />
                    </div>
                  )
                ))}
                
                {/* Status indicator */}
                {isAffected && (
                  <div className="absolute inset-0 border-2 rounded-lg" 
                    style={{ 
                      borderColor: STATUS_COLORS[status],
                      borderStyle: status === 'rootCanal' ? 'dashed' : 'solid'
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </button>
        <span className="text-xs font-medium text-gray-700 text-center mt-1">{toothNum}</span>
      </div>
      
      {/* Top View */}
      <div className="relative">
        <button
          onClick={() => onToothPress(toothNum)}
          className={`relative transition-all hover:scale-105 ${isSelected ? 'ring-2 ring-green-500 ring-offset-2' : ''}`}
        >
          <div className="w-12 h-16 relative">
            {status !== 'missing' && status !== 'implant' && (
              <div className="relative">
                {getRealisticToothImage(toothNum, 'top')}
                
                {/* Occlusal surface conditions */}
                {surfaces?.O && surfaces.O !== 'none' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div 
                      className="w-4 h-4 rounded-full opacity-60" 
                      style={{ backgroundColor: getSurfaceColor('O') }}
                      title={`Occlusal: ${CONDITION_LABELS[surfaces.O]}`}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </button>
        <span className="text-xs text-gray-500 text-center">Top</span>
      </div>
    </div>
  );
};

const SurfaceSelectionModal = ({ 
  visible, 
  toothNum, 
  currentSurfaces = {},
  currentStatus = 'present',
  onClose, 
  onSurfaceConditionChange,
  onToothStatusChange
}) => {
  const [selectedSurface, setSelectedSurface] = useState(null);
  
  const surfaces = [
    { key: 'M', label: 'Mesial', desc: 'Side toward midline' },
    { key: 'O', label: 'Occlusal', desc: 'Biting surface' },
    { key: 'D', label: 'Distal', desc: 'Side away from midline' },
    { key: 'B', label: 'Buccal', desc: 'Cheek side' },
    { key: 'L', label: 'Lingual', desc: 'Tongue side' },
  ];

  const conditions = Object.entries(SURFACE_COLORS).filter(([key]) => key !== 'none');

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900">
            Tooth #{toothNum} - {TOOTH_NAMES[toothNum]}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {/* Tooth Status */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Tooth Status:</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => onToothStatusChange(toothNum, key)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    currentStatus === key
                      ? 'text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  style={currentStatus === key ? { backgroundColor: STATUS_COLORS[key] } : {}}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Surface Selection */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Select Surface:</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {surfaces.map(({ key, label, desc }) => (
                <button
                  key={key}
                  onClick={() => setSelectedSurface(key)}
                  className={`p-3 rounded-lg border-2 transition-all text-left ${
                    selectedSurface === key
                      ? 'border-green-500 bg-green-50'
                      : currentSurfaces[key] && currentSurfaces[key] !== 'none'
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">{label} ({key})</div>
                      <div className="text-xs text-gray-500">{desc}</div>
                    </div>
                    {currentSurfaces[key] && currentSurfaces[key] !== 'none' && (
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: SURFACE_COLORS[currentSurfaces[key]] }}
                      />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Condition Selection */}
          {selectedSurface && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Select Condition for {selectedSurface}:
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <button
                  onClick={() => {
                    onSurfaceConditionChange(toothNum, selectedSurface, 'none');
                  }}
                  className="px-4 py-3 rounded-lg border-2 border-gray-300 bg-white hover:bg-gray-50 font-medium text-sm"
                >
                  Clear
                </button>
                {conditions.map(([key, color]) => (
                  <button
                    key={key}
                    onClick={() => {
                      onSurfaceConditionChange(toothNum, selectedSurface, key);
                    }}
                    className="px-4 py-3 rounded-lg font-medium text-sm text-white shadow-sm hover:shadow-md transition-all"
                    style={{ backgroundColor: color }}
                  >
                    {CONDITION_LABELS[key]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

const RealisticDentalChart = ({
  teethData = {},
  selectedTooth,
  onToothSelect,
  onSurfaceConditionChange,
  onToothStatusChange,
  editable = true,
}) => {
  const [showSurfaceModal, setShowSurfaceModal] = useState(false);
  const [modalTooth, setModalTooth] = useState(null);

  const handleToothPress = (toothNum) => {
    onToothSelect(toothNum);
    if (editable) {
      setModalTooth(toothNum);
      setShowSurfaceModal(true);
    }
  };

  const getToothData = (toothNum) => {
    return teethData[toothNum] || { status: 'present', surfaces: {} };
  };

  return (
    <div className="w-full">
      {/* Legend */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Surface Conditions:</h4>
        <div className="flex flex-wrap gap-3">
          {Object.entries(SURFACE_COLORS).filter(([k]) => k !== 'none').map(([key, color]) => (
            <div key={key} className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: color }} />
              <span className="text-sm text-gray-700">{CONDITION_LABELS[key]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chart Container with Dual Views */}
      <div className="space-y-8">
        {/* Side View */}
        <div>
          <h4 className="text-lg font-semibold text-gray-900 mb-4 text-center">Side View</h4>
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              {/* Upper Arch Label */}
              <div className="flex justify-between mb-2 px-4">
                <span className="text-sm font-semibold text-gray-600">Upper Right</span>
                <span className="text-sm font-semibold text-gray-600">Upper Left</span>
              </div>

              {/* Upper Teeth Row */}
              <div className="flex justify-center gap-2 mb-4">
                {UNIVERSAL_UPPER.map((toothNum) => {
                  const data = getToothData(toothNum);
                  return (
                    <RealisticToothUnit
                      key={toothNum}
                      toothNum={toothNum}
                      isUpper={true}
                      status={data.status}
                      surfaces={data.surfaces}
                      isSelected={selectedTooth === toothNum}
                      onToothPress={handleToothPress}
                    />
                  );
                })}
              </div>

              {/* Midline Divider */}
              <div className="flex items-center justify-center my-4">
                <div className="flex-1 border-t-2 border-gray-300" />
                <span className="px-4 text-sm font-semibold text-gray-600">R | L</span>
                <div className="flex-1 border-t-2 border-gray-300" />
              </div>

              {/* Lower Teeth Row */}
              <div className="flex justify-center gap-2 mb-2">
                {UNIVERSAL_LOWER.map((toothNum) => {
                  const data = getToothData(toothNum);
                  return (
                    <RealisticToothUnit
                      key={toothNum}
                      toothNum={toothNum}
                      isUpper={false}
                      status={data.status}
                      surfaces={data.surfaces}
                      isSelected={selectedTooth === toothNum}
                      onToothPress={handleToothPress}
                    />
                  );
                })}
              </div>

              {/* Lower Arch Label */}
              <div className="flex justify-between mt-2 px-4">
                <span className="text-sm font-semibold text-gray-600">Lower Right</span>
                <span className="text-sm font-semibold text-gray-600">Lower Left</span>
              </div>
            </div>
          </div>
        </div>

        {/* Top View */}
        <div>
          <h4 className="text-lg font-semibold text-gray-900 mb-4 text-center">Occlusal (Top) View</h4>
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              {/* Upper Arch Label */}
              <div className="flex justify-between mb-2 px-4">
                <span className="text-sm font-semibold text-gray-600">Upper Right</span>
                <span className="text-sm font-semibold text-gray-600">Upper Left</span>
              </div>

              {/* Upper Teeth Row */}
              <div className="flex justify-center gap-2 mb-4">
                {UNIVERSAL_UPPER.map((toothNum) => {
                  const data = getToothData(toothNum);
                  return (
                    <RealisticToothUnit
                      key={toothNum}
                      toothNum={toothNum}
                      isUpper={true}
                      status={data.status}
                      surfaces={data.surfaces}
                      isSelected={selectedTooth === toothNum}
                      onToothPress={handleToothPress}
                    />
                  );
                })}
              </div>

              {/* Midline Divider */}
              <div className="flex items-center justify-center my-4">
                <div className="flex-1 border-t-2 border-gray-300" />
                <span className="px-4 text-sm font-semibold text-gray-600">R | L</span>
                <div className="flex-1 border-t-2 border-gray-300" />
              </div>

              {/* Lower Teeth Row */}
              <div className="flex justify-center gap-2 mb-2">
                {UNIVERSAL_LOWER.map((toothNum) => {
                  const data = getToothData(toothNum);
                  return (
                    <RealisticToothUnit
                      key={toothNum}
                      toothNum={toothNum}
                      isUpper={false}
                      status={data.status}
                      surfaces={data.surfaces}
                      isSelected={selectedTooth === toothNum}
                      onToothPress={handleToothPress}
                    />
                  );
                })}
              </div>

              {/* Lower Arch Label */}
              <div className="flex justify-between mt-2 px-4">
                <span className="text-sm font-semibold text-gray-600">Lower Right</span>
                <span className="text-sm font-semibold text-gray-600">Lower Left</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Surface Selection Modal */}
      <SurfaceSelectionModal
        visible={showSurfaceModal}
        toothNum={modalTooth}
        currentSurfaces={modalTooth ? getToothData(modalTooth).surfaces : {}}
        currentStatus={modalTooth ? getToothData(modalTooth).status : 'present'}
        onClose={() => setShowSurfaceModal(false)}
        onSurfaceConditionChange={onSurfaceConditionChange}
        onToothStatusChange={onToothStatusChange}
      />
    </div>
  );
};

export default RealisticDentalChart;
export { CONDITION_LABELS, TOOTH_NAMES };
