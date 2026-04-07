import { StyleSheet, Platform } from 'react-native';

export const SWIPE_W = 160;

export const styles = StyleSheet.create({
  tabScroll: { flex: 1 },
  loader: { marginTop: 60 },

  // Summary bar
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
  },
  summaryText: { fontSize: 13, color: '#6B7280', fontWeight: '600', marginRight: 4 },
  summaryPill: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  summaryPillText: { fontSize: 11, fontWeight: '700', color: '#6B7280' },

  // Alert banner (low stock)
  alertBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF3C7', marginHorizontal: 16, marginTop: 12,
    borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#FDE68A',
  },
  alertText: { fontSize: 13, color: '#92400E', fontWeight: '500', flex: 1 },

  // Flat white list block
  listBlock: {
    backgroundColor: '#FFFFFF',
    marginTop: 8,
    paddingTop: 4,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F3F4F6',
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
  },

  // Avatar
  avatarWrap: { position: 'relative', marginRight: 14 },
  avatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: '#F3F4FE',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarLow: { backgroundColor: '#FEE2E2' },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#2E2A85' },
  indicator: {
    position: 'absolute', bottom: -2, right: -2,
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: '#FFFFFF',
  },

  // Row info
  rowInfo: { flex: 1, marginRight: 10 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 3 },
  rowSubtitle: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },

  // Right side
  rowRight: { alignItems: 'flex-end', gap: 5 },
  rowValue: { fontSize: 15, fontWeight: '700', color: '#111827' },

  // Status badge
  badge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },

  // Separator
  separator: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 84 },

  // Hint text
  hintText: {
    textAlign: 'center', fontSize: 11, color: '#9CA3AF',
    fontWeight: '500', marginTop: 12, marginBottom: 4,
  },

  // Consent full text
  consentFullText: { fontSize: 15, color: '#374151', lineHeight: 24 },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 52 },
  emptyText: { fontSize: 16, color: '#6B7280', fontWeight: '600' },
  emptySubtext: { fontSize: 13, color: '#9CA3AF', marginTop: 4 },

  // FAB
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#2E2A85',
    justifyContent: 'center', alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#2E2A85', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10 },
      android: { elevation: 8 },
    }),
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 8, maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },

  // Form inputs
  inputLabel: {
    fontSize: 12, fontWeight: '600', color: '#6B7280',
    marginTop: 14, marginBottom: 5, marginHorizontal: 20,
  },
  input: {
    backgroundColor: '#F9FAFB', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#111827',
    marginHorizontal: 20, borderWidth: 1, borderColor: '#E5E7EB',
  },
  inputMulti: { height: 80, textAlignVertical: 'top' },
  inputRow: { flexDirection: 'row' },
  inputHalf: { flex: 1 },
  saveBtn: {
    margin: 20, marginTop: 24,
    backgroundColor: '#2E2A85',
    borderRadius: 14, paddingVertical: 15, alignItems: 'center',
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  // SwipeableRow
  swipeContainer: { position: 'relative', backgroundColor: '#FFFFFF', overflow: 'hidden' },
  swipeActions: {
    position: 'absolute', right: 0, top: 0, bottom: 0,
    width: SWIPE_W, flexDirection: 'row',
  },
  editAction: {
    flex: 1, backgroundColor: '#2E2A85',
    justifyContent: 'center', alignItems: 'center', gap: 4,
  },
  deleteAction: {
    flex: 1, backgroundColor: '#EF4444',
    justifyContent: 'center', alignItems: 'center', gap: 4,
  },
  swipeActionText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },

  // Action Sheet (bottom tray)
  actionSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 32,
  },
  actionSheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB',
    alignSelf: 'center', marginTop: 10, marginBottom: 4,
  },
  actionSheetHeader: {
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  actionSheetTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  actionSheetSubtitle: { fontSize: 13, color: '#9CA3AF', marginTop: 3, fontWeight: '500' },
  actionSheetSectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8,
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4,
  },
  statusOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F9FAFB',
  },
  statusOptionActive: { backgroundColor: '#F5F3FF' },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusOptionText: { flex: 1, fontSize: 15, color: '#374151', fontWeight: '500' },
  actionSheetCloseBtn: {
    marginHorizontal: 20, marginTop: 16,
    backgroundColor: '#F3F4F6', borderRadius: 12, paddingVertical: 13, alignItems: 'center',
  },
  actionSheetCloseTxt: { fontSize: 15, fontWeight: '600', color: '#6B7280' },

  // Inventory tray stats
  inventoryTrayStats: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
  inventoryTrayStat: {
    flex: 1, backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10, alignItems: 'center',
  },
  inventoryTrayStatLabel: { fontSize: 9, fontWeight: '800', color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 3 },
  inventoryTrayStatValue: { fontSize: 15, fontWeight: '700', color: '#111827' },
  restockRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 6 },
  restockInput: {
    flex: 1, backgroundColor: '#F9FAFB', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#111827',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  restockBtn: {
    backgroundColor: '#2E2A85', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  restockBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  // Consent tray
  consentTrayActions: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 12, gap: 10 },
  consentTrayToggle: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  consentTrayToggleText: { fontSize: 14, fontWeight: '700' },

  // --- Search & Selection Styles (Missing Fix) ---
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F9FAFB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    marginHorizontal: 20, borderWidth: 1, borderColor: '#E5E7EB',
    gap: 8,
  },
  searchField: { flex: 1, fontSize: 14, color: '#111827' },
  searchResult: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    marginHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  searchResultText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  selectedPill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#EEF2FF', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    marginHorizontal: 20, borderWidth: 1, borderColor: '#C7D2FE',
  },
  selectedPillText: { fontSize: 14, fontWeight: '700', color: '#2E2A85' },
  
  // Options Grid (Visits, Vendors)
  optionsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    marginHorizontal: 20, marginTop: 4,
  },
  optionItem: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F3F4F6', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  optionItemActive: {
    backgroundColor: '#2E2A85', borderColor: '#2E2A85',
  },
  optionText: { fontSize: 12, fontWeight: '600', color: '#4B5563' },
  optionTextActive: { color: '#FFFFFF' },
  errorText: {
    fontSize: 12, color: '#EF4444', fontWeight: '500',
    marginHorizontal: 20, marginTop: 4,
  },
});
