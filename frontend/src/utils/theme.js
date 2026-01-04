/**
 * Medical Clinic Theme Configuration
 * 
 * Centralized theme colors and utilities
 * Use these constants throughout the app for consistent theming
 */

export const theme = {
  colors: {
    // Primary (Base / Background)
    primaryBase: '#0E0B2D',           // Deep Indigo Blue - Sidebar, dark backgrounds
    primaryHover: '#1A1640',          // Slightly lighter for hover states
    primaryActive: '#6C4CF3',         // Modern Medical Purple for active states
    primaryBorder: 'rgba(155, 140, 255, 0.2)', // Subtle border color
    
    // Accent (Brand / Actions)
    accentPrimary: '#6C4CF3',         // Modern Medical Purple - Primary buttons, active states
    accentIcon: '#9B8CFF',            // Icon color
    
    // Neutral (Content / Text)
    neutralWhite: '#FFFFFF',          // Clean White - Text, icons, cards
  },
  
  // Tailwind class helpers
  classes: {
    sidebar: {
      bg: 'bg-[#0E0B2D]',              // Deep Indigo Blue background
      text: 'text-white',               // White text
      icon: 'text-[#9B8CFF]',          // Icon color
      active: 'bg-[#6C4CF3] text-white', // Active state
      hover: 'hover:bg-[#1A1640]',     // Hover state
      border: 'border-[rgba(155,140,255,0.2)]', // Border color
    },
    button: {
      primary: 'bg-[#6C4CF3] hover:bg-[#5b3dd9] text-white', // Primary button
    },
    card: {
      bg: 'bg-white',                  // White cards
      border: 'border-gray-200',       // Light borders
    }
  }
};

/**
 * Get theme color by name
 * @param {string} colorName - Name of the color (e.g., 'primaryBase', 'accentPrimary')
 * @returns {string} Hex color value
 */
export const getThemeColor = (colorName) => {
  const color = theme.colors[colorName];
  if (!color) {
    console.warn(`Theme color "${colorName}" not found. Using default.`);
    return theme.colors.primaryBase;
  }
  return color;
};

/**
 * Get CSS variable for theme color
 * @param {string} colorName - Name of the color
 * @returns {string} CSS variable reference
 */
export const getThemeVar = (colorName) => {
  const varMap = {
    primaryBase: 'var(--color-primary-base)',
    accentPrimary: 'var(--color-accent-primary)',
    accentIcon: 'var(--color-accent-icon)',
    neutralWhite: 'var(--color-neutral-white)',
  };
  return varMap[colorName] || varMap.primaryBase;
};

export default theme;








