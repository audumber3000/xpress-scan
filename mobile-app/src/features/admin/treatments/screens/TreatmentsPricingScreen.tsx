import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Search, MoreVertical, Plus, Stethoscope, Sparkles, X, Smile, Calendar } from 'lucide-react-native';
import { TreatmentItem } from '../components/TreatmentItem';
import { adminColors } from '../../../../shared/constants/adminColors';

interface TreatmentsPricingScreenProps {
  navigation: any;
}

export const TreatmentsPricingScreen: React.FC<TreatmentsPricingScreenProps> = ({ navigation }) => {
  const [selectedCategory, setSelectedCategory] = useState('All Services');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = ['All Services', 'General', 'Orthodontics', 'Cosmetic'];

  const treatments = {
    'GENERAL DENTISTRY': [
      { id: '1', name: 'Initial Consultation', description: '30 mins assessment', price: '$50.00', icon: Stethoscope },
      { id: '2', name: 'Professional Cleaning', description: 'Deep scaling & polish', price: '$120.00', icon: Sparkles },
      { id: '3', name: 'Digital X-Ray', description: 'Full panoramic scan', price: '$80.00', icon: X },
    ],
    'ORTHODONTICS': [
      { id: '4', name: 'Braces Installation', description: 'Metal or Ceramic', price: '$3,500.00', icon: Smile },
      { id: '5', name: 'Monthly Adjustment', description: 'Standard follow-up', price: '$150.00', icon: Calendar },
    ],
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft size={24} color={adminColors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Treatments & Pricing</Text>
        <TouchableOpacity style={styles.menuButton}>
          <MoreVertical size={24} color={adminColors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Search size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search treatments..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Category Tabs */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
        >
          {categories.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryTab,
                selectedCategory === category && styles.categoryTabActive,
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text style={[
                styles.categoryText,
                selectedCategory === category && styles.categoryTextActive,
              ]}>
                {category}
              </Text>
              {selectedCategory === category && <View style={styles.categoryIndicator} />}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Treatments List */}
        {Object.entries(treatments).map(([category, items]) => (
          <View key={category} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{category}</Text>
              <Text style={styles.itemCount}>{items.length} ITEMS</Text>
            </View>
            <View style={styles.treatmentsList}>
              {items.map((treatment, index) => (
                <View key={treatment.id}>
                  <TreatmentItem
                    treatment={treatment}
                    onEdit={() => {}}
                  />
                  {index < items.length - 1 && <View style={styles.separator} />}
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab}>
        <Plus size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  menuButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  categoriesContainer: {
    paddingHorizontal: 20,
    gap: 24,
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  categoryTab: {
    paddingBottom: 12,
    position: 'relative',
  },
  categoryTabActive: {
  },
  categoryText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  categoryTextActive: {
    color: adminColors.primary,
    fontWeight: '600',
  },
  categoryIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: adminColors.primary,
    borderRadius: 2,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },
  itemCount: {
    fontSize: 12,
    fontWeight: '600',
    color: adminColors.primary,
  },
  treatmentsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 20,
    overflow: 'hidden',
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 80,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: adminColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: adminColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
