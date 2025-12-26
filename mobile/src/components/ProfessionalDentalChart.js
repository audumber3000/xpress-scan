import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, Dimensions } from 'react-native';
import Svg, { Path, G, Rect, Line, Circle, Polygon, Ellipse } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Bigger tooth size for better visibility - doctor can scroll horizontally
const TOOTH_WIDTH = 48; // Fixed larger size
const GRID_SIZE = 36; // Larger surface grid
const TOOTH_SIZE = 38; // Larger tooth image

// Surface condition colors
const SURFACE_COLORS = {
  none: '#ffffff',
  cavity: '#ef4444',           // Red - cavity/decay
  filling_amalgam: '#71717a',  // Gray - silver amalgam
  filling_composite: '#fef9c3', // Light yellow - composite/tooth colored
  filling_gold: '#fbbf24',     // Gold
  crown: '#f97316',            // Orange
  sealant: '#ec4899',          // Pink/Magenta
  decay: '#991b1b',            // Dark red/brown
  fracture: '#7c3aed',         // Purple
};

// Tooth status colors
const STATUS_COLORS = {
  present: '#e8f5e9',      // Light green tint
  missing: '#ffebee',      // Light red tint  
  implant: '#e3f2fd',      // Light blue tint
  rootCanal: '#fff3e0',    // Light orange tint
  extraction: '#fce4ec',   // Light pink tint
  pontic: '#f3e5f5',       // Light purple (bridge)
};

const CONDITION_LABELS = {
  none: 'Healthy',
  cavity: 'Cavity',
  filling_amalgam: 'Amalgam',
  filling_composite: 'Composite',
  filling_gold: 'Gold',
  crown: 'Crown',
  sealant: 'Sealant',
  decay: 'Decay',
  fracture: 'Fracture',
};

const STATUS_LABELS = {
  present: 'Present',
  missing: 'Missing',
  implant: 'Implant',
  rootCanal: 'Root Canal',
  extraction: 'Extract',
  pontic: 'Pontic',
};

// Tooth arrangement - FDI notation style display
const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11]; // Displayed right to left
const UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41]; // Displayed right to left

// Universal numbering for US dentists
const UNIVERSAL_UPPER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
const UNIVERSAL_LOWER = [32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17];

const TOOTH_NAMES = {
  // Universal numbering
  1: '3rd Molar', 2: '2nd Molar', 3: '1st Molar', 4: '2nd Premolar',
  5: '1st Premolar', 6: 'Canine', 7: 'Lateral Incisor', 8: 'Central Incisor',
  9: 'Central Incisor', 10: 'Lateral Incisor', 11: 'Canine', 12: '1st Premolar',
  13: '2nd Premolar', 14: '1st Molar', 15: '2nd Molar', 16: '3rd Molar',
  17: '3rd Molar', 18: '2nd Molar', 19: '1st Molar', 20: '2nd Premolar',
  21: '1st Premolar', 22: 'Canine', 23: 'Lateral Incisor', 24: 'Central Incisor',
  25: 'Central Incisor', 26: 'Lateral Incisor', 27: 'Canine', 28: '1st Premolar',
  29: '2nd Premolar', 30: '1st Molar', 31: '2nd Molar', 32: '3rd Molar',
};

const TOOTH_TYPES = {
  1: 'molar', 2: 'molar', 3: 'molar', 14: 'molar', 15: 'molar', 16: 'molar',
  17: 'molar', 18: 'molar', 19: 'molar', 30: 'molar', 31: 'molar', 32: 'molar',
  4: 'premolar', 5: 'premolar', 12: 'premolar', 13: 'premolar',
  20: 'premolar', 21: 'premolar', 28: 'premolar', 29: 'premolar',
  6: 'canine', 11: 'canine', 22: 'canine', 27: 'canine',
  7: 'incisor', 8: 'incisor', 9: 'incisor', 10: 'incisor',
  23: 'incisor', 24: 'incisor', 25: 'incisor', 26: 'incisor',
};

