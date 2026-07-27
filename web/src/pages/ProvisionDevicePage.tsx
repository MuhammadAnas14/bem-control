import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DeviceProvisioningResult } from '@bem-control/api-client';
import { apiClient } from '../lib/apiClient';
import { useAuth } from '../state/AuthContext';

export function ProvisionDevicePage() {
  const { selectedOrgId } = useAuth();
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DeviceProvisioningResult | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedOrgId) return;
    setError(null);
    setSubmitting(true);
    try {
      const created = await apiClient.provisionDevice(selectedOrgId, {
        name,
        latitude: latitude ? Number(latitude) : undefined,
        longitude: longitude ? Number(longitude) : undefined,
      });
      setResult(created);
    } catch {
      setError('Could not provision the device. Check that you have admin access to this org.');
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <strong>Save this now.</strong> The API key below and the QR code are shown only once -
          they can&apos;t be retrieved again after you leave this page.
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
          <img
            src={result.provisioning.qrCodeDataUrl}
            alt="Device provisioning QR code"
            className="mx-auto h-56 w-56"
          />
          <p className="mt-4 text-sm text-gray-500">
            Scan this with the Bem Control mobile app to finish provisioning{' '}
            <strong>{result.device.name}</strong> in the field.
          </p>
        </div>

        <dl className="space-y-2 rounded-lg border border-gray-200 bg-white p-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Device key</dt>
            <dd className="font-mono">{result.device.deviceKey}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">MQTT username</dt>
            <dd className="font-mono">{result.device.mqttUsername}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">API key</dt>
            <dd className="break-all font-mono">{result.provisioning.apiKey}</dd>
          </div>
        </dl>

        <div className="flex gap-3">
          <Link
            to={`/devices/${result.device.id}`}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            View device
          </Link>
          <button
            onClick={() => setResult(null)}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Provision another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Provision a new device</h1>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Device name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Greenhouse Sensor #4"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Latitude (optional)</label>
            <input
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              placeholder="37.7749"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Longitude (optional)</label>
            <input
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              placeholder="-122.4194"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? 'Provisioning...' : 'Provision device'}
        </button>
      </form>
    </div>
  );
}
