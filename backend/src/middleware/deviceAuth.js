const prisma = require('../lib/prisma');
const { verifyApiKey } = require('../lib/deviceCredentials');

/**
 * Authenticates an ESP32 device on device-facing REST endpoints (the MQTT
 * path authenticates separately, at the broker, via mqttUsername/password).
 * Devices identify themselves with their public deviceKey plus the secret
 * API key issued at provisioning time.
 */
async function deviceAuth(req, res, next) {
  const deviceKey = req.headers['x-device-key'];
  const apiKey = req.headers['x-device-api-key'];

  if (!deviceKey || !apiKey) {
    return res.status(401).json({ error: 'Missing X-Device-Key / X-Device-Api-Key headers' });
  }

  const device = await prisma.device.findUnique({ where: { deviceKey } });
  if (!device || device.status === 'DISABLED') {
    return res.status(401).json({ error: 'Unknown or disabled device' });
  }

  const valid = await verifyApiKey(apiKey, device.apiKeyHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid device credentials' });
  }

  req.device = device;
  next();
}

module.exports = deviceAuth;
