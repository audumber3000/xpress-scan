import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View, Linking } from 'react-native';
import { Lock } from 'lucide-react-native';
import { WhatsAppIcon } from './icons/WhatsAppIcon';
import { MARKETING_SITE_TEXT } from '../constants/platform';
import { colors } from '../constants/theme';
import type { PlanBlockedDetail } from '../../services/api/planLock';

/**
 * What a clinic sees when it tries to change something on a stopped plan.
 *
 * Driven by the `plan:blocked` handler that `base.api.ts` calls on a 402, so
 * every refused write produces the same explanation wherever it came from,
 * instead of each screen showing its own "something went wrong".
 *
 * ## The words are the server's
 *
 * `title` and `message` arrive from `core/plan_state.py`. A trial that ended, a
 * renewal that failed and an introductory period that ran out read very
 * differently — the renewal one apologises and offers to fix it before charging
 * anything — and inventing a generic "please upgrade" here would tell a paying
 * customer whose card bounced to go and start a trial.
 *
 * ## No route to buying, on either platform
 *
 * Subscriptions are bought on the website. `molarplus.com` is rendered as plain
 * text: not a link, not a button, nothing tappable. That is what App Store
 * guideline 3.1.1 requires of a sign-in-only client, and doing the same on
 * Android means one behaviour to build, test and screenshot rather than two.
 *
 * WhatsApp support IS tappable, because it is customer support rather than a
 * purchasing mechanism, and this modal appears at the exact moment somebody is
 * stuck. Dismissible for the same reason: they may want to go and read a
 * patient file rather than deal with billing this second, and reads still work.
 */

interface Props {
  detail: PlanBlockedDetail | null;
  clinicName?: string | null;
  supportPhone: string;
  onClose: () => void;
}

const TONE_RING: Record<string, string> = {
  critical: '#FEE2E2',
  warning: '#FEF3C7',
  info: colors.primaryBg,
};

const TONE_ICON: Record<string, string> = {
  critical: '#DC2626',
  warning: '#D97706',
  info: colors.primary,
};

export const PlanBlockedModal: React.FC<Props> = ({
  detail, clinicName, supportPhone, onClose,
}) => {
  if (!detail) return null;

  const tone = detail.tone || 'info';
  const message = [
    'Hi MolarPlus support, my clinic is locked and I need help.',
    clinicName ? `Clinic: ${clinicName}` : null,
    detail.title ? `Status: ${detail.title}` : null,
  ].filter(Boolean).join('\n');

  const openSupport = () => {
    Linking.openURL(`https://wa.me/${supportPhone}?text=${encodeURIComponent(message)}`)
      .catch(() => { /* no WhatsApp installed; nothing useful to fall back to */ });
  };

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <View style={[s.icon, { backgroundColor: TONE_RING[tone] || TONE_RING.info }]}>
            <Lock size={24} color={TONE_ICON[tone] || TONE_ICON.info} />
          </View>

          <Text style={s.title}>{detail.title || 'Your plan has stopped'}</Text>
          {!!detail.message && <Text style={s.body}>{detail.message}</Text>}

          <View style={s.notice}>
            <Text style={s.noticeText}>
              Your clinic is view only for now. Every patient record, invoice and report is
              still here and can be opened as usual.
            </Text>
          </View>

          {/* Plain text. Naming the site is a statement of fact; making it
              tappable would be a call to action steering to an external
              purchase, which is the thing that gets a build rejected. */}
          <Text style={s.instruction}>
            Plans are managed on the MolarPlus website. Sign in at {MARKETING_SITE_TEXT} from any
            browser to choose one.
          </Text>

          <TouchableOpacity style={s.supportBtn} onPress={openSupport} activeOpacity={0.85}>
            <WhatsAppIcon size={20} />
            <Text style={s.supportText}>Message support on WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.dismiss} onPress={onClose} activeOpacity={0.7}>
            <Text style={s.dismissText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.55)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 34,
  },
  icon: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.gray900 },
  body: { fontSize: 14, lineHeight: 21, color: colors.gray600, marginTop: 6 },
  notice: {
    backgroundColor: colors.gray50,
    borderColor: colors.gray200,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 16,
  },
  noticeText: { fontSize: 12, lineHeight: 18, color: colors.gray600 },
  instruction: { fontSize: 13, lineHeight: 20, color: colors.gray700, marginTop: 14, fontWeight: '500' },
  supportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    backgroundColor: '#FFFFFF',
    borderColor: colors.gray200,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 18,
  },
  supportText: { color: colors.gray900, fontSize: 15, fontWeight: '700' },
  dismiss: { alignItems: 'center', paddingVertical: 14, marginTop: 2 },
  dismissText: { color: colors.gray500, fontSize: 14, fontWeight: '600' },
});
