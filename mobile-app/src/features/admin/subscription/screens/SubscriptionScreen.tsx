import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Award, CreditCard, Download, HelpCircle, ChevronRight } from 'lucide-react-native';
import { adminColors } from '../../../../shared/constants/adminColors';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';

interface SubscriptionScreenProps {
  navigation: any;
}

export const SubscriptionScreen: React.FC<SubscriptionScreenProps> = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Subscription Management"
        onBackPress={() => navigation.goBack()}
        variant="admin"
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Current Plan */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>CURRENT PLAN</Text>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Active</Text>
            </View>
          </View>

          <View style={styles.planCard}>
            <View style={styles.planHeader}>
              <View style={styles.planIconContainer}>
                <Award size={28} color={adminColors.primary} />
              </View>
              <View style={styles.planInfo}>
                <Text style={styles.planName}>Professional Plan</Text>
                <Text style={styles.planPrice}>$99 / month • Renews Oct 12, 2023</Text>
              </View>
            </View>

            {/* Patient Count */}
            <View style={styles.usageSection}>
              <View style={styles.usageHeader}>
                <Text style={styles.usageLabel}>Patient Count</Text>
                <Text style={styles.usageValue}>850 / 1,000</Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: '85%' }]} />
              </View>
              <Text style={styles.usageNote}>85% of monthly limit reached</Text>
            </View>

            {/* Cloud Storage */}
            <View style={styles.usageSection}>
              <View style={styles.usageHeader}>
                <Text style={styles.usageLabel}>Cloud Storage</Text>
                <Text style={styles.usageValue}>15GB / 50GB</Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: '30%' }]} />
              </View>
            </View>

            {/* Manage Button */}
            <TouchableOpacity style={styles.manageButton}>
              <CreditCard size={20} color="#FFFFFF" />
              <Text style={styles.manageButtonText}>Manage Plan & Billing</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Billing History */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>BILLING HISTORY</Text>
            <TouchableOpacity>
              <Text style={styles.viewAllButton}>View All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.billingCard}>
            <View style={styles.invoiceItem}>
              <View style={[styles.invoiceIcon, { backgroundColor: '#E0F2F2' }]}>
                <CreditCard size={20} color={adminColors.primary} />
              </View>
              <View style={styles.invoiceInfo}>
                <Text style={styles.invoiceDate}>Sep 12, 2023</Text>
                <Text style={styles.invoiceNumber}>INV-0042 • $99.00</Text>
              </View>
              <View style={styles.paidBadge}>
                <Text style={styles.paidText}>PAID</Text>
              </View>
              <TouchableOpacity style={styles.downloadButton}>
                <Download size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <View style={styles.separator} />

            <View style={styles.invoiceItem}>
              <View style={[styles.invoiceIcon, { backgroundColor: '#E0F2F2' }]}>
                <CreditCard size={20} color={adminColors.primary} />
              </View>
              <View style={styles.invoiceInfo}>
                <Text style={styles.invoiceDate}>Aug 12, 2023</Text>
                <Text style={styles.invoiceNumber}>INV-0039 • $99.00</Text>
              </View>
              <View style={styles.paidBadge}>
                <Text style={styles.paidText}>PAID</Text>
              </View>
              <TouchableOpacity style={styles.downloadButton}>
                <Download size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <View style={styles.separator} />

            <View style={styles.invoiceItem}>
              <View style={[styles.invoiceIcon, { backgroundColor: '#E0F2F2' }]}>
                <CreditCard size={20} color={adminColors.primary} />
              </View>
              <View style={styles.invoiceInfo}>
                <Text style={styles.invoiceDate}>Jul 12, 2023</Text>
                <Text style={styles.invoiceNumber}>INV-0035 • $99.00</Text>
              </View>
              <View style={styles.paidBadge}>
                <Text style={styles.paidText}>PAID</Text>
              </View>
              <TouchableOpacity style={styles.downloadButton}>
                <Download size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Upgrade Prompt */}
        <View style={styles.upgradeCard}>
          <View style={styles.upgradeIcon}>
            <HelpCircle size={24} color={adminColors.primary} />
          </View>
          <View style={styles.upgradeContent}>
            <Text style={styles.upgradeTitle}>Need to upgrade your plan?</Text>
            <Text style={styles.upgradeText}>Chat with our team for custom clinic solutions.</Text>
          </View>
          <ChevronRight size={20} color="#9CA3AF" />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },
  activeBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
  },
  viewAllButton: {
    fontSize: 14,
    fontWeight: '600',
    color: adminColors.primary,
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  planIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E0F2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 13,
    color: '#6B7280',
  },
  usageSection: {
    marginBottom: 20,
  },
  usageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  usageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  usageValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: adminColors.primary,
    borderRadius: 4,
  },
  usageNote: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: adminColors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  manageButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  billingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  invoiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  invoiceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  invoiceInfo: {
    flex: 1,
  },
  invoiceDate: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  invoiceNumber: {
    fontSize: 13,
    color: '#6B7280',
  },
  paidBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 12,
  },
  paidText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  downloadButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 72,
  },
  upgradeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2F2',
    padding: 20,
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: 24,
  },
  upgradeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  upgradeContent: {
    flex: 1,
  },
  upgradeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  upgradeText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
});
