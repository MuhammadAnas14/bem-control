const QRCode = require('qrcode');

/**
 * Encodes everything a fresh ESP32 (or the mobile app, on its behalf) needs
 * to complete field provisioning: which broker to talk to, which org/device
 * it belongs to, and its one-time credentials. Scanned once, at install time.
 */
async function generateProvisioningQrCode({ mqttHost, mqttPort, orgId, deviceKey, apiKey }) {
  const payload = JSON.stringify({
    v: 1,
    mqttHost,
    mqttPort,
    orgId,
    deviceKey,
    apiKey,
  });

  const dataUrl = await QRCode.toDataURL(payload, { errorCorrectionLevel: 'M' });
  return { payload, dataUrl };
}

module.exports = { generateProvisioningQrCode };