// 5-Surface Grid Component (like in professional dental software)
const SurfaceGrid = ({ toothNum, surfaces = {}, onSurfacePress, isSelected, size = 28 }) => {
  const gridSize = size;
  const cellSize = gridSize / 3;
  
  // Surface positions in the grid:
  // [  ][B ][  ]
  // [M ][O ][D ]
  // [  ][L ][  ]
  const surfacePositions = {
    B: { x: cellSize, y: 0 },           // Buccal (top)
    M: { x: 0, y: cellSize },           // Mesial (left)
    O: { x: cellSize, y: cellSize },    // Occlusal (center)
    D: { x: cellSize * 2, y: cellSize }, // Distal (right)
    L: { x: cellSize, y: cellSize * 2 }, // Lingual (bottom)
  };

  return (
    <TouchableOpacity 
      onPress={() => onSurfacePress(toothNum, null)}
      style={[styles.surfaceGridContainer, isSelected && styles.surfaceGridSelected]}
    >
      <Svg width={gridSize} height={gridSize} viewBox={`0 0 ${gridSize} ${gridSize}`}>
        {/* Background */}
        <Rect x={0} y={0} width={gridSize} height={gridSize} fill="#f5f5f5" stroke="#d4d4d4" strokeWidth={0.5} />
        
        {/* Draw each surface */}
        {Object.entries(surfacePositions).map(([surface, pos]) => {
          const condition = surfaces[surface] || 'none';
          const fillColor = SURFACE_COLORS[condition] || SURFACE_COLORS.none;
          
          return (
            <G key={surface}>
              <Rect
                x={pos.x}
                y={pos.y}
                width={cellSize}
                height={cellSize}
                fill={fillColor}
                stroke="#a3a3a3"
                strokeWidth={0.5}
              />
            </G>
          );
        })}
        
        {/* Center cross lines for visual clarity */}
        <Line x1={cellSize} y1={0} x2={cellSize} y2={gridSize} stroke="#a3a3a3" strokeWidth={0.5} />
        <Line x1={cellSize * 2} y1={0} x2={cellSize * 2} y2={gridSize} stroke="#a3a3a3" strokeWidth={0.5} />
        <Line x1={0} y1={cellSize} x2={gridSize} y2={cellSize} stroke="#a3a3a3" strokeWidth={0.5} />
        <Line x1={0} y1={cellSize * 2} x2={gridSize} y2={cellSize * 2} stroke="#a3a3a3" strokeWidth={0.5} />
      </Svg>
    </TouchableOpacity>
  );
};

