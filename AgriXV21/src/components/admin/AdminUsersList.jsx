import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import HoverPressable from '../HoverPressable';
import { adminUsersStyles as styles } from './adminUsersStyles';

function fullName(u) {
  const first = String(u?.firstName || '').trim();
  const last = String(u?.lastName || '').trim();
  return `${first} ${last}`.trim() || String(u?.fullName || u?.full_name || u?.name || '').trim();
}

function roleLabel(u) {
  const raw = String(u?.role || '').trim().toLowerCase();
  if (raw === 'admin' || u?.isAdmin) return 'ADMIN';
  return 'USER';
}

export default function AdminUsersList({ isCompact, items, status, onEdit, onDelete, onToggleAdmin }) {
  return (
    <ScrollView style={styles.tableScroll} contentContainerStyle={styles.tableScrollContent}>
      {!isCompact ? (
        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]}>
            <Text style={[styles.cell, styles.cellEmail]}>Email</Text>
            <Text style={[styles.cell, styles.cellName]}>Name</Text>
            <Text style={[styles.cell, styles.cellPhone]}>Phone</Text>
            <Text style={[styles.cell, styles.cellDate]}>Created</Text>
            <Text style={[styles.cell, styles.cellDate]}>Updated</Text>
            <Text style={[styles.cell, styles.cellActions]}>Actions</Text>
          </View>
          {items.map((u) => (
            <View key={u.id} style={styles.row}>
              <View style={[styles.cellEmailRow, styles.cellEmail]}>
                <Text style={[styles.cell, styles.cellEmailText]} numberOfLines={1} ellipsizeMode="middle">
                  {u.email}
                </Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{roleLabel(u)}</Text>
                </View>
              </View>
              <Text style={[styles.cell, styles.cellName]} numberOfLines={1} ellipsizeMode="tail">
                {fullName(u) || '—'}
              </Text>
              <Text style={[styles.cell, styles.cellPhone]} numberOfLines={1}>
                {u.phone || '—'}
              </Text>
              <Text style={[styles.cell, styles.cellDate]} numberOfLines={1}>
                {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
              </Text>
              <Text style={[styles.cell, styles.cellDate]} numberOfLines={1}>
                {u.updatedAt ? new Date(u.updatedAt).toLocaleDateString() : '—'}
              </Text>
              <View style={[styles.cell, styles.cellActions]}>
                <HoverPressable
                  style={[styles.actionButton, u.isAdmin ? styles.adminToggleButtonActive : styles.adminToggleButton]}
                  onPress={() => onToggleAdmin(u)}
                >
                  <Text style={styles.actionButtonText}>{u.isAdmin ? 'Remove Admin' : 'Make Admin'}</Text>
                </HoverPressable>
                <HoverPressable style={styles.actionButton} onPress={() => onEdit(u)}>
                  <Text style={styles.actionButtonText}>Edit</Text>
                </HoverPressable>
                <HoverPressable style={styles.deleteButton} onPress={() => onDelete(u)}>
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </HoverPressable>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.cardList}>
          {items.map((u) => (
            <View key={u.id} style={styles.userCard}>
              <View style={styles.userEmailRow}>
                <Text style={styles.userEmail} numberOfLines={1} ellipsizeMode="middle">
                  {u.email}
                </Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{roleLabel(u)}</Text>
                </View>
              </View>
              <Text style={styles.userName} numberOfLines={1}>
                {fullName(u) || '—'}
              </Text>
              <Text style={styles.userMeta} numberOfLines={1}>
                Phone: {u.phone || '—'}
              </Text>
              <Text style={styles.userMeta} numberOfLines={1}>
                Role: {roleLabel(u)}
              </Text>
              <Text style={styles.userMeta} numberOfLines={1}>
                Created: {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
              </Text>
              <View style={styles.cardActions}>
                <HoverPressable
                  style={[styles.actionButton, u.isAdmin ? styles.adminToggleButtonActive : styles.adminToggleButton]}
                  onPress={() => onToggleAdmin(u)}
                >
                  <Text style={styles.actionButtonText}>{u.isAdmin ? 'Remove Admin' : 'Make Admin'}</Text>
                </HoverPressable>
                <HoverPressable style={styles.actionButton} onPress={() => onEdit(u)}>
                  <Text style={styles.actionButtonText}>Edit</Text>
                </HoverPressable>
                <HoverPressable style={styles.deleteButton} onPress={() => onDelete(u)}>
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </HoverPressable>
              </View>
            </View>
          ))}
        </View>
      )}

      {items.length === 0 && status !== 'loading' ? <Text style={styles.emptyText}>No users found.</Text> : null}
    </ScrollView>
  );
}

