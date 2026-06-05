import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Rocket, Check, ChevronRight } from 'lucide-react-native';
import { colors } from '../../../../../../shared/constants/colors';
import { componentRadius } from '../../../../../../shared/constants/theme';

export interface ChecklistStep {
  key: string;
  label: string;
  done: boolean;
  onPress?: () => void;
}

interface GetStartedChecklistProps {
  steps: ChecklistStep[];
}

/**
 * Onboarding "Get started checklist" card. Replaces the dead-zero dashboard with
 * a clear path forward. Hides itself once every step is complete.
 */
export const GetStartedChecklist: React.FC<GetStartedChecklistProps> = ({ steps }) => {
  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;

  // Nothing left to nudge — get out of the way.
  if (completed === total) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBubble}>
          <Rocket size={18} color={colors.primary} strokeWidth={2.2} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Get started checklist</Text>
          <Text style={styles.subtitle}>{total} steps to unlock full use</Text>
        </View>
        <Text style={styles.progress}>
          {completed} / {total}
        </Text>
      </View>

      <View style={styles.steps}>
        {steps.map((step) => (
          <TouchableOpacity
            key={step.key}
            style={styles.stepRow}
            activeOpacity={step.done ? 1 : 0.7}
            disabled={step.done || !step.onPress}
            onPress={step.onPress}
          >
            <View style={[styles.checkbox, step.done && styles.checkboxDone]}>
              {step.done ? <Check size={13} color="#FFFFFF" strokeWidth={3} /> : null}
            </View>
            <Text style={[styles.stepLabel, step.done && styles.stepLabelDone]}>
              {step.label}
            </Text>
            {!step.done ? (
              <ChevronRight size={18} color={colors.gray400} strokeWidth={2.2} />
            ) : null}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: componentRadius.carouselCard, // 12 — match card style guide
    padding: 16,
    borderWidth: 1,
    borderColor: colors.gray200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primarySubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gray900,
  },
  subtitle: {
    fontSize: 13,
    color: colors.gray500,
    marginTop: 1,
  },
  progress: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  steps: {
    marginTop: 14,
    gap: 4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.gray300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  stepLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.gray700,
  },
  stepLabelDone: {
    color: colors.gray400,
    textDecorationLine: 'line-through',
  },
});
