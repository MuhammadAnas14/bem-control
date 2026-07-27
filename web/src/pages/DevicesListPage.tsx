import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Device } from '@bem-control/api-client';
import { apiClient } from '../lib/apiClient';
import { useAuth } from '../state/AuthContext';
import { useRealtime } from '../hooks/useRealtime';
import { DeviceStatusBadge } from '../components/DeviceStatusBadge';
import { DeviceMap } from '../components/DeviceMap';

const STALE_AFTER_MS = 2 * 60 * 1000;

function isStale(device: Device) {
  if (device.status !== 'ONLINE' || !device.lastSeenAt) return false;
  return Date.now() - new Date(device.lastSeenAt).getTime() > STALE_AFTER_MS;
}

export function DevicesListPage() {
  const { selectedOrgId } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedOrgId) return;
    setLoading(true);
    apiClient
      .listDevices(selectedOrgId)
      .then(setDevices)
      .finally(() => setLoading(false));
  }, [selectedOrgId]);

  useRealtime(selectedOrgId, (event) => {
    setDevices((current) =>
      current.map((d) => {
        if (d.id !== event.deviceId) return d;
        if (event.type === 'status') return { ...d, status: event.status };
        return { ...d, status: 'ONLINE', lastSeenAt: event.recordedAt };
      })
    );
  });

  const alerts = devices.filter((d) => d.status === 'OFFLINE' || isStale(d));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Device fleet</h1>
        <div className="flex rounded-md border border-gray-300 bg-white p-0.5 text-sm">
          <button
            onClick={() => setView('list')}
            className={`rounded px-3 py-1 ${view === 'list' ? 'bg-brand-600 text-white' : 'text-gray-600'}`}
          >
            List
          </button>
          <button
            onClick={() => setView('map')}
            className={`rounded px-3 py-1 ${view === 'map' ? 'bg-brand-600 text-white' : 'text-gray-600'}`}
          >
            Map
          </button>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-medium">{alerts.length}</span> device
          {alerts.length === 1 ? ' is' : 's are'} offline or hasn&apos;t reported in a while:{' '}
          {alerts.map((d) => d.name).join(', ')}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading devices...</p>
      ) : devices.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          No devices yet.{' '}
          <Link to="/devices/provision" className="font-medium text-brand-600 hover:underline">
            Provision your first device
          </Link>
          .
        </div>
      ) : view === 'map' ? (
        <DeviceMap devices={devices} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Firmware</th>
                <th className="px-4 py-3">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {devices.map((device) => (
                <tr key={device.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      to={`/devices/${device.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {device.name}
                    </Link>
                    {isStale(device) && (
                      <span className="ml-2 text-xs text-amber-600">stale heartbeat</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <DeviceStatusBadge status={device.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-500">{device.firmwareVersion ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
