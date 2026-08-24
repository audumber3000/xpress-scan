import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AlertTriangle, Lock, ArrowRight, X } from 'lucide-react-native';
import { useAuth } from '../../app/AuthContext';
import { WhatsAppIcon } from './icons/WhatsAppIcon';
import { SUPPORT_PHONE_RAW } from '../constants/support';

/**
 * A strip that appears when the clinic's plan needs attention.
 *
 * Mirrors `frontend/src/components/plan/PlanStatusBanner.jsx` so the two apps
 * say the same thing about the same clinic, and deliberately keeps its two
 * tones apart:
 *
 *   the last three days   amber, dismissible, easy to ignore. A renewal that is
 *                         about to happen is not a problem yet, and treating it
 *                         like one teaches people to ignore the red one too.
 *   already stopped       red, not dismissible. The clinic is view only and
 *                         needs to know why BEFORE it types out a new patient
 *                         and loses the typing to a refused save.
 *
 * The words come from the server (`core/plan_state.py`), which is the same
 * source the write-lock enforces from, so the phone cannot claim everything is
 * fine while every save is being refused.
 *
 * There is no "pay now" here on either platform: subscriptions are bought on
 * the website. The primary action opens the Subscription screen, which explains
 * that. Support is one tap away because the likeliest reason to be looking at
 * the red version is a renewal WE failed to take.
 */

const BLOCKED = ['trial_ended', 'lapsed', 'grant_ended'];
const WARNING = ['renewal_due', 'grant_due'];

interface Props {
  /** Screen to open when they tap through. Both hosts route to Subscription. */
  onManage?: () => void;
}

export const PlanStatusBanner: React.FC<Props> = ({ onManage }) => {
  const { backendUser } = useAuth();
  const navigation = useNavigation<any>();
  const [dismissed, setDismissed] = useState(false);

  const clinic = backendUser?.clinic;
  const state = clinic?.plan_state;
  if (!state || state === 'ok') return null;

  const isBlocked = BLOCKED.includes(state);
  const isWarning = WARNING.includes(state);
  if (!isBlocked && !isWarning) return null;
  if (isWarning && dismissed) return null;

  const title = clinic?.plan_state_title
    || (isBlocked ? 'Your plan has stopped' : 'Your plan needs attention');

  const openSupport = () => {
    const text = encodeURIComponent(
      [
        'Hi MolarPlus support, I need help with my plan.',
        clinic?.name ? `Clinic: ${clinic.name}` : null,
        `Status: ${title}`,
      ].filter(Boolean).join('\n')
    );
    Linking.openURL(`https://wa.me/${SUPPORT_PHONE_RAW}?text=${text}`)
      .catch(() => { /* no WhatsApp installed; nothing useful to fall back to */ });
  };

  const manage = () => (onManage ? onManage() : navigation.navigate('Subscription'));

  const tone = isBlocked ? TONE.blocked : TONE.warning;

  return (
    <View style={[s.bar, { backgroundColor: tone.bg, borderBottomColor: tone.border }]}>
      <View style={s.textRow}>
        {isBlocked
          ? <Lock size={14} color={tone.text} style={s.leadIcon} />
          : <AlertTriangle size={14} color={tone.text} style={s.leadIcon} />}
        <Text style={[s.title, { color: tone.text }]}>
          {title}
          {/* A real separator character, not just spacing. Without it these two
              sentences ran together as "endedYour clinic is view only" for
              anyone copying the text or hearing it read out. */}
          {isBlocked && (
            <Text style={[s.sub, { color: tone.text }]}>
              {' · '}Your clinic is view only until you choose a plan.
            </Text>
          )}
        </Text>
      </View>

      <View style={s.actions}>
        <TouchableOpacity
          style={[s.ghostBtn, { borderColor: tone.border }]}
          onPress={openSupport}
          activeOpacity={0.7}
        >
          <WhatsAppIcon size={13} />
          <Text style={[s.ghostText, { color: tone.text }]}>Support</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.solidBtn, { backgroundColor: tone.solid }]}
          onPress={manage}
          activeOpacity={0.85}
        >
          <Text style={s.solidText}>{isBlocked ? 'See plans' : 'Manage plan'}</Text>
          <ArrowRight size={12} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Only the amber one can be waved away. */}
        {isWarning && (
          <TouchableOpacity
            style={s.dismiss}
            onPress={() => setDismissed(true)}
            accessibilityLabel="Dismiss"
            activeOpacity={0.6}
          >
            <X size={14} color={tone.text} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const TONE = {
  blocked: { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', solid: '#DC2626' },
  warning: { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', solid: '#D97706' },
};

const s = StyleSheet.create({
  bar: { borderBottomWidth: 1, paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  textRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  leadIcon: { marginTop: 2 },
  title: { flex: 1, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  sub: { fontSize: 12, fontWeight: '400', lineHeight: 18 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ghostBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7,
  },
  ghostText: { fontSize: 11, fontWeight: '700' },
  solidBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8,
  },
  solidText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  dismiss: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
});
