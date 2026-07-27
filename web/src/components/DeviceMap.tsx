import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { Link } from 'react-router-dom';
import type { Device } from '@bem-control/api-client';
import { DeviceStatusBadge } from './DeviceStatusBadge';

// Vite doesn't resolve Leaflet's default marker asset URLs automatically -
// this is the standard workaround (points the icon at the bundled asset URLs).
const defaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

export function DeviceMap({ devices }: { devices: Device[] }) {
  const located = devices.filter(
    (d): d is Device & { latitude: number; longitude: number } =>
      d.latitude != null && d.longitude != null
  );

  if (located.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center rounded-lg border border-dashed border-gray-300 text-sm text-gray-400">
        No devices have a location set yet. Set latitude/longitude when provisioning a device to
        see it here.
      </div>
    );
  }

  const center: [number, number] = [located[0].latitude, located[0].longitude];

  return (
    <div className="h-96 overflow-hidden rounded-lg border border-gray-200">
      <MapContainer center={center} zoom={9} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {located.map((device) => (
          <Marker key={device.id} position={[device.latitude, device.longitude]}>
            <Popup>
              <div className="space-y-1">
                <Link to={`/devices/${device.id}`} className="font-medium text-brand-700 hover:underline">
                  {device.name}
                </Link>
                <div>
                  <DeviceStatusBadge status={device.status} />
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
