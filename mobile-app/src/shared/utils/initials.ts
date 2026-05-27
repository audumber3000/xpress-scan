const HONORIFIC = /^(dr|mr|mrs|ms|mx|prof|sir|madam)\.?$/i;

export const getInitials = (name?: string | null, fallback = '??'): string => {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/).filter(p => !HONORIFIC.test(p));
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};
