const prisma = require('../lib/prisma');
const env = require('../config/env');
const {
  generateApiKey,
  hashApiKey,
  mqttUsernameForDevice,
} = require('../lib/deviceCredentials');
const mqttProvisioning = require('./mqttProvisioning.service');
const { generateProvisioningQrCode } = require('./qrCode.service');
const { publishConfig } = require('../mqtt/handlers');

class HttpError extends Error {
  constructor(status, publicMessage) {
    super(publicMessage);
    this.status = status;
    this.publicMessage = publicMessage;
  }
}

async function listDevices(organizationId) {
  return prisma.device.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  });
}

async function getDeviceOrThrow(organizationId, deviceId) {
  const device = await prisma.device.findFirst({ where: { id: deviceId, organizationId } });
  if (!device) throw new HttpError(404, 'Device not found');
  return device;
}

/**
 * The whole point of this flow (and the "standardized provisioning" behind
 * the 40% prototype-to-production time reduction): one API call produces a
 * DB record, MQTT broker credentials + ACL scoping, and a QR code the field
 * technician scans with the mobile app - no manual broker config per device.
 */
async function provisionDevice(organizationId, { name, latitude, longitude }) {
  const device = await prisma.device.create({
    data: {
      name,
      organizationId,
      latitude,
      longitude,
      mqttUsername: 'pending', // placeholder, replaced below once we have deviceKey
      apiKeyHash: 'pending',
    },
  });

  const plaintextApiKey = generateApiKey();
  const apiKeyHash = await hashApiKey(plaintextApiKey);
  const mqttUsername = mqttUsernameForDevice(device.deviceKey);

  const updated = await prisma.device.update({
    where: { id: device.id },
    data: { mqttUsername, apiKeyHash },
  });

  await mqttProvisioning.addDeviceCredential(mqttUsername, plaintextApiKey);
  await mqttProvisioning.appendDeviceAcl(mqttUsername, device.deviceKey);

  const { dataUrl: qrCodeDataUrl } = await generateProvisioningQrCode({
    mqttHost: env.MQTT_DEVICE_HOST,
    mqttPort: env.MQTT_DEVICE_PORT,
    orgId: organizationId,
    deviceKey: device.deviceKey,
    apiKey: plaintextApiKey,
  });

  return {
    device: updated,
    // Secret material returned exactly once - the caller (web/mobile) must
    // display it to the user now, since it can never be retrieved again.
    provisioning: { apiKey: plaintextApiKey, qrCodeDataUrl },
  };
}

async function updateDevice(organizationId, deviceId, { name, desiredConfig, latitude, longitude }) {
  const existing = await getDeviceOrThrow(organizationId, deviceId);
  const updated = await prisma.device.update({
    where: { id: deviceId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(desiredConfig !== undefined ? { desiredConfig } : {}),
      ...(latitude !== undefined ? { latitude } : {}),
      ...(longitude !== undefined ? { longitude } : {}),
    },
  });

  // Push the new config straight to the device over its retained config
  // topic - this is the "config-push" half of the OTA/fleet-update flow.
  if (desiredConfig !== undefined) {
    publishConfig(organizationId, existing.deviceKey, desiredConfig);
  }

  return updated;
}

async function disableDevice(organizationId, deviceId) {
  const device = await getDeviceOrThrow(organizationId, deviceId);
  await mqttProvisioning.revokeDeviceCredential(device.mqttUsername);
  return prisma.device.update({ where: { id: deviceId }, data: { status: 'DISABLED' } });
}

async function markSeen(deviceId, { firmwareVersion } = {}) {
  return prisma.device.update({
    where: { id: deviceId },
    data: {
      status: 'ONLINE',
      lastSeenAt: new Date(),
      ...(firmwareVersion ? { firmwareVersion } : {}),
    },
  });
}

module.exports = {
  listDevices,
  getDeviceOrThrow,
  provisionDevice,
  updateDevice,
  disableDevice,
  markSeen,
  HttpError,
};
