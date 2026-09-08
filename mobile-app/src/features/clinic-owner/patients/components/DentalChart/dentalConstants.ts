// Universal tooth numbering system
export const UNIVERSAL_UPPER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
export const UNIVERSAL_LOWER = [32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17];

// Tooth names by number
export const TOOTH_NAMES: Record<number, string> = {
    1: 'UR 3rd Molar', 2: 'UR 2nd Molar', 3: 'UR 1st Molar', 4: 'UR 2nd Premolar', 5: 'UR 1st Premolar',
    6: 'UR Canine', 7: 'UR Lateral Incisor', 8: 'UR Central Incisor',
    9: 'UL Central Incisor', 10: 'UL Lateral Incisor', 11: 'UL Canine', 12: 'UL 1st Premolar',
    13: 'UL 2nd Premolar', 14: 'UL 1st Molar', 15: 'UL 2nd Molar', 16: 'UL 3rd Molar',
    17: 'LL 3rd Molar', 18: 'LL 2nd Molar', 19: 'LL 1st Molar', 20: 'LL 2nd Premolar',
    21: 'LL 1st Premolar', 22: 'LL Canine', 23: 'LL Lateral Incisor', 24: 'LL Central Incisor',
    25: 'LR Central Incisor', 26: 'LR Lateral Incisor', 27: 'LR Canine', 28: 'LR 1st Premolar',
    29: 'LR 2nd Premolar', 30: 'LR 1st Molar', 31: 'LR 2nd Molar', 32: 'LR 3rd Molar',
};

// Professional clinical color scheme
export const SURFACE_COLORS: Record<string, string> = {
    none: 'transparent',
    caries: '#3f2b1d',           // Dark brown/black for decay
    filling_existing: '#3b82f6', // Blue for existing filling
    filling_amalgam: '#71717A',  // Gray for amalgam
    filling_temp: '#f97316',     // Orange for temporary
    filling_gold: '#D4AF37',     // Gold
    crown_gold: '#D4AF37',       // Gold crown
    crown_porcelain: '#f8fafc',  // White/Ivory crown
    fracture: '#991B1B',         // Dark red for crack
};

// Condition labels for display
export const CONDITION_LABELS: Record<string, string> = {
    caries: 'Caries',
    filling_existing: 'Existing Filling',
    filling_amalgam: 'Amalgam Filling',
    filling_temp: 'Temporary Filling',
    filling_gold: 'Gold Filling',
    crown_gold: 'Gold Crown',
    crown_porcelain: 'Porcelain Crown',
    fracture: 'Fracture',
};

// Professional clinical statuses
export const STATUS_COLORS: Record<string, string> = {
    present: '#10b981',
    missing: '#ef4444',
    implant: '#64748b',
    rootCanal: '#ef4444',
    impacted: '#94a3b8',
    planned: '#ef4444',

    // Written by the web case paper, which can now record what KIND of existing
    // work a tooth carries rather than calling all of it an implant. Mobile
    // cannot set these yet, but it reads the same snapshots — and the lookup
    // below falls back to red, so without these rows a tooth with an old crown
    // would show on a phone in the colour this palette uses for "extracted".
    existing: '#64748b',
    crown_porcelain: '#64748b',
    crown_gold: '#64748b',
    crown_ss: '#64748b',
    veneer: '#64748b',
    bridge: '#64748b',
    post_core: '#64748b',

    // Both are genuinely urgent, so red is right for them.
    to_extract: '#ef4444',
    fractured: '#ef4444',
};

// Status labels
export const STATUS_LABELS: Record<string, string> = {
    present: 'Present',
    missing: 'Missing/Extracted',
    implant: 'Dental Implant',
    rootCanal: 'Root Canal',
    impacted: 'Impacted',
    planned: 'Planned Treatment',
    fractured: 'Fractured',
};

// Surface definitions
export const SURFACES = [
    { key: 'M', label: 'Mesial', desc: 'Side toward midline' },
    { key: 'O', label: 'Occlusal', desc: 'Biting surface' },
    { key: 'D', label: 'Distal', desc: 'Side away from midline' },
    { key: 'B', label: 'Buccal', desc: 'Cheek side' },
    { key: 'L', label: 'Lingual', desc: 'Tongue side' },
];
