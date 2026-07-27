import type { DeviceStatus } from '@bem-control/api-client';

const STYLES: Record<DeviceStatus, string> = {
  ONLINE: 'bg-brand-100 text-brand-700',
  OFFLINE: 'bg-gray-200 text-gray-600',
  UNPROVISIONED: 'bg-amber-100 text-amber-700',
  DISABLED: 'bg-red-100 text-red-700',
};

const LABELS: Record<DeviceStatus, string> = {
  ONLINE: 'Online',
  OFFLINE: 'Offline',
  UNPROVISIONED: 'Awaiting first connection',
  DISABLED: 'Disabled',
};

export function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      <span
        className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
          status === 'ONLINE' ? 'bg-brand-500' : status === 'DISABLED' ? 'bg-red-500' : 'bg-gray-400'
        }`}
      />
      {LABELS[status]}
    </span>
  );
}
