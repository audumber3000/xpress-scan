import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

interface WhatsAppIconProps {
  size?: number;
}

/**
 * Official WhatsApp logo — green circle with white phone+chat mark.
 * Drop-in replacement for any MessageCircle used in WhatsApp contexts.
 */
export const WhatsAppIcon: React.FC<WhatsAppIconProps> = ({ size = 24 }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* Green background circle */}
      <Circle cx="24" cy="24" r="24" fill="#25D366" />
      {/* White WhatsApp phone/speech-bubble path */}
      <Path
        fill="#FFFFFF"
        d="M24 10C16.27 10 10 16.27 10 24c0 2.43.65 4.71 1.78 6.69L10 38l7.53-1.75A13.9 13.9 0 0 0 24 38c7.73 0 14-6.27 14-14S31.73 10 24 10zm6.9 19.47c-.29.82-1.7 1.57-2.33 1.67-.63.1-1.41.14-2.27-.14-.52-.17-1.19-.39-2.05-.77-3.6-1.55-5.95-5.17-6.13-5.41-.18-.24-1.46-1.94-1.46-3.7s.93-2.63 1.26-2.99c.33-.36.72-.45.96-.45.24 0 .48.01.69.01.22.01.52-.08.81.62.3.72 1.02 2.48 1.11 2.66.09.18.15.39.03.63-.12.24-.18.39-.36.6-.18.21-.38.47-.54.63-.18.18-.37.37-.16.73.21.36.93 1.53 2 2.48 1.37 1.22 2.53 1.6 2.89 1.78.36.18.57.15.78-.09.21-.24.9-1.05 1.14-1.41.24-.36.48-.3.81-.18.33.12 2.1.99 2.46 1.17.36.18.6.27.69.42.09.15.09.87-.2 1.69z"
      />
    </Svg>
  );
};
