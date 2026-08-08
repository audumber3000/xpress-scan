/**
 * Mirror of frontend/src/utils/avatar.js so web and mobile render the same
 * deterministic DiceBear avatar for any given user seed.
 */

export const generateAvatarUrl = (seed?: string | null, size = 80): string => {
  const safeSeed = encodeURIComponent(seed || 'default');
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${safeSeed}&backgroundColor=b6e3f4,c0aede,d1d4f9&backgroundType=gradientLinear&radius=50&size=${size}`;
};

export interface PatientPersonaInput {
  name?: string | null;
  id?: string | null;
  age?: number | string | null;
  gender?: string | null;
}

/**
 * DiceBear "personas" avatar tailored to a patient's age/gender — mirror of
 * generatePatientPersona in frontend/src/utils/avatar.js so web and mobile
 * render the same face for the same patient.
 */
export const generatePatientPersona = (patient?: PatientPersonaInput | null, size = 80): string => {
  if (!patient) return '';
  const seed = encodeURIComponent(patient.name || patient.id || 'default');
  const age = parseInt(String(patient.age ?? ''), 10) || 30;
  const isFemale = !!patient.gender && patient.gender.toLowerCase() === 'female';

  let options = `seed=${seed}&backgroundColor=e8f0fe&radius=50&size=${size}`;

  if (isFemale) {
    options += '&hair=bobCut,curlyBun,straightBun,long,extraLong,pigtails,curly,bobBangs';
    options += '&facialHairProbability=0';
  } else {
    options += '&hair=bald,balding,buzzcut,shortCombover,shortComboverChops,fade,mohawk,sideShave,bunUndercut';
    options += age > 15 ? '&facialHairProbability=40' : '&facialHairProbability=0';
  }

  if (age < 15) {
    options += '&clothingColor=ff5722,e91e63,9c27b0,2196f3,4caf50';
  } else if (age > 55) {
    if (!isFemale) options += '&hair=balding,bald,shortCombover';
    options += '&hairColor=e8e1e1,c8c8c8,a5a5a5,d6b370';
  } else {
    options += '&hairColor=000000,2c1b18,4a3123,b55239,e8b159,724133';
  }

  return `https://api.dicebear.com/9.x/personas/svg?${options}`;
};

/** Anything that might carry a person's picture, in any of the shapes the
 *  app's various sources use. */
export interface UserPhotoSource {
  avatar_url?: string | null;
  photoURL?: string | null;
  avatar?: string | null;
  profile_photo_url?: string | null;
}

/**
 * The photo to show for a person, or null to fall back to the generated avatar.
 *
 * Mirror of resolveUserAvatar in frontend/src/utils/avatar.js. Sources are
 * checked in order, so pass the backend user before the Firebase one: a picture
 * uploaded on the profile page is a deliberate choice and should beat the
 * Google/Apple photo that merely arrived with sign-in.
 *
 *   photoURL={resolveUserPhoto(backendUser, user)}
 */
export const resolveUserPhoto = (
  ...sources: (UserPhotoSource | null | undefined)[]
): string | null => {
  for (const s of sources) {
    const photo = s?.avatar_url || s?.photoURL || s?.avatar || s?.profile_photo_url;
    if (photo) return photo;
  }
  return null;
};
