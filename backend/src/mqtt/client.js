const fs = require('fs');
const mqtt = require('mqtt');
const env = require('../config/env');

let client = null;

/**
 * Connects the backend to Mosquitto as the `bem-backend` service account,
 * over MQTTS (TLS). This is the same broker ESP32 devices connect to - the
 * backend is just another authenticated client, scoped by ACL (see
 * mosquitto/config/acl.conf.template) to read/write every topic, whereas a
 * device is scoped to only its own.
 */
function connectMqtt() {
  if (client) return client;

  const options = {
    username: env.MQTT_USERNAME,
    password: env.MQTT_PASSWORD,
    protocolVersion: 4,
    reconnectPeriod: 2000,
    clientId: `bem-backend-${Math.random().toString(16).slice(2, 8)}`,
  };

  if (env.MQTT_URL.startsWith('mqtts://')) {
    options.ca = safeReadCa();
    options.rejectUnauthorized = true;
  }

  client = mqtt.connect(env.MQTT_URL, options);

  client.on('connect', () => console.log(`[mqtt] connected to ${env.MQTT_URL}`));
  client.on('reconnect', () => console.log('[mqtt] reconnecting...'));
  client.on('error', (err) => console.error('[mqtt] error:', err.message));

  return client;
}

function safeReadCa() {
  try {
    return fs.readFileSync(env.MQTT_CA_CERT_ABSOLUTE_PATH);
  } catch {
    console.warn(
      `[mqtt] Could not read CA cert at ${env.MQTT_CA_CERT_ABSOLUTE_PATH}. ` +
        'Run `npm run certs:generate` from the repo root first.'
    );
    return undefined;
  }
}

function getMqttClient() {
  if (!client) throw new Error('MQTT client not initialized - call connectMqtt() first');
  return client;
}

module.exports = { connectMqtt, getMqttClient };
