/**
 * RBAC gate shared by the sidebar and the keyboard-shortcut registry.
 *
 * Deny-by-default: clinic_owner always passes, every other role needs
 * read === true on the module key. Items without a permission key are open.
 *
 * Both callers must use this so the shortcuts panel can never advertise a
 * destination the sidebar hides.
 *
 * @param {object|null} user - The authenticated user from AuthContext.
 * @param {{permissionKey?: string, permissionKeys?: string[]}} item
 * @returns {boolean}
 */
export const canAccess = (user, item) => {
  if (!item.permissionKey && !item.permissionKeys) return true;
  if (!user) return false;
  if (user.role === 'clinic_owner') return true;

  if (Array.isArray(item.permissionKeys) && item.permissionKeys.length > 0) {
    return item.permissionKeys.some((key) => user.permissions?.[key]?.read === true);
  }

  return user.permissions?.[item.permissionKey]?.read === true;
};
