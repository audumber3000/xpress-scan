module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Medical Clinic Theme Colors
        'primary': {
          base: '#0E0B2D',        // Deep Indigo Blue - Sidebar/Background
          hover: '#1A1640',       // Slightly lighter for hover
          active: '#6C4CF3',      // Modern Medical Purple for active states
          border: 'rgba(155, 140, 255, 0.2)', // Subtle border
        },
        'accent': {
          primary: '#6C4CF3',     // Modern Medical Purple - Primary buttons
          icon: '#9B8CFF',        // Icon color
        },
        'neutral': {
          white: '#FFFFFF',       // Clean White
        },
        // Legacy support - map old green to new purple
        'medical': {
          '50': '#f5f3ff',
          '100': '#ede9fe',
          '200': '#ddd6fe',
          '300': '#c4b5fd',
          '400': '#a78bfa',
          '500': '#8b5cf6',
          '600': '#6C4CF3',       // Primary accent
          '700': '#5b21b6',
          '800': '#4c1d95',
          '900': '#0E0B2D',       // Primary base
        }
      },
    },
  },
  plugins: [],
}; 