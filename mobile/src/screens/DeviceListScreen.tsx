import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Device } from '@bem-control/api-client';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { apiClient } from '../lib/apiClient';
import { useAuth } from '../state/AuthContext';
import { useRealtime } from '../hooks/useRealtime';
import { DeviceStatusBadge } from '../components/DeviceStatusBadge';

type Props = NativeStackScreenProps<RootStackParamList, 'DeviceList'>;

export function DeviceListScreen({ navigation }: Props) {
  const { selectedOrgId, logout } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    if (!selectedOrgId) return;
    setRefreshing(true);
    apiClient
      .listDevices(selectedOrgId)
      .then(setDevices)
      .finally(() => setRefreshing(false));
  }, [selectedOrgId]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtime(selectedOrgId ?? null, (event) => {
    setDevices((current) =>
      current.map((d) => {
        if (d.id !== event.deviceId) return d;
        if (event.type === 'status') return { ...d, status: event.status };
        return { ...d, status: 'ONLINE', lastSeenAt: event.recordedAt };
      })
    );
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Devices</Text>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.signOut}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={devices}
        keyExtractor={(d) => d.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        contentContainerStyle={devices.length === 0 && styles.emptyContainer}
        ListEmptyComponent={<Text style={styles.empty}>No devices yet. Scan one to add it.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('DeviceDetail', { deviceId: item.id })}
          >
            <View>
              <Text style={styles.deviceName}>{item.name}</Text>
              <Text style={styles.deviceMeta}>
                {item.lastSeenAt ? new Date(item.lastSeenAt).toLocaleString() : 'Never seen'}
              </Text>
            </View>
            <DeviceStatusBadge status={item.status} />
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('ScanProvision')}>
        <Text style={styles.fabText}>Scan device</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 56,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  signOut: { color: '#6b7280', fontSize: 13 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  deviceName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  deviceMeta: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: '#9ca3af', fontSize: 13 },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 32,
    backgroundColor: '#26654f',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 999,
    elevation: 3,
  },
  fabText: { color: '#fff', fontWeight: '600' },
});
