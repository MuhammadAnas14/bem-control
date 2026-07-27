const prisma = require('../lib/prisma');
const { getMqttClient } = require('./client');
const {
  TELEMETRY_WILDCARD,
  STATUS_WILDCARD,
  parseDeviceTopic,
  commandsTopic,
  configTopic,
} = require('./topics');
const { broadcastToOrg } = require('../realtime/wsServer');
const { notifyOrganization } = require('../services/pushNotifications.service');

// Reserved keys in a telemetry payload that are metadata, not sensor metrics.
const NON_METRIC_KEYS = new Set(['ts', 'recordedAt', 'firmwareVersion']);

/** Subscribes to every device's telemetry/status topics and wires up persistence + realtime fan-out. */
function registerMqttHandlers() {
  const client = getMqttClient();

  client.on('connect', () => {
    client.subscribe([TELEMETRY_WILDCARD, STATUS_WILDCARD], { qos: 1 }, (err) => {
      if (err) console.error('[mqtt] subscribe failed:', err.message);
    });
  });

  client.on('message', async (topic, payloadBuffer) => {
    const parsed = parseDeviceTopic(topic);
    if (!parsed) return;

    try {
      if (parsed.suffix === 'telemetry') {
        await handleTelemetry(parsed, payloadBuffer);
      } else if (parsed.suffix === 'status') {
        await handleStatus(parsed, payloadBuffer);
      }
    } catch (err) {
      console.error(`[mqtt] failed handling ${topic}:`, err.message);
    }
  });
}

async function handleTelemetry({ orgId, deviceKey }, payloadBuffer) {
  const device = await prisma.device.findFirst({ where: { deviceKey, organizationId: orgId } });
  if (!device || device.status === 'DISABLED') return; // ignore unknown/revoked devices

  const payload = JSON.parse(payloadBuffer.toString());
  const recordedAt = payload.ts ? new Date(payload.ts) : new Date();

  const metricEntries = Object.entries(payload).filter(
    ([key, value]) => !NON_METRIC_KEYS.has(key) && typeof value === 'number'
  );

  await prisma.$transaction([
    ...metricEntries.map(([metric, value]) =>
      prisma.telemetryReading.create({
        data: { deviceId: device.id, metric, value, recordedAt },
      })
    ),
    prisma.device.update({
      where: { id: device.id },
      data: {
        status: 'ONLINE',
        lastSeenAt: new Date(),
        ...(payload.firmwareVersion ? { firmwareVersion: payload.firmwareVersion } : {}),
      },
    }),
  ]);

  broadcastToOrg(orgId, {
    type: 'telemetry',
    deviceId: device.id,
    deviceKey,
    metrics: Object.fromEntries(metricEntries),
    recordedAt,
  });
}

async function handleStatus({ orgId, deviceKey }, payloadBuffer) {
  const device = await prisma.device.findFirst({ where: { deviceKey, organizationId: orgId } });
  if (!device) return;

  const statusText = payloadBuffer.toString().trim().toLowerCase();
  const status = statusText === 'online' ? 'ONLINE' : 'OFFLINE';

  await prisma.device.update({
    where: { id: device.id },
    data: { status, lastSeenAt: new Date() },
  });

  broadcastToOrg(orgId, { type: 'status', deviceId: device.id, deviceKey, status });

  // Only alert on an actual online -> offline transition, not on every
  // retained/duplicate message - otherwise a flapping connection would spam
  // every org member's phone.
  if (status === 'OFFLINE' && device.status === 'ONLINE') {
    notifyOrganization(orgId, {
      title: 'Device offline',
      body: `${device.name} has gone offline.`,
      data: { deviceId: device.id },
    }).catch((err) => console.error('[mqtt] push notification failed:', err.message));
  }
}

/** Publishes a command (config push, OTA trigger, reboot, ...) to a device's command topic. */
function publishCommand(orgId, deviceKey, command) {
  const client = getMqttClient();
  client.publish(commandsTopic(orgId, deviceKey), JSON.stringify(command), { qos: 1 });
}

/** Publishes the device's desired config as a retained message - a device that reconnects gets it immediately. */
function publishConfig(orgId, deviceKey, desiredConfig) {
  const client = getMqttClient();
  client.publish(configTopic(orgId, deviceKey), JSON.stringify(desiredConfig), {
    qos: 1,
    retain: true,
  });
}

module.exports = { registerMqttHandlers, publishCommand, publishConfig };
