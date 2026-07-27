import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Command, Device, TelemetryReading } from '@bem-control/api-client';
import { apiClient } from '../lib/apiClient';
import { useAuth } from '../state/AuthContext';
import { useRealtime } from '../hooks/useRealtime';
import { DeviceStatusBadge } from '../components/DeviceStatusBadge';
import { TelemetryChart } from '../components/TelemetryChart';

export function DeviceDetailPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const { selectedOrgId } = useAuth();
  const [device, setDevice] = useState<Device | null>(null);
  const [readings, setReadings] = useState<TelemetryReading[]>([]);
  const [commands, setCommands] = useState<Command[]>([]);
  const [publishInterval, setPublishInterval] = useState('30');
  const [sendingCommand, setSendingCommand] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedOrgId || !deviceId) return;
    apiClient.getDevice(selectedOrgId, deviceId).then(setDevice);
    apiClient.getTelemetryHistory(selectedOrgId, deviceId, { limit: 100 }).then(setReadings);
    apiClient.listCommands(selectedOrgId, deviceId).then(setCommands);
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

  async function sendCommand(type: Command['type'], payload: Record<string, unknown> = {}) {
    if (!selectedOrgId || !deviceId) return;
    setSendingCommand(type);
    try {
      const command = await apiClient.createCommand(selectedOrgId, deviceId, { type, payload });
      setCommands((current) => [command, ...current]);
    } finally {
      setSendingCommand(null);
    }
  }

  async function handleConfigSubmit(e: FormEvent) {
    e.preventDefault();
    await sendCommand('CONFIG_UPDATE', { publishIntervalSeconds: Number(publishInterval) });
  }

  if (!device) return <p className="text-sm text-gray-400">Loading device...</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/devices" className="text-sm text-gray-500 hover:underline">
          &larr; Back to devices
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900">{device.name}</h1>
          <DeviceStatusBadge status={device.status} />
        </div>
        <p className="text-sm text-gray-500">
          Firmware {device.firmwareVersion ?? 'unknown'} · Last seen{' '}
          {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : 'never'}
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">Live telemetry</h2>
        <TelemetryChart readings={readings} />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-medium text-gray-700">Fleet commands</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => sendCommand('REBOOT')}
              disabled={sendingCommand !== null}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Reboot device
            </button>
            <button
              onClick={() =>
                sendCommand('OTA_TRIGGER', {
                  firmwareUrl: 'https://updates.bemcontrol.example/latest.bin',
                  version: 'latest',
                })
              }
              disabled={sendingCommand !== null}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Trigger OTA update
            </button>
          </div>

          <form onSubmit={handleConfigSubmit} className="mt-4 flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Publish interval (seconds)
              </label>
              <input
                type="number"
                min={5}
                value={publishInterval}
                onChange={(e) => setPublishInterval(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={sendingCommand !== null}
              className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Push config
            </button>
          </form>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-medium text-gray-700">Command history</h2>
          {commands.length === 0 ? (
            <p className="text-sm text-gray-400">No commands sent yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {commands.map((c) => (
                <li key={c.id} className="flex items-center justify-between">
                  <span>{c.type}</span>
                  <span className="text-xs text-gray-500">
                    {c.status} · {new Date(c.createdAt).toLocaleTimeString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
