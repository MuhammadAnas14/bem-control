// Mirrors backend/prisma/schema.prisma. Kept hand-in-sync rather than
// generated, since the backend is JS (no compile-time type export) - see
// docs/api.md for the source of truth if the two ever drift.

export type MembershipRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export type DeviceStatus = 'UNPROVISIONED' | 'ONLINE' | 'OFFLINE' | 'DISABLED';

export type CommandType = 'CONFIG_UPDATE' | 'OTA_TRIGGER' | 'REBOOT' | 'CUSTOM';

export type CommandStatus = 'PENDING' | 'SENT' | 'ACKED' | 'FAILED';

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface OrganizationMembership {
  id: string;
  name: string;
  slug: string;
  role: MembershipRole;
}

export interface CurrentUser extends User {
  organizations: OrganizationMembership[];
}

export interface Device {
  id: string;
  name: string;
  deviceKey: string;
  mqttUsername: string;
  status: DeviceStatus;
  firmwareVersion: string | null;
  desiredConfig: Record<string, unknown>;
  latitude: number | null;
  longitude: number | null;
  lastSeenAt: string | null;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceProvisioningResult {
  device: Device;
  provisioning: {
    /** Shown to the user exactly once - never retrievable again after this response. */
    apiKey: string;
    qrCodeDataUrl: string;
  };
}

export interface TelemetryReading {
  id: string;
  deviceId: string;
  metric: string;
  value: number;
  unit: string | null;
  recordedAt: string;
}

export interface Command {
  id: string;
  deviceId: string;
  type: CommandType;
  payload: Record<string, unknown>;
  status: CommandStatus;
  createdByUserId: string | null;
  createdAt: string;
  sentAt: string | null;
  ackedAt: string | null;
}

export interface AuthResponse {
  token: string;
  user: User;
}

/** Messages pushed over the realtime WebSocket (see realtime.ts). */
export type RealtimeEvent =
  | {
      type: 'telemetry';
      deviceId: string;
      deviceKey: string;
      metrics: Record<string, number>;
      recordedAt: string;
    }
  | { type: 'status'; deviceId: string; deviceKey: string; status: DeviceStatus };
