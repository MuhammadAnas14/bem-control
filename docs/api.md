# REST API reference

Base URL: `http://localhost:4000` in development (`backend/.env` → `PORT`).
All request/response bodies are JSON. Endpoints marked **Auth** require
`Authorization: Bearer <jwt>` (obtained from signup/login). Endpoints marked
**Device** require `X-Device-Key` + `X-Device-Api-Key` headers instead (the
credentials issued at provisioning) - this is the fallback ingestion path for
a device that can't reach MQTT; devices normally use MQTT for everything.

See `packages/api-client/src/client.ts` for the typed client both frontends
use - it's a 1:1 wrapper around everything below.

## Auth - `/api/auth`

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | `/signup` | - | `email, password, name, organizationName` | Creates a user **and** a new organization it owns (`OWNER` role). Returns `{ token, user }`. |
| POST | `/login` | - | `email, password` | Returns `{ token, user }`. |
| GET | `/me` | Auth | - | Returns the current user plus every organization they belong to, with role. |

## Organizations - `/api/orgs`

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| GET | `/` | Auth | - | Organizations the current user belongs to (powers the org switcher). |
| GET | `/:orgId/members` | Auth (member) | - | List members. |
| POST | `/:orgId/members` | Auth (admin) | `email, role` | Adds an *existing* user to the org (simplified stand-in for an email-invite flow). |

## Devices - `/api/orgs/:orgId/devices`

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| GET | `/` | member | - | List devices in the fleet. |
| POST | `/` | admin | `name, latitude?, longitude?` | **Provisions** a device: creates the DB record, generates an API key + MQTT credentials, writes them into the broker's password/ACL files, and returns a QR code. See below. |
| GET | `/:deviceId` | member | - | Device detail. |
| PATCH | `/:deviceId` | admin | `name?, desiredConfig?, latitude?, longitude?` | Updates the device; a `desiredConfig` change is also pushed to the device over its retained MQTT config topic. |
| DELETE | `/:deviceId` | admin | - | Disables the device and revokes its MQTT credential (soft delete - `status: DISABLED`). |
| GET | `/:deviceId/telemetry` | member | query: `metric?, from?, to?, limit?` | Telemetry history, newest first. |
| POST | `/:deviceId/commands` | admin | `type, payload?` | Creates a command and publishes it to the device's MQTT command topic immediately. `type` is one of `CONFIG_UPDATE`, `OTA_TRIGGER`, `REBOOT`, `CUSTOM`. |
| GET | `/:deviceId/commands` | member | - | Command history for the device. |

### Provisioning response shape

```json
{
  "device": { "id": "...", "deviceKey": "...", "mqttUsername": "device-...", "status": "UNPROVISIONED", ... },
  "provisioning": {
    "apiKey": "shown exactly once - store it now",
    "qrCodeDataUrl": "data:image/png;base64,..."
  }
}
```

`provisioning.apiKey` is never retrievable again after this response - only
its bcrypt hash is stored. The QR code encodes the same data so a field
technician can scan it with the mobile app instead of copying it by hand.

## Device gateway - `/api/device` (device-authenticated)

| Method | Path | Notes |
|---|---|---|
| POST | `/telemetry` | Body `{ metrics: { [metric]: number }, ts? }`. REST fallback for ingesting telemetry when MQTT is unreachable. |
| POST | `/commands/:commandId/ack` | Marks a command `ACKED`. |

## Push notifications - `/api/push-tokens`

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | `/` | Auth | `token` | Registers an Expo push token for the current user, so device-offline alerts reach their phone even when the app is backgrounded. |

## Realtime WebSocket

Not REST, but part of the same API surface: connect to
`ws://localhost:4001?token=<jwt>&orgId=<orgId>` (see `backend/src/realtime/wsServer.js`).
The server verifies the JWT and organization membership on connect, then
pushes JSON events for every telemetry/status message the backend ingests
from MQTT for that org:

```json
{ "type": "telemetry", "deviceId": "...", "deviceKey": "...", "metrics": { "temperature": 23.6 }, "recordedAt": "..." }
{ "type": "status", "deviceId": "...", "deviceKey": "...", "status": "ONLINE" | "OFFLINE" }
```

## Health

`GET /health` → `{ "ok": true }` - no auth, used for container/uptime checks.