// Realistic Tooth SVG Component with detailed anatomy
// Upper teeth: roots UP (crown at bottom) - like looking at patient from front
// Lower teeth: roots DOWN (crown at top)
const ToothSVG = ({ toothNum, isUpper, status = 'present', size = 38 }) => {
  const type = TOOTH_TYPES[toothNum] || 'incisor';
  const isMissing = status === 'missing';
  const isImplant = status === 'implant';
  const isExtraction = status === 'extraction';
  const isRootCanal = status === 'rootCanal';
  
  // Realistic tooth colors - more natural looking
  const enamelColor = isMissing ? '#d4d4d4' : '#f5f5f0'; // Natural white enamel
  const enamelHighlight = '#ffffff'; // Highlight for 3D effect
  const dentinColor = isMissing ? '#c4c4c4' : '#f0e6d2'; // Yellow-ish dentin
  const rootColor = isMissing ? '#b4b4b4' : '#ddd0bc'; // Beige root
  const gumLineColor = '#e8b4b4'; // Pink gum line hint
  const outlineColor = isMissing ? '#999999' : '#8b7355';
  const pulpColor = isRootCanal ? '#71717a' : '#d4a5a5'; // Gray if treated, pink if vital
  
  const height = size * 2.4; // Taller for realistic proportions
  const width = size;
  
  // Upper teeth: NO flip (roots drawn at top, crown at bottom)
  // Lower teeth: FLIP vertically (so roots point down)
  const transform = isUpper ? '' : `scale(1, -1) translate(0, -${height})`;
  
  // Crown position (at bottom for upper teeth drawing)
  const crownTop = height * 0.55;
  const crownBottom = height * 0.95;
  
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <G transform={transform}>
        {isImplant ? (
          // Implant: screw at top, crown at bottom
          <G>
            {/* Implant screw (at top, going into bone) */}
            <Path 
              d={`M${width * 0.35} ${height * 0.02} L${width * 0.3} ${height * 0.45} L${width * 0.5} ${height * 0.5} L${width * 0.7} ${height * 0.45} L${width * 0.65} ${height * 0.02} Z`}
              fill="#a1a1aa"
              stroke="#71717a"
              strokeWidth={1}
            />
            {/* Screw threads */}
            {[0.08, 0.16, 0.24, 0.32, 0.40].map((y, i) => (
              <Line key={i} x1={width * 0.28} y1={height * y} x2={width * 0.72} y2={height * y} stroke="#52525b" strokeWidth={1.5} />
            ))}
            {/* Abutment connector */}
            <Rect x={width * 0.38} y={height * 0.48} width={width * 0.24} height={height * 0.1} fill="#d4d4d8" stroke="#a1a1aa" strokeWidth={1} />
            {/* Crown (at bottom) */}
            <Path 
              d={`M${width * 0.1} ${height * 0.58} 
                 Q${width * 0.08} ${height * 0.7} ${width * 0.15} ${height * 0.85}
                 L${width * 0.3} ${height * 0.95} L${width * 0.5} ${height * 0.98} L${width * 0.7} ${height * 0.95}
                 L${width * 0.85} ${height * 0.85}
                 Q${width * 0.92} ${height * 0.7} ${width * 0.9} ${height * 0.58} Z`}
              fill={enamelColor}
              stroke={outlineColor}
              strokeWidth={1.2}
            />
          </G>
        ) : isMissing ? (
          // Missing tooth indication
          <G>
            {/* Dashed outline where tooth would be */}
            <Path
              d={`M${width * 0.3} ${height * 0.1} L${width * 0.5} ${height * 0.02} L${width * 0.7} ${height * 0.1}
                 Q${width * 0.75} ${height * 0.3} ${width * 0.7} ${height * 0.5}
                 L${width * 0.65} ${height * 0.9} L${width * 0.35} ${height * 0.9} L${width * 0.3} ${height * 0.5}
                 Q${width * 0.25} ${height * 0.3} ${width * 0.3} ${height * 0.1} Z`}
              fill="#fef2f2"
              stroke="#fca5a5"
              strokeWidth={1.5}
              strokeDasharray="4,3"
            />
            {/* Red X */}
            <Line x1={width * 0.2} y1={height * 0.15} x2={width * 0.8} y2={height * 0.85} stroke="#ef4444" strokeWidth={3} strokeLinecap="round" />
            <Line x1={width * 0.8} y1={height * 0.15} x2={width * 0.2} y2={height * 0.85} stroke="#ef4444" strokeWidth={3} strokeLinecap="round" />
          </G>
        ) : (
          // Normal tooth: ROOTS AT TOP, CROWN AT BOTTOM
          <G>
            {type === 'molar' && (
              <G>
                {/* ROOTS AT TOP */}
                {isUpper ? (
                  // Upper molar: 3 roots pointing UP
                  <G>
                    {/* Left root */}
                    <Path 
                      d={`M${width * 0.12} ${height * 0.45} 
                         Q${width * 0.08} ${height * 0.25} ${width * 0.15} ${height * 0.08}
                         L${width * 0.22} ${height * 0.08}
                         Q${width * 0.28} ${height * 0.25} ${width * 0.25} ${height * 0.45}`}
                      fill={rootColor}
                      stroke={outlineColor}
                      strokeWidth={1}
                    />
                    {/* Center/palatal root */}
                    <Path 
                      d={`M${width * 0.38} ${height * 0.45} 
                         Q${width * 0.42} ${height * 0.2} ${width * 0.5} ${height * 0.02}
                         Q${width * 0.58} ${height * 0.2} ${width * 0.62} ${height * 0.45}`}
                      fill={rootColor}
                      stroke={outlineColor}
                      strokeWidth={1}
                    />
                    {/* Right root */}
                    <Path 
                      d={`M${width * 0.75} ${height * 0.45} 
                         Q${width * 0.72} ${height * 0.25} ${width * 0.78} ${height * 0.08}
                         L${width * 0.85} ${height * 0.08}
                         Q${width * 0.92} ${height * 0.25} ${width * 0.88} ${height * 0.45}`}
                      fill={rootColor}
                      stroke={outlineColor}
                      strokeWidth={1}
                    />
                    {/* Root canals */}
                    {isRootCanal && (
                      <G>
                        <Line x1={width * 0.18} y1={height * 0.12} x2={width * 0.2} y2={height * 0.42} stroke={pulpColor} strokeWidth={2} />
                        <Line x1={width * 0.5} y1={height * 0.05} x2={width * 0.5} y2={height * 0.42} stroke={pulpColor} strokeWidth={2} />
                        <Line x1={width * 0.82} y1={height * 0.12} x2={width * 0.8} y2={height * 0.42} stroke={pulpColor} strokeWidth={2} />
                      </G>
                    )}
                  </G>
                ) : (
                  // Lower molar: 2 roots
                  <G>
                    <Path 
                      d={`M${width * 0.18} ${height * 0.45} 
                         Q${width * 0.12} ${height * 0.2} ${width * 0.22} ${height * 0.05}
                         L${width * 0.32} ${height * 0.05}
                         Q${width * 0.38} ${height * 0.2} ${width * 0.35} ${height * 0.45}`}
                      fill={rootColor}
                      stroke={outlineColor}
                      strokeWidth={1}
                    />
                    <Path 
                      d={`M${width * 0.65} ${height * 0.45} 
                         Q${width * 0.62} ${height * 0.2} ${width * 0.68} ${height * 0.05}
                         L${width * 0.78} ${height * 0.05}
                         Q${width * 0.88} ${height * 0.2} ${width * 0.82} ${height * 0.45}`}
                      fill={rootColor}
                      stroke={outlineColor}
                      strokeWidth={1}
                    />
                    {isRootCanal && (
                      <G>
                        <Line x1={width * 0.27} y1={height * 0.1} x2={width * 0.27} y2={height * 0.42} stroke={pulpColor} strokeWidth={2} />
                        <Line x1={width * 0.73} y1={height * 0.1} x2={width * 0.73} y2={height * 0.42} stroke={pulpColor} strokeWidth={2} />
                      </G>
                    )}
                  </G>
                )}
                {/* CROWN AT BOTTOM - with cusps */}
                <Path 
                  d={`M${width * 0.05} ${height * 0.48} 
                     Q${width * 0.03} ${height * 0.6} ${width * 0.08} ${height * 0.78}
                     L${width * 0.18} ${height * 0.88}
                     Q${width * 0.25} ${height * 0.92} ${width * 0.32} ${height * 0.96}
                     Q${width * 0.4} ${height * 0.93} ${width * 0.5} ${height * 0.98}
                     Q${width * 0.6} ${height * 0.93} ${width * 0.68} ${height * 0.96}
                     Q${width * 0.75} ${height * 0.92} ${width * 0.82} ${height * 0.88}
                     L${width * 0.92} ${height * 0.78}
                     Q${width * 0.97} ${height * 0.6} ${width * 0.95} ${height * 0.48} Z`}
                  fill={enamelColor}
                  stroke={outlineColor}
                  strokeWidth={1.2}
                />
                {/* Enamel highlight for 3D effect */}
                <Path 
                  d={`M${width * 0.15} ${height * 0.55} Q${width * 0.5} ${height * 0.52} ${width * 0.85} ${height * 0.55}`}
                  fill="none"
                  stroke={enamelHighlight}
                  strokeWidth={2}
                  opacity={0.6}
                />
                {/* Occlusal fissure pattern */}
                <Ellipse cx={width / 2} cy={height * 0.75} rx={width * 0.28} ry={height * 0.12} fill={dentinColor} stroke={outlineColor} strokeWidth={0.5} opacity={0.5} />
                {/* Extraction X */}
                {isExtraction && (
                  <G>
                    <Line x1={width * 0.1} y1={height * 0.5} x2={width * 0.9} y2={height * 0.95} stroke="#dc2626" strokeWidth={2.5} />
                    <Line x1={width * 0.9} y1={height * 0.5} x2={width * 0.1} y2={height * 0.95} stroke="#dc2626" strokeWidth={2.5} />
                  </G>
                )}
              </G>
            )}
            
            {type === 'premolar' && (
              <G>
                {/* Roots at top */}
                <Path 
                  d={`M${width * 0.3} ${height * 0.45} 
                     Q${width * 0.25} ${height * 0.2} ${width * 0.35} ${height * 0.03}
                     L${width * 0.45} ${height * 0.03}
                     Q${width * 0.5} ${height * 0.2} ${width * 0.48} ${height * 0.45}`}
                  fill={rootColor}
                  stroke={outlineColor}
                  strokeWidth={1}
                />
                <Path 
                  d={`M${width * 0.52} ${height * 0.45} 
                     Q${width * 0.5} ${height * 0.2} ${width * 0.55} ${height * 0.03}
                     L${width * 0.65} ${height * 0.03}
                     Q${width * 0.75} ${height * 0.2} ${width * 0.7} ${height * 0.45}`}
                  fill={rootColor}
                  stroke={outlineColor}
                  strokeWidth={1}
                />
                {isRootCanal && (
                  <G>
                    <Line x1={width * 0.4} y1={height * 0.08} x2={width * 0.4} y2={height * 0.42} stroke={pulpColor} strokeWidth={1.5} />
                    <Line x1={width * 0.6} y1={height * 0.08} x2={width * 0.6} y2={height * 0.42} stroke={pulpColor} strokeWidth={1.5} />
                  </G>
                )}
                {/* Crown at bottom with 2 cusps */}
                <Path 
                  d={`M${width * 0.12} ${height * 0.48} 
                     Q${width * 0.08} ${height * 0.65} ${width * 0.15} ${height * 0.82}
                     L${width * 0.3} ${height * 0.92}
                     Q${width * 0.4} ${height * 0.96} ${width * 0.5} ${height * 0.98}
                     Q${width * 0.6} ${height * 0.96} ${width * 0.7} ${height * 0.92}
                     L${width * 0.85} ${height * 0.82}
                     Q${width * 0.92} ${height * 0.65} ${width * 0.88} ${height * 0.48} Z`}
                  fill={enamelColor}
                  stroke={outlineColor}
                  strokeWidth={1.2}
                />
                <Path 
                  d={`M${width * 0.2} ${height * 0.55} Q${width * 0.5} ${height * 0.52} ${width * 0.8} ${height * 0.55}`}
                  fill="none"
                  stroke={enamelHighlight}
                  strokeWidth={1.5}
                  opacity={0.5}
                />
                <Ellipse cx={width / 2} cy={height * 0.72} rx={width * 0.2} ry={height * 0.08} fill={dentinColor} stroke={outlineColor} strokeWidth={0.5} opacity={0.5} />
                {isExtraction && (
                  <G>
                    <Line x1={width * 0.15} y1={height * 0.5} x2={width * 0.85} y2={height * 0.95} stroke="#dc2626" strokeWidth={2.5} />
                    <Line x1={width * 0.85} y1={height * 0.5} x2={width * 0.15} y2={height * 0.95} stroke="#dc2626" strokeWidth={2.5} />
                  </G>
                )}
              </G>
            )}
            
            {type === 'canine' && (
              <G>
                {/* Long single root at top */}
                <Path 
                  d={`M${width * 0.35} ${height * 0.45} 
                     Q${width * 0.32} ${height * 0.2} ${width * 0.5} ${height * 0.01}
                     Q${width * 0.68} ${height * 0.2} ${width * 0.65} ${height * 0.45}`}
                  fill={rootColor}
                  stroke={outlineColor}
                  strokeWidth={1}
                />
                {isRootCanal && (
                  <Line x1={width * 0.5} y1={height * 0.05} x2={width * 0.5} y2={height * 0.42} stroke={pulpColor} strokeWidth={2} />
                )}
                {/* Pointed crown at bottom */}
                <Path 
                  d={`M${width * 0.18} ${height * 0.48} 
                     Q${width * 0.12} ${height * 0.65} ${width * 0.2} ${height * 0.82}
                     L${width * 0.35} ${height * 0.92}
                     L${width * 0.5} ${height * 0.99}
                     L${width * 0.65} ${height * 0.92}
                     L${width * 0.8} ${height * 0.82}
                     Q${width * 0.88} ${height * 0.65} ${width * 0.82} ${height * 0.48} Z`}
                  fill={enamelColor}
                  stroke={outlineColor}
                  strokeWidth={1.2}
                />
                <Path 
                  d={`M${width * 0.25} ${height * 0.55} Q${width * 0.5} ${height * 0.52} ${width * 0.75} ${height * 0.55}`}
                  fill="none"
                  stroke={enamelHighlight}
                  strokeWidth={1.5}
                  opacity={0.5}
                />
                {/* Cusp tip */}
                <Circle cx={width * 0.5} cy={height * 0.92} r={width * 0.06} fill={dentinColor} opacity={0.4} />
                {isExtraction && (
                  <G>
                    <Line x1={width * 0.2} y1={height * 0.5} x2={width * 0.8} y2={height * 0.95} stroke="#dc2626" strokeWidth={2.5} />
                    <Line x1={width * 0.8} y1={height * 0.5} x2={width * 0.2} y2={height * 0.95} stroke="#dc2626" strokeWidth={2.5} />
                  </G>
                )}
              </G>
            )}
            
            {type === 'incisor' && (
              <G>
                {/* Single root at top */}
                <Path 
                  d={`M${width * 0.35} ${height * 0.45} 
                     Q${width * 0.35} ${height * 0.2} ${width * 0.5} ${height * 0.02}
                     Q${width * 0.65} ${height * 0.2} ${width * 0.65} ${height * 0.45}`}
                  fill={rootColor}
                  stroke={outlineColor}
                  strokeWidth={1}
                />
                {isRootCanal && (
                  <Line x1={width * 0.5} y1={height * 0.06} x2={width * 0.5} y2={height * 0.42} stroke={pulpColor} strokeWidth={2} />
                )}
                {/* Flat shovel-shaped crown at bottom */}
                <Path 
                  d={`M${width * 0.2} ${height * 0.48} 
                     Q${width * 0.15} ${height * 0.65} ${width * 0.18} ${height * 0.82}
                     L${width * 0.25} ${height * 0.92}
                     L${width * 0.75} ${height * 0.92}
                     L${width * 0.82} ${height * 0.82}
                     Q${width * 0.85} ${height * 0.65} ${width * 0.8} ${height * 0.48} Z`}
                  fill={enamelColor}
                  stroke={outlineColor}
                  strokeWidth={1.2}
                />
                <Path 
                  d={`M${width * 0.25} ${height * 0.55} Q${width * 0.5} ${height * 0.52} ${width * 0.75} ${height * 0.55}`}
                  fill="none"
                  stroke={enamelHighlight}
                  strokeWidth={1.5}
                  opacity={0.5}
                />
                {/* Incisal edge at bottom */}
                <Line x1={width * 0.28} y1={height * 0.91} x2={width * 0.72} y2={height * 0.91} stroke={outlineColor} strokeWidth={1} />
                {isExtraction && (
                  <G>
                    <Line x1={width * 0.2} y1={height * 0.5} x2={width * 0.8} y2={height * 0.92} stroke="#dc2626" strokeWidth={2.5} />
                    <Line x1={width * 0.8} y1={height * 0.5} x2={width * 0.2} y2={height * 0.92} stroke="#dc2626" strokeWidth={2.5} />
                  </G>
                )}
              </G>
            )}
          </G>
        )}
      </G>
    </Svg>
  );
};

