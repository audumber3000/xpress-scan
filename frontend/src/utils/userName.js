/**
 * Resolve a human-friendly display name for a user object, trying the various
 * shapes the user record can take (OAuth metadata, name, first/last, email).
 * Returns '' if nothing usable is found.
 */
export function getUserDisplayName(user) {
  if (!user) return '';
  return (
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.name ||
    (user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : '') ||
    user.email?.split('@')[0] ||
    ''
  );
}
