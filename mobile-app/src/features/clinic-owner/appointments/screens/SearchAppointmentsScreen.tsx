import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, ListRenderItem } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search } from 'lucide-react-native';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';
import { SearchBar } from '../../patients/components/SearchBar';
import { appointmentsApiService, Appointment } from '../../../../services/api/appointments.api';
import { AppointmentCard } from '../components/AppointmentCard';

interface SearchAppointmentsScreenProps {
    navigation: any;
}

export const SearchAppointmentsScreen: React.FC<SearchAppointmentsScreenProps> = ({ navigation }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadAllAppointments();
    }, []);

    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredAppointments([]);
        } else {
            const filtered = appointments.filter(apt =>
                apt.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                apt.treatment.toLowerCase().includes(searchQuery.toLowerCase())
            );
            setFilteredAppointments(filtered);
        }
    }, [searchQuery, appointments]);

    const loadAllAppointments = async () => {
        setLoading(true);
        try {
            const data = await appointmentsApiService.getAppointments();
            setAppointments(data);
        } catch (error) {
            console.error('Error loading appointments for search:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAppointmentPress = (appointment: Appointment) => {
        navigation.navigate('AppointmentDetails', { appointment });
    };

    const renderItem: ListRenderItem<Appointment> = ({ item }) => (
        <AppointmentCard
            appointment={item}
            onPress={() => handleAppointmentPress(item)}
        />
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScreenHeader
                title="Search Appointments"
                onBackPress={() => navigation.goBack()}
                titleIcon={<Search size={22} color="#111827" />}
            />

            <SearchBar
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search by patient name or treatment..."
            />

            <FlatList
                data={filteredAppointments}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    listContent: {
        paddingBottom: 20,
    },
});
