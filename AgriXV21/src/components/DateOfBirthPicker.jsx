import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, FlatList, Platform } from 'react-native';
import { ChevronLeft, ChevronRight, ChevronDown, Calendar as CalendarIcon, X } from 'lucide-react-native';
import { theme } from '../ui/theme';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function DateOfBirthPicker({ value, onChange, error, allowInvalidSelection = false }) {
  const [modalVisible, setModalVisible] = useState(false);
  const [viewDate, setViewDate] = useState(new Date()); // The date currently being viewed (month/year)
  const [selectedDate, setSelectedDate] = useState(null);
  
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar', 'month', 'year'
  const [validationPopupVisible, setValidationPopupVisible] = useState(false);

  // Initialize state from value prop
  useEffect(() => {
    if (value) {
      const [y, m, d] = value.split('-').map(Number);
      if (y && m && d) {
        const date = new Date(y, m - 1, d);
        setSelectedDate(date);
        setViewDate(new Date(date)); // Copy for view
      }
    } else {
      // Default view to 18 years ago if no date selected
      const d = new Date();
      d.setFullYear(d.getFullYear() - 18);
      setViewDate(d);
    }
  }, [value, modalVisible]);

  const handleDaySelect = (day) => {
    if (!day) return;
    
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);

    const formatted = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-${String(newDate.getDate()).padStart(2, '0')}`;
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (newDate.getTime() > today.getTime()) {
      onChange(formatted);
      setModalVisible(false);
      return;
    }
    
    // 18+ Validation
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 18);
    
    // Check if selected date is after cutoff (i.e., user is younger than 18)
    // We compare time values to be safe, setting hours to 0
    const checkDate = new Date(newDate);
    checkDate.setHours(0,0,0,0);
    const checkCutoff = new Date(cutoff);
    checkCutoff.setHours(0,0,0,0);

    if (checkDate > checkCutoff) {
      if (allowInvalidSelection) {
        onChange(formatted);
        setModalVisible(false);
        return;
      }
      setValidationPopupVisible(true);
      // We do NOT update the value if invalid
      return;
    }

    onChange(formatted);
    setModalVisible(false);
  };

  const changeMonth = (increment) => {
    const newDate = new Date(viewDate);
    newDate.setMonth(newDate.getMonth() + increment);
    setViewDate(newDate);
  };

  const changeYear = (year) => {
    const newDate = new Date(viewDate);
    newDate.setFullYear(year);
    setViewDate(newDate);
    setViewMode('calendar');
  };

  const selectMonth = (monthIndex) => {
    const newDate = new Date(viewDate);
    newDate.setMonth(monthIndex);
    setViewDate(newDate);
    setViewMode('calendar');
  };

  const renderCalendarGrid = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const grid = [];
    
    // Empty slots for days before the 1st
    for (let i = 0; i < firstDay; i++) {
      grid.push(null);
    }
    
    // Days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      grid.push(i);
    }

    return (
      <View style={styles.calendarGrid}>
        <View style={styles.weekdaysRow}>
          {WEEKDAYS.map((day, index) => (
            <Text key={index} style={styles.weekdayText}>{day}</Text>
          ))}
        </View>
        <View style={styles.daysGrid}>
          {grid.map((day, index) => {
            const isSelected = selectedDate && 
              day === selectedDate.getDate() && 
              month === selectedDate.getMonth() && 
              year === selectedDate.getFullYear();
            
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dayCell, 
                  !day && styles.dayCellEmpty,
                  isSelected && styles.dayCellSelected
                ]}
                onPress={() => day && handleDaySelect(day)}
                disabled={!day}
              >
                {day && (
                  <Text style={[
                    styles.dayText,
                    isSelected && styles.dayTextSelected
                  ]}>
                    {day}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderYearPicker = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= 1900; y--) {
      years.push(y);
    }

    return (
      <FlatList
        data={years}
        keyExtractor={(item) => item.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[styles.pickerItem, item === viewDate.getFullYear() && styles.pickerItemSelected]}
            onPress={() => changeYear(item)}
          >
            <Text style={[styles.pickerItemText, item === viewDate.getFullYear() && styles.pickerItemTextSelected]}>
              {item}
            </Text>
          </TouchableOpacity>
        )}
        style={styles.listContainer}
      />
    );
  };

  const renderMonthPicker = () => {
    return (
      <View style={styles.monthGrid}>
        {MONTHS.map((m, index) => (
          <TouchableOpacity 
            key={m} 
            style={[styles.monthItem, index === viewDate.getMonth() && styles.monthItemSelected]}
            onPress={() => selectMonth(index)}
          >
            <Text style={[styles.monthItemText, index === viewDate.getMonth() && styles.monthItemTextSelected]}>
              {m.substring(0, 3)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={[styles.inputTrigger, error && styles.inputError]} 
        onPress={() => setModalVisible(true)}
      >
        <CalendarIcon size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
        <Text style={[styles.inputText, !value && styles.placeholderText]}>
          {value || 'Select Date of Birth'}
        </Text>
      </TouchableOpacity>
      
      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Main Calendar Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalVisible(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            
            {/* Header */}
            <View style={styles.header}>
              {viewMode === 'calendar' && (
                <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.navButton}>
                  <ChevronLeft size={24} color="#333" />
                </TouchableOpacity>
              )}
              
              <View style={styles.headerTitleContainer}>
                <TouchableOpacity onPress={() => setViewMode(viewMode === 'month' ? 'calendar' : 'month')}>
                  <Text style={styles.headerTitle}>
                    {MONTHS[viewDate.getMonth()]}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setViewMode(viewMode === 'year' ? 'calendar' : 'year')}>
                  <Text style={styles.headerTitle}>
                    {viewDate.getFullYear()}
                  </Text>
                </TouchableOpacity>
              </View>

              {viewMode === 'calendar' && (
                <TouchableOpacity onPress={() => changeMonth(1)} style={styles.navButton}>
                  <ChevronRight size={24} color="#333" />
                </TouchableOpacity>
              )}
              
              {viewMode !== 'calendar' && (
                 <TouchableOpacity onPress={() => setViewMode('calendar')} style={styles.navButton}>
                   <X size={24} color="#333" />
                 </TouchableOpacity>
              )}
            </View>

            {/* Content */}
            <View style={styles.body}>
              {viewMode === 'calendar' && renderCalendarGrid()}
              {viewMode === 'year' && renderYearPicker()}
              {viewMode === 'month' && renderMonthPicker()}
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>

          </View>
        </TouchableOpacity>
      </Modal>

      {/* 18+ Validation Modal */}
      <Modal
        visible={validationPopupVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setValidationPopupVisible(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setValidationPopupVisible(false)}>
          <View style={[styles.modalContent, styles.alertContent]} onStartShouldSetResponder={() => true}>
             <Text style={styles.alertTitle}>Age Restriction</Text>
             <Text style={styles.alertMessage}>
               You must be at least 18 years old to register.
             </Text>
             <TouchableOpacity 
               style={styles.alertButton} 
               onPress={() => setValidationPopupVisible(false)}
             >
               <Text style={styles.alertButtonText}>OK</Text>
             </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'column',
  },
  inputTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.input,
    padding: 12,
    height: 50,
  },
  inputError: {
    borderColor: theme.colors.danger,
  },
  inputIcon: {
    marginRight: 10,
  },
  inputText: {
    fontSize: 16,
    color: theme.colors.text,
  },
  placeholderText: {
    color: theme.colors.textMuted,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlayDark,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: theme.radius.card,
    width: '100%',
    maxWidth: 360,
    overflow: 'hidden',
    ...theme.shadows.medium,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(16px)',
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.bg,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  navButton: {
    padding: 4,
  },
  body: {
    padding: 16,
    minHeight: 320,
    justifyContent: 'center',
  },
  calendarGrid: {
    width: '100%',
  },
  weekdaysRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%', // 100% / 7
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
    borderRadius: 20,
  },
  dayCellEmpty: {
    backgroundColor: 'transparent',
  },
  dayCellSelected: {
    backgroundColor: theme.colors.brand,
  },
  dayText: {
    fontSize: 16,
    color: theme.colors.text,
  },
  dayTextSelected: {
    color: theme.colors.surface,
    fontWeight: 'bold',
  },
  listContainer: {
    height: 300,
  },
  pickerItem: {
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  pickerItemSelected: {
    backgroundColor: theme.colors.brandLight,
  },
  pickerItemText: {
    fontSize: 18,
    color: theme.colors.text,
  },
  pickerItemTextSelected: {
    color: theme.colors.brand,
    fontWeight: 'bold',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  monthItem: {
    width: '30%',
    aspectRatio: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: theme.radius.sm || 8,
  },
  monthItemSelected: {
    backgroundColor: theme.colors.brand,
  },
  monthItemText: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '500',
  },
  monthItemTextSelected: {
    color: theme.colors.surface,
    fontWeight: 'bold',
  },
  footer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    alignItems: 'center',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelButtonText: {
    color: theme.colors.textMuted,
    fontSize: 16,
  },
  alertContent: {
    padding: 24,
    alignItems: 'center',
    maxWidth: 300,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.danger,
    marginBottom: 12,
  },
  alertMessage: {
    fontSize: 16,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 24,
  },
  alertButton: {
    backgroundColor: theme.colors.danger,
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: theme.radius.input,
  },
  alertButtonText: {
    color: theme.colors.surface,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