// Single Tooth Unit Component (tooth image + surface grid + number)
const ToothUnit = ({ 
  toothNum, 
  isUpper, 
  status = 'present',
  surfaces = {},
  isSelected,
  onToothPress,
  onSurfacePress 
}) => {
  const toothSize = TOOTH_SIZE;
  const gridSize = GRID_SIZE;
  
  return (
    <View style={[styles.toothUnit, isSelected && styles.toothUnitSelected]}>
      {/* Tooth image (upper teeth: roots up, lower teeth: roots down) */}
      {isUpper && (
        <TouchableOpacity onPress={() => onToothPress(toothNum)}>
          <ToothSVG toothNum={toothNum} isUpper={true} status={status} size={toothSize} />
        </TouchableOpacity>
      )}
      
      {/* Surface grid */}
      <SurfaceGrid 
        toothNum={toothNum}
        surfaces={surfaces}
        onSurfacePress={onSurfacePress}
        isSelected={isSelected}
        size={gridSize}
      />
      
      {/* Tooth number */}
      <Text style={styles.toothNumber}>{toothNum}</Text>
      
      {/* Surface grid for lower (after number) */}
      {!isUpper && (
        <SurfaceGrid 
          toothNum={toothNum}
          surfaces={surfaces}
          onSurfacePress={onSurfacePress}
          isSelected={isSelected}
          size={gridSize}
        />
      )}
      
      {/* Tooth image for lower teeth */}
      {!isUpper && (
        <TouchableOpacity onPress={() => onToothPress(toothNum)}>
          <ToothSVG toothNum={toothNum} isUpper={false} status={status} size={toothSize} />
        </TouchableOpacity>
      )}
    </View>
  );
};

