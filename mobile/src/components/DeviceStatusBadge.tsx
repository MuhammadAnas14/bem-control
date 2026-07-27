import { StyleSheet, Text, View } from 'react-native';
import type { DeviceStatus } from '@bem-control/api-client';

const COLORS: Record<DeviceStatus, { bg: string; fg: string; dot: string }> = {
  ONLINE: { bg: '#d6ebe3', fg: '#1e4f3e', dot: '#2f7d63' },
  OFFLINE: { bg: '#e5e7eb', fg: '#4b5563', dot: '#9ca3af' },
  UNPROVISIONED: { bg: '#fef3c7', fg: '#92400e', dot: '#d97706' },
  DISABLED: { bg: '#fee2e2', fg: '#991b1b', dot: '#dc2626' },
};

const LABELS: Record<DeviceStatus, string> = {
  ONLINE: 'Online',
  OFFLINE: 'Offline',
  UNPROVISIONED: 'Awaiting connection',
  DISABLED: 'Disabled',
};

export function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  const c = COLORS[status];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <View style={[styles.dot, { backgroundColor: c.dot }]} />
      <Text style={[styles.label, { color: c.fg }]}>{LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  label: { fontSize: 12, fontWeight: '500' },
});
