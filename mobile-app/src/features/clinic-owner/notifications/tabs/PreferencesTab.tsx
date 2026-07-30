import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Send, Lock } from 'lucide-react-native';
import { colors } from '../../../../shared/constants/colors';
import { CHANNELS, CHANNEL_META, EVENT_LABELS, EVENT_AUDIENCE, AUTOMATED_EVENTS } from '../constants';
import type { Preference } from '../notifications.api';

interface Props {
  preferences: Preference[];
  onToggleEnabled: (eventType: string) => void;
  onToggleChannel: (eventType: string, channel: string) => void;
  onTest: (pref: { event_type: string; is_enabled: boolean }) => void;
}

const AudienceBadge: React.FC<{ audience: string }> = ({ audience }) => {
  const cfg = audience === 'doctor'
    ? { bg: '#EFF6FF', fg: '#2563EB', label: '👨‍⚕️ Doctor' }
    : audience === 'owner'
      ? { bg: '#F5F3FF', fg: '#7C3AED', label: '🤖 Auto' }
      : { bg: '#ECFDF5', fg: '#059669', label: '🧑‍🦷 Patient' };
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.badgeText, { color: cfg.fg }]}>{cfg.label}</Text>
    </View>
  );
};

export const PreferencesTab: React.FC<Props> = ({ preferences, onToggleEnabled, onToggleChannel, onTest }) => {
  return (
    <View style={{ gap: 16 }}>
      {/* Patient / clinic events */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Notification Preferences</Text>
        <Text style={styles.cardSub}>Choose channels, enable/disable, and test each event.</Text>

        {preferences.length === 0 ? (
          <Text style={styles.empty}>No preferences found.</Text>
        ) : preferences.map((pref) => {
          const audience = EVENT_AUDIENCE[pref.event_type] || 'patient';
          const label = EVENT_LABELS[pref.event_type] || pref.event_type.replace(/_/g, ' ');
          return (
            <View key={pref.event_type} style={[styles.eventRow, !pref.is_enabled && styles.eventRowOff]}>
              <View style={styles.eventTop}>
                <View style={{ flex: 1 }}>
                  <View style={styles.eventTitleRow}>
                    <Text style={[styles.eventTitle, !pref.is_enabled && { color: colors.gray400 }]}>{label}</Text>
                    <AudienceBadge audience={audience} />
                  </View>
                </View>
                <Switch
                  value={pref.is_enabled}
                  onValueChange={() => onToggleEnabled(pref.event_type)}
                  trackColor={{ false: '#E5E7EB', true: colors.primaryBg }}
                  thumbColor={pref.is_enabled ? colors.primary : '#9CA3AF'}
                />
              </View>

              {pref.is_enabled && (
                <View style={styles.channelsRow}>
                  {CHANNELS.map((ch) => {
                    const meta = CHANNEL_META[ch];
                    const locked = ch === 'sms';
                    const selected = pref.channels.includes(ch);
                    if (locked) {
                      return (
                        <View key={ch} style={[styles.chip, styles.chipLocked]}>
                          <Lock size={11} color={colors.gray400} />
                          <Text style={styles.chipLockedText}>{meta.label}</Text>
                          <Text style={styles.soon}>Soon</Text>
                        </View>
                      );
                    }
                    return (
                      <TouchableOpacity
                        key={ch}
                        onPress={() => onToggleChannel(pref.event_type, ch)}
                        style={[styles.chip, selected && { backgroundColor: meta.color + '18', borderColor: meta.color }]}
                        activeOpacity={0.7}
                      >
                        <meta.Icon size={12} color={selected ? meta.color : colors.gray400} />
                        <Text style={[styles.chipText, selected && { color: meta.color }]}>{meta.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity style={styles.testBtn} onPress={() => onTest(pref)} activeOpacity={0.7}>
                    <Send size={11} color={colors.primary} />
                    <Text style={styles.testBtnText}>Test</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Automated / platform notifications */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Automated Notifications</Text>
        <Text style={styles.cardSub}>System-sent messages to clinic owners. Use Test to preview and send a sample.</Text>
        {AUTOMATED_EVENTS.map((pref) => (
          <View key={pref.event_type} style={styles.autoRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.eventTitleRow}>
                <Text style={styles.eventTitle}>{EVENT_LABELS[pref.event_type] || pref.event_type}</Text>
                <View style={[styles.badge, { backgroundColor: '#F5F3FF' }]}>
                  <Text style={[styles.badgeText, { color: '#7C3AED' }]}>🤖 Auto</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity style={styles.testBtn} onPress={() => onTest({ ...pref, is_enabled: true })} activeOpacity={0.7}>
              <Send size={11} color={colors.primary} />
              <Text style={styles.testBtnText}>Test</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F3F4F6' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  cardSub: { fontSize: 12, color: colors.gray400, marginTop: 2, marginBottom: 8 },
  empty: { fontSize: 13, color: colors.gray400, textAlign: 'center', paddingVertical: 20 },

  eventRow: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingVertical: 12 },
  eventRowOff: { opacity: 0.7 },
  eventTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eventTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  eventTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },

  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 10, fontWeight: '700' },

  channelsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  chipText: { fontSize: 11, fontWeight: '600', color: colors.gray400 },
  chipLocked: { opacity: 0.6 },
  chipLockedText: { fontSize: 11, fontWeight: '600', color: colors.gray400 },
  soon: { fontSize: 8, fontWeight: '700', color: colors.gray400, backgroundColor: '#F3F4F6', borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1, overflow: 'hidden' },

  testBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primaryBg },
  testBtnText: { fontSize: 11, fontWeight: '700', color: colors.primary },

  autoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingVertical: 12 },
});