// Surface Selection Modal
const SurfaceSelectionModal = ({ 
  visible, 
  toothNum, 
  currentSurfaces = {},
  onClose, 
  onSurfaceConditionChange 
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

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Tooth #{toothNum} - {TOOTH_NAMES[toothNum]}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          </View>

          {/* Surface Selection */}
          <Text style={styles.sectionLabel}>Select Surface:</Text>
          <View style={styles.surfaceButtons}>
            {surfaces.map(({ key, label, desc }) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.surfaceButton,
                  selectedSurface === key && styles.surfaceButtonSelected,
                  currentSurfaces[key] && currentSurfaces[key] !== 'none' && styles.surfaceButtonHasCondition,
                ]}
                onPress={() => setSelectedSurface(key)}
              >
                <Text style={[
                  styles.surfaceButtonText,
                  selectedSurface === key && styles.surfaceButtonTextSelected,
                ]}>{label} ({key})</Text>
                {currentSurfaces[key] && currentSurfaces[key] !== 'none' && (
                  <View style={[styles.conditionDot, { backgroundColor: SURFACE_COLORS[currentSurfaces[key]] }]} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Condition Selection */}
          {selectedSurface && (
            <>
              <Text style={styles.sectionLabel}>Select Condition for {selectedSurface}:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.conditionButtons}>
                  <TouchableOpacity
                    style={[styles.conditionButton, { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d4d4d4' }]}
                    onPress={() => {
                      onSurfaceConditionChange(toothNum, selectedSurface, 'none');
                    }}
                  >
                    <Text style={styles.conditionButtonText}>Clear</Text>
                  </TouchableOpacity>
                  {conditions.map(([key, color]) => (
                    <TouchableOpacity
                      key={key}
                      style={[styles.conditionButton, { backgroundColor: color }]}
                      onPress={() => {
                        onSurfaceConditionChange(toothNum, selectedSurface, key);
                      }}
                    >
                      <Text style={[
                        styles.conditionButtonText,
                        ['filling_composite', 'filling_gold'].includes(key) && { color: '#000' }
                      ]}>{CONDITION_LABELS[key]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </>
          )}

          <TouchableOpacity style={styles.doneButton} onPress={onClose}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Main Professional Dental Chart Component
const ProfessionalDentalChart = ({
  teethData = {},  // { toothNum: { status: 'present', surfaces: { M: 'cavity', O: 'filling_amalgam', ... } } }
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

  const handleSurfacePress = (toothNum) => {
    handleToothPress(toothNum);
  };

  const getToothData = (toothNum) => {
    return teethData[toothNum] || { status: 'present', surfaces: {} };
  };

  return (
    <View style={styles.container}>
      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Surface Conditions:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.legendRow}>
            {Object.entries(SURFACE_COLORS).filter(([k]) => k !== 'none').map(([key, color]) => (
              <View key={key} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: color }]} />
                <Text style={styles.legendText}>{CONDITION_LABELS[key]}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Chart Container */}
      <ScrollView horizontal showsHorizontalScrollIndicator={true}>
        <View style={styles.chartContainer}>
          {/* Upper Arch Label */}
          <View style={styles.archLabelContainer}>
            <Text style={styles.archLabel}>Upper Right</Text>
            <Text style={styles.archLabel}>Upper Left</Text>
          </View>

          {/* Upper Teeth Row */}
          <View style={styles.teethRow}>
            {UNIVERSAL_UPPER.map((toothNum) => {
              const data = getToothData(toothNum);
              return (
                <ToothUnit
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
          </View>

          {/* Midline Divider */}
          <View style={styles.midline}>
            <View style={styles.midlineLeft} />
            <Text style={styles.midlineText}>R | L</Text>
            <View style={styles.midlineRight} />
          </View>

          {/* Lower Teeth Row */}
          <View style={styles.teethRow}>
            {UNIVERSAL_LOWER.map((toothNum) => {
              const data = getToothData(toothNum);
              return (
                <ToothUnit
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
          </View>

          {/* Lower Arch Label */}
          <View style={styles.archLabelContainer}>
            <Text style={styles.archLabel}>Lower Right</Text>
            <Text style={styles.archLabel}>Lower Left</Text>
          </View>
        </View>
      </ScrollView>

      {/* Tooth Status Quick Actions */}
      {selectedTooth && editable && (
        <View style={styles.statusActions}>
          <Text style={styles.statusTitle}>Tooth #{selectedTooth} Status:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.statusButtons}>
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.statusButton,
                    getToothData(selectedTooth).status === key && styles.statusButtonActive,
                    { backgroundColor: STATUS_COLORS[key] }
                  ]}
                  onPress={() => onToothStatusChange(selectedTooth, key)}
                >
                  <Text style={styles.statusButtonText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Surface Selection Modal */}
      <SurfaceSelectionModal
        visible={showSurfaceModal}
        toothNum={modalTooth}
        currentSurfaces={modalTooth ? getToothData(modalTooth).surfaces : {}}
        onClose={() => setShowSurfaceModal(false)}
        onSurfaceConditionChange={onSurfaceConditionChange}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
  },
  legend: {
    marginBottom: 12,
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#525252',
    marginBottom: 6,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 4,
    borderWidth: 0.5,
    borderColor: '#a3a3a3',
  },
  legendText: {
    fontSize: 10,
    color: '#525252',
  },
  chartContainer: {
    alignItems: 'center',
  },
  archLabelContainer: {
    flexDirection: 'row',
    width: TOOTH_WIDTH * 16,
    justifyContent: 'space-between',
    paddingHorizontal: TOOTH_WIDTH * 2,
    marginVertical: 6,
  },
  archLabel: {
    fontSize: 12,
    color: '#525252',
    fontWeight: '600',
  },
  teethRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  toothUnit: {
    alignItems: 'center',
    width: TOOTH_WIDTH,
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  toothUnitSelected: {
    backgroundColor: '#dbeafe',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  toothNumber: {
    fontSize: 11,
    color: '#374151',
    fontWeight: '700',
    marginVertical: 3,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  surfaceGridContainer: {
    borderRadius: 2,
  },
  surfaceGridSelected: {
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  midline: {
    flexDirection: 'row',
    alignItems: 'center',
    width: TOOTH_WIDTH * 16,
    marginVertical: 8,
    paddingVertical: 6,
  },
  midlineLeft: {
    flex: 1,
    height: 2,
    backgroundColor: '#d4d4d4',
  },
  midlineRight: {
    flex: 1,
    height: 2,
    backgroundColor: '#d4d4d4',
  },
  midlineText: {
    fontSize: 14,
    color: '#525252',
    marginHorizontal: 16,
    fontWeight: '700',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusActions: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
  },
  statusTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  statusButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  statusButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d4d4d4',
  },
  statusButtonActive: {
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  statusButtonText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: '#6b7280',
    lineHeight: 26,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
    marginBottom: 8,
  },
  surfaceButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  surfaceButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
  },
  surfaceButtonSelected: {
    backgroundColor: '#dbeafe',
    borderColor: '#3b82f6',
  },
  surfaceButtonHasCondition: {
    backgroundColor: '#fef3c7',
  },
  surfaceButtonText: {
    fontSize: 13,
    color: '#374151',
  },
  surfaceButtonTextSelected: {
    color: '#1d4ed8',
    fontWeight: '600',
  },
  conditionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 6,
  },
  conditionButtons: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  conditionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  conditionButtonText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '500',
  },
  doneButton: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  doneButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export { ProfessionalDentalChart, SURFACE_COLORS, CONDITION_LABELS, STATUS_LABELS, TOOTH_NAMES };
export default ProfessionalDentalChart;
