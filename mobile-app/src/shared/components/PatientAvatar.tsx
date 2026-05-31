import React from 'react';
import { UserAvatar } from './UserAvatar';
import { generatePatientPersona } from '../utils/avatar';

interface PatientAvatarProps {
  name?: string | null;
  age?: number | string | null;
  gender?: string | null;
  size: number;
  style?: any;
}

/**
 * Patient avatar — a DiceBear "personas" cartoon tailored to the patient's
 * age/gender, with the patient's initials showing underneath until it loads.
 * Matches the web app's generatePatientPersona avatars.
 */
export const PatientAvatar: React.FC<PatientAvatarProps> = ({ name, age, gender, size, style }) => (
  <UserAvatar
    size={size}
    name={name}
    fallbackInitials="?"
    svgUri={generatePatientPersona({ name, age, gender }, size)}
    style={style}
  />
);
