/**
 * Generate a unique, deterministic DiceBear avatar URL for any user.
 * Uses the "avataaars" style which creates friendly cartoon human faces.
 * The seed ensures the same person always gets the same avatar.
 *
 * @param {string} seed - A unique identifier (email, name, or user ID)
 * @param {number} [size=80] - Avatar size in pixels
 * @returns {string} DiceBear SVG avatar URL
 */
export const generateAvatarUrl = (seed, size = 80) => {
  const safeSeed = encodeURIComponent(seed || 'default');
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${safeSeed}&backgroundColor=b6e3f4,c0aede,d1d4f9&backgroundType=gradientLinear&radius=50&size=${size}`;
};

/**
 * First letters of the first two words, e.g. "Audi Pharma" -> "AU".
 * @param {string} name
 * @returns {string} 1-2 uppercase letters, or "?" when there's nothing to use.
 */
export const getInitials = (name) =>
  (name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(word => word[0])
    .filter(Boolean)
    .join('')
    .toUpperCase() || '?';

/**
 * Generate a simple initials-based avatar URL (fallback when offline).
 * @param {string} name - User's full name
 * @returns {string} UI Avatars URL
 */
export const generateInitialsAvatar = (name) => {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(getInitials(name))}&background=2a276e&color=fff&size=80&rounded=true&bold=true`;
};

/**
 * Generate a DiceBear Personas avatar specifically tailored for a patient's demographics.
 * Maps age and gender to appropriate avatar traits.
 *
 * @param {object} patient - The patient data object { name, age, gender }
 * @param {number} [size=80] - Avatar size in pixels
 * @returns {string} DiceBear SVG avatar URL
 */
export const generatePatientPersona = (patient, size = 80) => {
  if (!patient) return '';
  const seed = encodeURIComponent(patient.name || patient.id || 'default');
  const age = parseInt(patient.age, 10) || 30;
  const isFemale = patient.gender && patient.gender.toLowerCase() === 'female';

  // Constant professional medical background
  const bg = "backgroundColor=e8f0fe"; 
  
  let options = `seed=${seed}&${bg}&radius=50&size=${size}`;

  // Gender specific
  if (isFemale) {
    options += "&hair=bobCut,curlyBun,straightBun,long,extraLong,pigtails,curly,bobBangs";
    options += "&facialHairProbability=0";
  } else {
    options += "&hair=bald,balding,buzzcut,shortCombover,shortComboverChops,fade,mohawk,sideShave,bunUndercut";
    if (age > 15) {
      options += "&facialHairProbability=40";
    } else {
      options += "&facialHairProbability=0";
    }
  }

  // Age specific
  if (age < 15) {
    // Bright clothing for kids
    options += "&clothingColor=ff5722,e91e63,9c27b0,2196f3,4caf50";
  } else if (age > 55) {
    // Older patients
    if (!isFemale) {
       // Higher chance of balding
       options += "&hair=balding,bald,shortCombover";
    }
    // Grey/White hair colors
    options += "&hairColor=e8e1e1,c8c8c8,a5a5a5,d6b370"; 
  } else {
    // Adults - standard hair colors
    options += "&hairColor=000000,2c1b18,4a3123,b55239,e8b159,724133";
  }

  return `https://api.dicebear.com/9.x/personas/svg?${options}`;
};

/**
 * The picture to show for a person, preferring the one they actually uploaded.
 *
 * A profile photo is stored on the user row as `avatar_url` (a data: URI, set
 * from the profile page). Google/Supabase sign-ins instead carry theirs under
 * `user_metadata`, and some list endpoints have historically used `avatar`. All
 * three are the same idea, so they are checked in turn before falling back to
 * the generated cartoon.
 *
 * Use this everywhere a staff member's face appears. Reading one field directly
 * is how the header ended up ignoring uploaded photos entirely: it only ever
 * looked at the Google shape, so a picture set from the profile page changed
 * nothing anywhere else in the app.
 *
 * @param {object} user  a user-shaped object from any endpoint
 * @param {number} size  px, used only for the generated fallback
 * @returns {string} an image URL or data: URI, never empty
 */
export const resolveUserAvatar = (user, size = 80) => {
  const uploaded =
    user?.avatar_url ||
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    user?.avatar ||
    user?.profile_photo_url;
  if (uploaded) return uploaded;
  const seed = user?.email || user?.name || user?.id || 'default';
  return generateAvatarUrl(seed, size);
};
