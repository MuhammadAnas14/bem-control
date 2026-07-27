# Architecture

## System overview

```
                         ┌────────────────────┐
                         │   ESP32 devices     │
                         │  (firmware/)        │
                         │  WiFi + MQTTS       │
                         └─────────┬───────────┘
                                   │ MQTTS (8883) / TLS
                                   ▼
                         ┌────────────────────┐
                         │  Mosquitto broker  │
                         │  (docker-compose)  │
                         │  auth: password_file│
                         │  authz: acl.conf    │
                         └─────────┬───────────┘
                                   │ MQTTS (as bem-backend)
                                   ▼
┌───────────────┐        ┌────────────────────┐        ┌──────────────────┐
│  PostgreSQL   │◄──────►│      Backend        │──────►│  WebSocket server │
│  (Prisma)     │        │  Express REST API   │       │  (live telemetry/ │
└───────────────┘        │  MQTT client        │       │   status push)    │
                          │  Expo push sender   │       └─────────┬─────────┘
                          └─────────┬──────────┘                 │
                                    │ HTTPS (REST)                │ WSS
                     ┌──────────────┼──────────────┐              │
                     ▼                              ▼              ▼
            ┌─────────────────┐          ┌──────────────────┐  ┌──────────────────┐
            │  Web dashboard   │          │   Mobile app      │  │ (same clients,   │
            │  React + Vite    │          │  React Native +   │  │  WS connection)  │
            │  (web/)          │          │  Expo (mobile/)   │  └──────────────────┘
            └─────────────────┘          └──────────────────┘
                     ▲                              ▲
                     └──────────────┬───────────────┘
                                    │
                       ┌────────────────────────┐
                       │ packages/api-client     │
                       │ shared TS API client +  │
                       │ types + realtime helper │
                       └────────────────────────┘
```

## Components

- **firmware/** - ESP32 (Arduino framework via PlatformIO). Publishes
  simulated sensor telemetry over MQTTS, subscribes to its own command/config
  topics, reconnects automatically, and can apply an OTA update on command.
- **Mosquitto** - the MQTT broker (external, run via `docker-compose.yml`,
  not embedded in the backend process). Devices and the backend both
  authenticate with per-account username/password over TLS; a per-device ACL
  keeps devices scoped to their own topics.
- **backend/** - Node.js + Express REST API, a Prisma/PostgreSQL data layer,
  an MQTT client that ingests telemetry and fans it out over a WebSocket, and
  an Expo push sender for offline-device alerts. See `docs/api.md`.
- **PostgreSQL** - Organizations, Users, Memberships, Devices, TelemetryReadings,
  Commands, PushTokens (`backend/prisma/schema.prisma`).
- **packages/api-client** - a shared TypeScript API client + type definitions
  + a realtime WebSocket helper, consumed by both frontends so request
  shapes, auth handling, and reconnect logic aren't duplicated.
- **web/** - React + Vite SaaS dashboard: auth, org switcher, device fleet
  list/map, live telemetry charts, provisioning + QR code generation, fleet
  commands.
- **mobile/** - React Native (Expo): the field-technician counterpart - device
  list, live readings, QR-code scan to retrieve a device's provisioning
  credentials, and push notifications for offline alerts.

## Multi-tenancy model

`Organization` is the tenant boundary. A `User` can belong to more than one
organization via `Membership` (with a role: `OWNER` / `ADMIN` / `MEMBER`).
Every device, and everything that hangs off it (telemetry, commands),
belongs to exactly one organization; every authenticated request is scoped
to an `:orgId` and checked against the caller's membership
(`backend/src/middleware/requireOrgMembership.js`).

## Why devices don't talk to Postgres or the REST API directly for telemetry

Telemetry ingestion is MQTT-first: the backend's MQTT client subscribes to
every device's telemetry topic and writes to Postgres itself
(`backend/src/mqtt/handlers.js`). This keeps the device's job simple (publish
a message, don't manage HTTP retries/auth tokens) and lets the backend fan
one incoming message out to many WebSocket subscribers without the device
knowing anything about who's watching. A REST ingestion endpoint exists
(`POST /api/device/telemetry`) purely as a fallback for networks that block
outbound MQTT.

## How this gets to ~40% faster prototype-to-production

The bulk of that time in an ad-hoc setup goes to per-device manual work:
generating credentials, hand-editing broker config, and reconfiguring
firmware for each unit. This project collapses that into:

1. **One provisioning API call** creates the DB record, generates the
   device's MQTT credentials, writes its broker ACL, and returns a QR code -
   no manual broker config per device (`devices.service.js#provisionDevice`).
2. **A single firmware image** works for the whole fleet - a device's
   identity/credentials live in `firmware/include/secrets.h` (populated from
   that QR code), not in per-device firmware forks. The CA cert firmware
   needs is generated once and shared (`scripts/generate-firmware-ca-header.sh`).
3. **Remote config/OTA push** (`CONFIG_UPDATE` / `OTA_TRIGGER` commands) means
   fleet-wide changes ship without re-flashing every device by hand.
