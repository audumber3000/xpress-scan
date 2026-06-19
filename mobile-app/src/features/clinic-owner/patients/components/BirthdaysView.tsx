import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import { Cake, MessageCircle } from 'lucide-react-native';
import { colors } from '../../../../shared/constants/colors';
import { patientsApiService } from '../../../../services/api/patients.api';

type Birthday = {
  id: number; display_id?: string; name: string; phone?: string;
  next_birthday: string; days_until: number; turning_age: number;
};

interface BirthdaysViewProps {
  onPatientPress?: (id: number) => void;
}

export const BirthdaysView: React.FC<BirthdaysViewProps> = ({ onPatientPress }) => {
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await patientsApiService.getUpcomingBirthdays(30);
    setBirthdays(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    const data = await patientsApiService.getUpcomingBirthdays(30);
    setBirthdays(data);
    setRefreshing(false);
  };

  const wish = (phone?: string) => {
    if (!phone) return;
    const num = phone.replace(/[^0-9]/g, '');
    Linking.openURL(`https://wa.me/${num}`);
  };

  const labelFor = (d: number) => (d === 0 ? 'Today 🎂' : d === 1 ? 'Tomorrow' : `in ${d} days`);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!birthdays.length) {
    return (
      <ScrollView
        contentContainerStyle={styles.emptyWrap}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Cake size={48} color={colors.gray300} />
        <Text style={styles.emptyTitle}>No upcoming birthdays</Text>
        <Text style={styles.emptySub}>Birthdays show up here once patients have a date of birth on file.</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {birthdays.map((b) => {
        const today = b.days_until === 0;
        return (
          <View key={b.id} style={styles.card}>
            <TouchableOpacity style={styles.cardLeft} onPress={() => onPatientPress?.(b.id)} activeOpacity={0.7}>
              <View style={[styles.iconCircle, today && styles.iconCircleToday]}>
                <Cake size={20} color={today ? '#DB2777' : colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{b.name}</Text>
                <Text style={styles.meta}>
                  {new Date(b.next_birthday).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} • turning {b.turning_age}
                </Text>
              </View>
            </TouchableOpacity>
            <View style={styles.cardRight}>
              <Text style={[styles.badge, today && styles.badgeToday]}>{labelFor(b.days_until)}</Text>
              {!!b.phone && (
                <TouchableOpacity style={styles.wishBtn} onPress={() => wish(b.phone)}>
                  <MessageCircle size={14} color="#16A34A" />
                  <Text style={styles.wishText}>Wish</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', padding: 40, paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.gray700, marginTop: 12 },
  emptySub: { fontSize: 13, color: colors.gray400, textAlign: 'center' },
  list: { padding: 16, gap: 10 },
  card: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.white, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#F3F4F6',
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center' },
  iconCircleToday: { backgroundColor: '#FCE7F3' },
  name: { fontSize: 15, fontWeight: '600', color: colors.gray900 },
  meta: { fontSize: 12, color: colors.gray500, marginTop: 2 },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  badge: { fontSize: 12, fontWeight: '600', color: colors.gray600, backgroundColor: colors.gray100, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  badgeToday: { color: '#BE185D', backgroundColor: '#FCE7F3' },
  wishBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  wishText: { fontSize: 12, fontWeight: '600', color: '#16A34A' },
});
