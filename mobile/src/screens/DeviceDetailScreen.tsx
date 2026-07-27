import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Device, TelemetryReading } from '@bem-control/api-client';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { apiClient } from '../lib/apiClient';
import { useAuth } from '../state/AuthContext';
import { useRealtime } from '../hooks/useRealtime';
import { DeviceStatusBadge } from '../components/DeviceStatusBadge';

type Props = NativeStackScreenProps<RootStackParamList, 'DeviceDetail'>;

export function DeviceDetailScreen({ route }: Props) {
  const { deviceId } = route.params;
  const { selectedOrgId } = useAuth();
  const [device, setDevice] = useState<Device | null>(null);
  const [readings, setReadings] = useState<TelemetryReading[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!selectedOrgId) return;
    apiClient.getDevice(selectedOrgId, deviceId).then(setDevice);
    apiClient.getTelemetryHistory(selectedOrgId, deviceId, { limit: 30 }).then(setReadings);
  }, [selectedOrgId, deviceId]);

  useRealtime(selectedOrgId ?? null, (event) => {
    if (event.deviceId !== deviceId) return;
    if (event.type === 'status') {
      setDevice((d) => (d ? { ...d, status: event.status } : d));
    } else {
      setDevice((d) => (d ? { ...d, status: 'ONLINE', lastSeenAt: event.recordedAt } : d));
      setReadings((current) => [
        ...Object.entries(event.metrics).map(([metric, value]) => ({
          id: `${event.recordedAt}-${metric}`,
          deviceId: event.deviceId,
          metric,
          value,
          unit: null,
          recordedAt: event.recordedAt,
        })),
        ...current,
      ]);
    }
  });

  async function sendReboot() {
    if (!selectedOrgId) return;
    setSending(true);
    try {
      await apiClient.createCommand(selectedOrgId, deviceId, { type: 'REBOOT' });
    } finally {
      setSending(false);
    }
  }

  if (!device) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{device.name}</Text>
      <View style={styles.badgeRow}>
        <DeviceStatusBadge status={device.status} />
        <Text style={styles.meta}>Firmware {device.firmwareVersion ?? 'unknown'}</Text>
      </View>

      <TouchableOpacity style={styles.rebootButton} onPress={sendReboot} disabled={sending}>
        <Text style={styles.rebootText}>{sending ? 'Sending...' : 'Reboot device'}</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Recent readings</Text>
      <FlatList
        data={readings}
        keyExtractor={(r) => r.id}
        ListEmptyComponent={<Text style={styles.empty}>No telemetry yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.readingRow}>
            <Text style={styles.readingMetric}>{item.metric}</Text>
            <Text style={styles.readingValue}>
              {item.value}
              {item.unit ?? ''}
            </Text>
            <Text style={styles.readingTime}>{new Date(item.recordedAt).toLocaleTimeString()}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827', marginTop: 8 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 16 },
  meta: { fontSize: 12, color: '#6b7280' },
  rebootButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  rebootText: { fontWeight: '600', color: '#374151' },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  empty: { color: '#9ca3af', fontSize: 13 },
  readingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  readingMetric: { fontSize: 13, color: '#111827', fontWeight: '500', flex: 1 },
  readingValue: { fontSize: 13, color: '#26654f', fontWeight: '600', flex: 1, textAlign: 'center' },
  readingTime: { fontSize: 11, color: '#9ca3af', flex: 1, textAlign: 'right' },
});
