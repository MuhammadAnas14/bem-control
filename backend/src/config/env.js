const path = require('path');
const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  MQTT_URL: z.string().default('mqtts://localhost:8883'),
  MQTT_USERNAME: z.string().default('bem-backend'),
  MQTT_PASSWORD: z.string().default(''),
  MQTT_CA_CERT_PATH: z.string().default('./certs/ca.crt'),
  // Host/port devices (and the QR provisioning payload) should connect to -
  // may differ from MQTT_URL if the backend reaches the broker via an
  // internal Docker network hostname but devices reach it over the LAN/WAN.
  MQTT_DEVICE_HOST: z.string().default('localhost'),
  MQTT_DEVICE_PORT: z.coerce.number().default(8883),
  WS_PORT: z.coerce.number().default(4001),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

// In test mode we don't want a hard crash if the full .env isn't populated -
// routes are exercised with a mocked Prisma/MQTT layer, not real infra.
const parsed = schema.safeParse(process.env);

if (!parsed.success && process.env.NODE_ENV !== 'test') {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.success
  ? parsed.data
  : schema.parse({
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test',
      JWT_SECRET: process.env.JWT_SECRET || 'test-secret-test-secret-test-secret',
    });

module.exports = {
  ...env,
  MQTT_CA_CERT_ABSOLUTE_PATH: path.resolve(__dirname, '../../', env.MQTT_CA_CERT_PATH),
};
