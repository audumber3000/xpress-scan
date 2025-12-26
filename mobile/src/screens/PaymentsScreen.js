import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { DollarSign, TrendingUp, CheckCircle, Clock } from 'lucide-react-native';
import ScreenHeader from '../components/ScreenHeader';
import StatCard from '../components/StatCard';

const PaymentCard = ({ name, date, method, amount, status }) => {
  const statusColor = status === 'pending' ? '#d97706' : '#16a34a';

  return (
    <View style={styles.paymentCard}>
      <View style={styles.paymentCardContent}>
        <View style={styles.paymentInfo}>
          <Text style={styles.paymentName}>{name}</Text>
          <View style={styles.paymentDetails}>
            <Text style={styles.paymentDetailText}>{date}</Text>
            <Text style={styles.dot}>•</Text>
            <Text style={styles.paymentDetailText}>{method}</Text>
          </View>
        </View>
        <View style={styles.paymentAmountContainer}>
          <Text style={styles.paymentAmount}>${amount}</Text>
          <Text style={[styles.paymentStatus, { color: statusColor }]}>{status}</Text>
        </View>
      </View>
    </View>
  );
};

const PaymentsScreen = () => {
  const [activeTab, setActiveTab] = useState('Recent');

  const payments = [
    { id: 1, name: 'Sarah Johnson', date: 'Dec 3, 2025', method: 'Card', amount: '120', status: 'paid' },
    { id: 2, name: 'Michael Brown', date: 'Dec 2, 2025', method: 'Cash', amount: '850', status: 'paid' },
    { id: 3, name: 'Emily Davis', date: 'Dec 1, 2025', method: 'Card', amount: '280', status: 'pending' },
    { id: 4, name: 'James Wilson', date: 'Nov 30, 2025', method: 'Insurance', amount: '420', status: 'paid' },
    { id: 5, name: 'Lisa Anderson', date: 'Nov 29, 2025', method: 'Card', amount: '190', status: 'paid' },
  ];

  const filteredPayments = activeTab === 'Pending' 
    ? payments.filter(p => p.status === 'pending')
    : payments;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Payments" subtitle="Financial overview" />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.statsRow}>
          <StatCard title="Total Revenue" value="$24,580" icon={DollarSign} iconColor="#16a34a" />
          <StatCard title="This Month" value="$6,800" icon={TrendingUp} iconColor="#1d8a99" />
        </View>

        <View style={[styles.statsRow, { marginTop: 12 }]}>
          <StatCard title="Collected" value="$21,340" icon={CheckCircle} iconColor="#16a34a" />
          <StatCard title="Pending" value="$3,240" icon={Clock} iconColor="#f59e0b" />
        </View>

        <View style={styles.tabsContainer}>
          {['Recent', 'Pending'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.paymentsList}>
          {filteredPayments.map((payment) => (
            <PaymentCard
              key={payment.id}
              name={payment.name}
              date={payment.date}
              method={payment.method}
              amount={payment.amount}
              status={payment.status}
            />
          ))}
        </View>

        <View style={{ height: 96 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
    marginTop: -16,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 4,
    marginTop: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#ffffff',
  },
  tabText: {
    textAlign: 'center',
    fontWeight: '500',
    color: '#6b7280',
  },
  activeTabText: {
    color: '#111827',
  },
  paymentsList: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginTop: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  paymentCard: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingVertical: 16,
  },
  paymentCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentInfo: {
    flex: 1,
  },
  paymentName: {
    color: '#111827',
    fontWeight: '600',
    fontSize: 16,
  },
  paymentDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  paymentDetailText: {
    color: '#6b7280',
    fontSize: 14,
  },
  dot: {
    color: '#9ca3af',
    marginHorizontal: 8,
  },
  paymentAmountContainer: {
    alignItems: 'flex-end',
  },
  paymentAmount: {
    color: '#16a34a',
    fontWeight: '600',
    fontSize: 16,
  },
  paymentStatus: {
    fontSize: 14,
  },
});

export default PaymentsScreen;
