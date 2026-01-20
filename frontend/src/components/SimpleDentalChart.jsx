import React, { useEffect, useState } from 'react';

const FDI_UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const FDI_UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
const FDI_LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];
const FDI_LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];

const TOOTH_NAMES = {
  11: 'UR Central Incisor',
  12: 'UR Lateral Incisor',
  13: 'UR Canine',
  14: 'UR 1st Premolar',
  15: 'UR 2nd Premolar',
  16: 'UR 1st Molar',
  17: 'UR 2nd Molar',
  18: 'UR 3rd Molar',
  21: 'UL Central Incisor',
  22: 'UL Lateral Incisor',
  23: 'UL Canine',
  24: 'UL 1st Premolar',
  25: 'UL 2nd Premolar',
  26: 'UL 1st Molar',
  27: 'UL 2nd Molar',
  28: 'UL 3rd Molar',
  31: 'LL Central Incisor',
  32: 'LL Lateral Incisor',
  33: 'LL Canine',
  34: 'LL 1st Premolar',
  35: 'LL 2nd Premolar',
  36: 'LL 1st Molar',
  37: 'LL 2nd Molar',
  38: 'LL 3rd Molar',
  41: 'LR Central Incisor',
  42: 'LR Lateral Incisor',
  43: 'LR Canine',
  44: 'LR 1st Premolar',
  45: 'LR 2nd Premolar',
  46: 'LR 1st Molar',
  47: 'LR 2nd Molar',
  48: 'LR 3rd Molar',
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

// Realistic tooth shape function
const getRealisticToothShape = (toothNum, status, surfaces, onSurfacePress) => {
  const isAffected = status !== 'present' || Object.keys(surfaces || {}).some(s => surfaces[s] !== 'none');
  
  const quadrant = Math.floor(toothNum / 10);
  const isUpper = quadrant === 1 || quadrant === 2;
  const isRightQuadrant = quadrant === 1 || quadrant === 4;
  const buccalIsTop = isUpper;
  const mesialIsRight = isRightQuadrant;

  if (status === 'missing') {
    return (
      <>
        <circle cx="50" cy="50" r="2" fill="#dc2626" opacity="0.8" />
        <circle cx="48" cy="48" r="1.5" fill="#dc2626" opacity="0.6" />
        <circle cx="52" cy="52" r="1.5" fill="#dc2626" opacity="0.6" />
      </>
    );
  }

  if (status === 'implant') {
    return (
      <>
        <rect x="46" y="20" width="8" height="25" rx="1" fill="#6b7280" />
        <rect x="44" y="45" width="12" height="35" rx="2" fill="#9ca3af" stroke="#374151" strokeWidth="0.5" />
        <circle cx="50" cy="50" r="18" fill="none" stroke="#374151" strokeWidth="1" opacity="0.3" />
      </>
    );
  }

  const toothType = (() => {
    if ([11, 21, 31, 41].includes(toothNum)) return 'central-incisor';
    if ([12, 22, 32, 42].includes(toothNum)) return 'lateral-incisor';
    if ([13, 23, 33, 43].includes(toothNum)) return 'canine';
    if ([14, 15, 24, 25, 34, 35, 44, 45].includes(toothNum)) return 'premolar';
    return 'molar';
  })();

  const bounds = (() => {
    switch (toothType) {
      case 'central-incisor':
        return { x: 30, y: 16, w: 40, h: 70, rx: 12 };
      case 'lateral-incisor':
        return { x: 32, y: 18, w: 36, h: 66, rx: 14 };
      case 'canine':
        return { x: 32, y: 16, w: 36, h: 70, rx: 18 };
      case 'premolar':
        return { x: 24, y: 16, w: 52, h: 72, rx: 22 };
      default:
        return { x: 18, y: 14, w: 64, h: 76, rx: 26 };
    }
  })();

  const enamelGradientId = `enamel-${toothNum}`;
  const textureId = `enamel-texture-${toothNum}`;
  const shadowId = `shadow-${toothNum}`;
  const highlightId = `highlight-${toothNum}`;

  const surfaceColor = (surfaceKey) => {
    const cond = surfaces?.[surfaceKey];
    if (!cond || cond === 'none') return null;
    return SURFACE_COLORS[cond] || null;
  };

  const handleSurfaceClick = (surfaceKey) => (e) => {
    if (!onSurfacePress) return;
    e.stopPropagation();
    onSurfacePress(toothNum, surfaceKey);
  };

  const crownPath = (() => {
    const cx = 50, cy = 50;
    
    if (toothType === 'central-incisor') {
      return `M 42 28
        L 42 65
        Q 42 72 48 72
        L 52 72
        Q 58 72 58 65
        L 58 28
        Q 58 22 52 22
        L 48 22
        Q 42 22 42 28
        Z`;
    }
    
    if (toothType === 'lateral-incisor') {
      return `M 44 30
        L 44 62
        Q 44 68 48 68
        L 52 68
        Q 56 68 56 62
        L 56 30
        Q 56 25 52 25
        L 48 25
        Q 44 25 44 30
        Z`;
    }
    
    if (toothType === 'canine') {
      return `M 40 25
        L 40 70
        Q 40 76 46 76
        L 54 76
        Q 60 76 60 70
        L 60 25
        Q 60 20 54 20
        L 46 20
        Q 40 20 40 25
        Z`;
    }
    
    if (toothType === 'premolar') {
      return `M 38 25
        L 38 68
        Q 38 74 44 74
        L 56 74
        Q 62 74 62 68
        L 62 25
        Q 62 20 56 20
        L 44 20
        Q 38 20 38 25
        Z`;
    }
    
    // Molar - more complex shape with cusps
    return `M 32 22
      L 32 65
      Q 32 72 38 72
      L 62 72
      Q 68 72 68 65
      L 68 22
      Q 68 18 62 18
      L 38 18
      Q 32 18 32 22
      Z`;
  })();

  const fissurePath = (() => {
    const cx = 50, cy = 50;
    if (toothType === 'molar') {
      return `M ${cx - 12} ${cy - 8}
        Q ${cx - 6} ${cy - 12} ${cx} ${cy - 8}
        Q ${cx + 6} ${cy - 4} ${cx + 12} ${cy - 6}
        M ${cx - 14} ${cy + 6}
        Q ${cx - 8} ${cy + 2} ${cx} ${cy + 8}
        Q ${cx + 8} ${cy + 4} ${cx + 14} ${cy + 2}
        M ${cx - 8} ${cy - 2}
        Q ${cx - 2} ${cy + 2} ${cx + 2} ${cy - 4}`;
    }
    if (toothType === 'premolar') {
      return `M ${cx - 8} ${cy}
        Q ${cx - 4} ${cy - 6} ${cx} ${cy}
        Q ${cx + 4} ${cy + 6} ${cx + 8} ${cy}
        M ${cx - 6} ${cy + 4}
        Q ${cx - 2} ${cy + 8} ${cx + 2} ${cy + 4}`;
    }
    if (toothType === 'canine') {
      return `M ${cx} ${cy - 8}
        Q ${cx - 4} ${cy} ${cx} ${cy + 8}
        Q ${cx + 4} ${cy} ${cx} ${cy - 8}`;
    }
    // Incisors - minimal fissures
    return `M ${cx - 4} ${cy}
      Q ${cx} ${cy - 4} ${cx + 4} ${cy}`;
  })();

  const regions = (() => {
    const pad = 6;
    const left = 32 + pad;
    const right = 68 - pad;
    const top = 22 + pad;
    const bottom = 78 - pad;
    const midX = 50;
    const midY = 50;

    const mesial = mesialIsRight
      ? `M ${midX + 6} ${top} L ${right} ${midY} L ${midX + 6} ${bottom} L ${midX} ${midY} Z`
      : `M ${midX - 6} ${top} L ${left} ${midY} L ${midX - 6} ${bottom} L ${midX} ${midY} Z`;

    const distal = mesialIsRight
      ? `M ${midX - 6} ${top} L ${left} ${midY} L ${midX - 6} ${bottom} L ${midX} ${midY} Z`
      : `M ${midX + 6} ${top} L ${right} ${midY} L ${midX + 6} ${bottom} L ${midX} ${midY} Z`;

    const buccal = buccalIsTop
      ? `M ${left} ${top} L ${right} ${top} L ${right - 8} ${midY - 4} L ${left + 8} ${midY - 4} Z`
      : `M ${left} ${bottom} L ${right} ${bottom} L ${right - 8} ${midY + 4} L ${left + 8} ${midY + 4} Z`;

    const lingual = buccalIsTop
      ? `M ${left} ${bottom} L ${right} ${bottom} L ${right - 8} ${midY + 4} L ${left + 8} ${midY + 4} Z`
      : `M ${left} ${top} L ${right} ${top} L ${right - 8} ${midY - 4} L ${left + 8} ${midY - 4} Z`;

    const occlusal = toothType === 'molar'
      ? `M ${midX} ${midY - 12}
        C ${midX + 14} ${midY - 10}, ${midX + 14} ${midY + 10}, ${midX} ${midY + 12}
        C ${midX - 14} ${midY + 10}, ${midX - 14} ${midY - 10}, ${midX} ${midY - 12}
        Z`
      : `M ${midX} ${midY - 10}
        C ${midX + 12} ${midY - 8}, ${midX + 12} ${midY + 8}, ${midX} ${midY + 10}
        C ${midX - 12} ${midY + 8}, ${midX - 12} ${midY - 8}, ${midX} ${midY - 10}
        Z`;

    return { M: mesial, D: distal, B: buccal, L: lingual, O: occlusal };
  })();

  return (
    <>
      <defs>
        <radialGradient id={enamelGradientId} cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="30%" stopColor="#fefefe" stopOpacity="0.8" />
          <stop offset="70%" stopColor="#f8f9fa" stopOpacity="1" />
          <stop offset="100%" stopColor="#e9ecef" stopOpacity="1" />
        </radialGradient>
        <linearGradient id={highlightId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <filter id={shadowId} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.15" />
        </filter>
        <filter id={textureId} x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" seed={toothNum} />
          <feColorMatrix type="matrix" values="0 0 0 0 0.95  0 0 0 0 0.95  0 0 0 0 0.95  0 0 0 0.08 0" />
          <feComposite in2="SourceGraphic" operator="atop" />
        </filter>
      </defs>

      {/* Main tooth shape with shadow */}
      <path d={crownPath} fill={`url(#${enamelGradientId})`} filter={`url(#${shadowId})`} />
      
      {/* Texture overlay */}
      <path d={crownPath} fill="#ffffff" filter={`url(#${textureId})`} opacity="0.3" />
      
      {/* Highlight */}
      <path d={crownPath} fill={`url(#${highlightId})`} />
      
      {/* Outline */}
      <path d={crownPath} fill="none" stroke={isAffected ? (STATUS_COLORS[status] || '#374151') : '#6b7280'} 
        strokeWidth={isAffected ? 1.5 : 1} opacity={isAffected ? 0.8 : 0.6} />

      {/* Fissures */}
      <path d={fissurePath} fill="none" stroke="#9ca3af" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />

      {/* Surface condition overlays */}
      <path d={regions.M} fill={surfaceColor('M') || 'transparent'} fillOpacity={surfaceColor('M') ? 0.6 : 0} onClick={handleSurfaceClick('M')} style={{ cursor: onSurfacePress ? 'pointer' : 'default' }} />
      <path d={regions.D} fill={surfaceColor('D') || 'transparent'} fillOpacity={surfaceColor('D') ? 0.6 : 0} onClick={handleSurfaceClick('D')} style={{ cursor: onSurfacePress ? 'pointer' : 'default' }} />
      <path d={regions.B} fill={surfaceColor('B') || 'transparent'} fillOpacity={surfaceColor('B') ? 0.6 : 0} onClick={handleSurfaceClick('B')} style={{ cursor: onSurfacePress ? 'pointer' : 'default' }} />
      <path d={regions.L} fill={surfaceColor('L') || 'transparent'} fillOpacity={surfaceColor('L') ? 0.6 : 0} onClick={handleSurfaceClick('L')} style={{ cursor: onSurfacePress ? 'pointer' : 'default' }} />
      <path d={regions.O} fill={surfaceColor('O') || 'transparent'} fillOpacity={surfaceColor('O') ? 0.6 : 0} onClick={handleSurfaceClick('O')} style={{ cursor: onSurfacePress ? 'pointer' : 'default' }} />
    </>
  );
};

const SimpleToothUnit = ({ toothNum, isUpper, status, surfaces, isSelected, onToothPress, onSurfacePress }) => {
  const isAffected = status !== 'present' || Object.keys(surfaces || {}).some(s => surfaces[s] !== 'none');

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={() => onToothPress(toothNum)}
        className={`relative transition-all hover:scale-105 ${isSelected ? 'ring-2 ring-[#2a276e] ring-offset-2' : ''}`}
      >
        <div className="w-12 h-16 relative">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            {getRealisticToothShape(toothNum, status, surfaces, onSurfacePress)}
          </svg>
        </div>
      </button>
      <span className="text-xs font-medium text-gray-700 mt-1">{toothNum}</span>
    </div>
  );
};

const SurfaceSelectionModal = ({ 
  visible, 
  toothNum, 
  currentSurfaces = {},
  currentStatus = 'present',
  initialSelectedSurface = null,
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

  useEffect(() => {
    if (!visible) return;
    setSelectedSurface(initialSelectedSurface);
  }, [visible, toothNum, initialSelectedSurface]);

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
                      ? 'border-[#2a276e] bg-[#9B8CFF]/10'
                      : currentSurfaces[key] && currentSurfaces[key] !== 'none'
                      ? 'border-blue-300 bg-[#9B8CFF]/10'
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
            className="w-full px-6 py-3 bg-[#2a276e] text-white rounded-lg font-semibold hover:bg-[#1a1548] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

const SimpleDentalChart = ({
  teethData = {},
  selectedTooth,
  onToothSelect,
  onSurfaceConditionChange,
  onToothStatusChange,
  editable = true,
}) => {
  const [showSurfaceModal, setShowSurfaceModal] = useState(false);
  const [modalTooth, setModalTooth] = useState(null);
  const [modalSurface, setModalSurface] = useState(null);

  const handleToothPress = (toothNum) => {
    onToothSelect(toothNum);
    if (editable) {
      setModalTooth(toothNum);
      setModalSurface(null);
      setShowSurfaceModal(true);
    }
  };

  const handleSurfacePress = (toothNum, surface) => {
    onToothSelect(toothNum);
    if (editable) {
      setModalTooth(toothNum);
      setModalSurface(surface);
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

      {/* Simple Chart Container */}
      <div className="bg-white rounded-lg border-2 border-gray-300 p-6">
        {/* Upper Arch Label */}
        <div className="flex justify-between mb-4 px-4">
          <span className="text-sm font-semibold text-gray-600">Upper Right</span>
          <span className="text-sm font-semibold text-gray-600">Upper Left</span>
        </div>

        {/* Upper Teeth Row */}
        <div className="flex justify-center gap-2 mb-4">
          {[...FDI_UPPER_RIGHT, ...FDI_UPPER_LEFT].map((toothNum) => {
            const data = getToothData(toothNum);
            return (
              <SimpleToothUnit
                key={toothNum}
                toothNum={toothNum}
                isUpper={true}
                status={data.status}
                surfaces={data.surfaces}
                isSelected={selectedTooth === toothNum}
                onToothPress={handleToothPress}
                onSurfacePress={handleSurfacePress}
              />
            );
          })}
        </div>

        {/* Midline Divider - Red Line */}
        <div className="flex items-center justify-center my-6">
          <div className="flex-1 border-t-2 border-red-500" />
          <span className="px-4 text-sm font-bold text-red-500">R | L</span>
          <div className="flex-1 border-t-2 border-red-500" />
        </div>

        {/* Lower Teeth Row */}
        <div className="flex justify-center gap-2 mb-4">
          {[...FDI_LOWER_RIGHT, ...FDI_LOWER_LEFT].map((toothNum) => {
            const data = getToothData(toothNum);
            return (
              <SimpleToothUnit
                key={toothNum}
                toothNum={toothNum}
                isUpper={false}
                status={data.status}
                surfaces={data.surfaces}
                isSelected={selectedTooth === toothNum}
                onToothPress={handleToothPress}
                onSurfacePress={handleSurfacePress}
              />
            );
          })}
        </div>

        {/* Lower Arch Label */}
        <div className="flex justify-between mt-4 px-4">
          <span className="text-sm font-semibold text-gray-600">Lower Right</span>
          <span className="text-sm font-semibold text-gray-600">Lower Left</span>
        </div>
      </div>

      {/* Surface Selection Modal */}
      <SurfaceSelectionModal
        visible={showSurfaceModal}
        toothNum={modalTooth}
        currentSurfaces={modalTooth ? getToothData(modalTooth).surfaces : {}}
        currentStatus={modalTooth ? getToothData(modalTooth).status : 'present'}
        initialSelectedSurface={modalSurface}
        onClose={() => setShowSurfaceModal(false)}
        onSurfaceConditionChange={onSurfaceConditionChange}
        onToothStatusChange={onToothStatusChange}
      />
    </div>
  );
};

export default SimpleDentalChart;
export { CONDITION_LABELS, TOOTH_NAMES };
