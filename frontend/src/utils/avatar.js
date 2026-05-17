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
 * Generate a simple initials-based avatar URL (fallback when offline).
 * @param {string} name - User's full name
 * @returns {string} UI Avatars URL
 */
export const generateInitialsAvatar = (name) => {
  const initials = (name || '?')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=2a276e&color=fff&size=80&rounded=true&bold=true`;
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
    options += "&hair=bob,bun,curly,curlyB,curlyHighTop,extraLong,long,pigtails,straightAndStrand";
    options += "&facialHairProbability=0";
  } else {
    options += "&hair=bald,balding,buzzcut,shortCombover,shortCurly,shortFrizzle,shortSlicked,shortVolumed";
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
       options += "&hair=balding,bald,shortSlicked";
    }
    // Grey/White hair colors
    options += "&hairColor=e8e1e1,c8c8c8,a5a5a5,d6b370"; 
  } else {
    // Adults - standard hair colors
    options += "&hairColor=000000,2c1b18,4a3123,b55239,e8b159,724133";
  }

  return `https://api.dicebear.com/9.x/personas/svg?${options}`;
};
