/**
 * UI constants — single source of truth for styling, labels, and config.
 */

// ── Status ──────────────────────────────────────────────────────────────

export const STATUS_CONFIG = {
  received:       { label: "Received",       color: "#3B82F6", bg: "#EFF6FF", border: "#BFDBFE" },
  in_production:  { label: "In Production",  color: "#F59E0B", bg: "#FFFBEB", border: "#FDE68A" },
  ready:          { label: "Ready",          color: "#10B981", bg: "#ECFDF5", border: "#A7F3D0" },
  dispatched:     { label: "Dispatched",     color: "#6366F1", bg: "#EEF2FF", border: "#C7D2FE" },
  delivered:      { label: "Delivered",      color: "#059669", bg: "#ECFDF5", border: "#6EE7B7" },
  on_hold:        { label: "On Hold",        color: "#EF4444", bg: "#FEF2F2", border: "#FECACA" },
  cancelled:      { label: "Cancelled",      color: "#9CA3AF", bg: "#F9FAFB", border: "#E5E7EB" },
};

export const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([value, cfg]) => ({
  value,
  label: cfg.label,
}));

// ── Priority ────────────────────────────────────────────────────────────

export const PRIORITY_CONFIG = {
  normal: { label: "Normal", color: "#6B7280", bg: "#F9FAFB" },
  rush:   { label: "Rush",   color: "#EF4444", bg: "#FEF2F2" },
};

// ── Product categories ──────────────────────────────────────────────────

export const PRODUCT_CATEGORIES = [
  { value: "crown",       label: "Crown" },
  { value: "bridge",      label: "Bridge" },
  { value: "denture",     label: "Denture" },
  { value: "implant",     label: "Implant" },
  { value: "aligner",     label: "Aligner" },
  { value: "veneer",      label: "Veneer" },
  { value: "inlay_onlay", label: "Inlay / Onlay" },
  { value: "night_guard", label: "Night Guard" },
  { value: "repair",      label: "Repair" },
  { value: "other",       label: "Other" },
];

// ── Payment methods ─────────────────────────────────────────────────────

export const PAYMENT_METHODS = [
  { value: "cash",          label: "Cash" },
  { value: "upi",           label: "UPI" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "card",          label: "Card" },
  { value: "cheque",        label: "Cheque" },
  { value: "other",         label: "Other" },
];

// ── Invoice statuses ────────────────────────────────────────────────────

export const INVOICE_STATUS_CONFIG = {
  draft:          { label: "Draft",          color: "#6B7280", bg: "#F9FAFB" },
  sent:           { label: "Sent",           color: "#3B82F6", bg: "#EFF6FF" },
  partially_paid: { label: "Partially Paid", color: "#F59E0B", bg: "#FFFBEB" },
  paid:           { label: "Paid",           color: "#059669", bg: "#ECFDF5" },
  cancelled:      { label: "Cancelled",      color: "#9CA3AF", bg: "#F9FAFB" },
};

// ── Navigation items ────────────────────────────────────────────────────

export const NAV_ITEMS = [
  { path: "/",         label: "Dashboard",  icon: "LayoutDashboard" },
  { path: "/cases",    label: "Cases",      icon: "Briefcase" },
  { path: "/clients",  label: "Clients",    icon: "Users" },
  { path: "/catalog",  label: "Catalog",    icon: "Package" },
  { path: "/billing",  label: "Billing",    icon: "Receipt" },
  { path: "/settings", label: "Settings",   icon: "Settings" },
];
