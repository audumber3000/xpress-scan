import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { IndianRupee, ReceiptText } from 'lucide-react-native';
import { colors } from '../../../../shared/constants/colors';

interface PaymentItem {
    id: string;
    date: string;
    procedure: string;
    amount: number;
    status: 'paid' | 'pending' | 'overdue';
}

interface BillingViewProps {
    payments: PaymentItem[];
}

export const BillingView: React.FC<BillingViewProps> = ({ payments }) => {
    const totalAmount = payments.reduce((acc, curr) => acc + curr.amount, 0);

    if (payments.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <ReceiptText size={48} color={colors.gray300} />
                <Text style={styles.emptyText}>No billing records found.</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            <View style={styles.summaryCard}>
                <View>
                    <Text style={styles.summaryLabel}>Total Billing</Text>
                    <Text style={styles.summaryAmount}>₹{totalAmount.toLocaleString('en-IN')}</Text>
                </View>
                <View style={styles.summaryIcon}>
                    <IndianRupee size={24} color="#FFFFFF" />
                </View>
            </View>

            <Text style={styles.sectionHeader}>Payment History</Text>

            {payments.map((payment, index) => (
                <View key={payment.id || index} style={styles.paymentCard}>
                    <View style={styles.paymentHeader}>
                        <View>
                            <Text style={styles.paymentProcedure}>{payment.procedure}</Text>
                            <Text style={styles.paymentDate}>
                                {new Date(payment.date).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                })}
                            </Text>
                        </View>
                        <View style={[
                            styles.statusBadge,
                            { backgroundColor: payment.status === 'paid' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)' }
                        ]}>
                            <Text style={[
                                styles.statusText,
                                { color: payment.status === 'paid' ? colors.success : colors.warning }
                            ]}>
                                {payment.status.toUpperCase()}
                            </Text>
                        </View>
                    </View>
                    <Text style={styles.paymentAmount}>₹{payment.amount.toLocaleString('en-IN')}</Text>
                </View>
            ))}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        marginTop: 16,
        fontSize: 16,
        color: colors.gray500,
        textAlign: 'center',
    },
    summaryCard: {
        backgroundColor: colors.primary,
        borderRadius: 20,
        padding: 24,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
        elevation: 8,
    },
    summaryLabel: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 4,
    },
    summaryAmount: {
        color: '#FFFFFF',
        fontSize: 28,
        fontWeight: 'bold',
    },
    summaryIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionHeader: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 16,
    },
    paymentCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    paymentHeader: {
        flex: 1,
        marginRight: 12,
    },
    paymentProcedure: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
    },
    paymentDate: {
        fontSize: 12,
        color: colors.gray500,
        marginTop: 2,
    },
    paymentAmount: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.primary,
    },
    statusBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginTop: 6,
    },
    statusText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
});
