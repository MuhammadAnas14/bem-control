const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const API_KEY_BYTES = 24; // 192 bits, base64url-encoded below
const SALT_ROUNDS = 10;

/** Generates a device API key. Shown to the user once; only its hash is stored. */
function generateApiKey() {
  return crypto.randomBytes(API_KEY_BYTES).toString('base64url');
}

function hashApiKey(plaintextKey) {
  return bcrypt.hash(plaintextKey, SALT_ROUNDS);
}

function verifyApiKey(plaintextKey, hash) {
  return bcrypt.compare(plaintextKey, hash);
}

/** MQTT usernames are namespaced so they can't collide with the backend's own service account. */
function mqttUsernameForDevice(deviceKey) {
  return `device-${deviceKey}`;
}

module.exports = { generateApiKey, hashApiKey, verifyApiKey, mqttUsernameForDevice };
