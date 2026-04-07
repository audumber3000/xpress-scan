export const LAB_STATUSES = ['Draft', 'Sent', 'Received', 'Completed', 'Cancelled'];

export const getInitials = (name: string): string => {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  return parts.length > 1
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : name.substring(0, 2).toUpperCase();
};

export const getLabStatusColors = (status: string): { bg: string; text: string; dot: string } => {
  switch (status.toLowerCase()) {
    case 'completed': return { bg: '#E6F9F1', text: '#10B981', dot: '#10B981' };
    case 'sent':      return { bg: '#DBEAFE', text: '#0369A1', dot: '#3B82F6' };
    case 'received':  return { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' };
    case 'cancelled': return { bg: '#FEE2E2', text: '#B91C1C', dot: '#EF4444' };
    default:          return { bg: '#F3F4F6', text: '#6B7280', dot: '#9CA3AF' };
  }
};
