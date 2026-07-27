const request = require('supertest');

jest.mock('../src/lib/prisma', () => ({
  membership: { findUnique: jest.fn() },
  device: { create: jest.fn(), update: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
}));

jest.mock('../src/services/mqttProvisioning.service', () => ({
  addDeviceCredential: jest.fn().mockResolvedValue(undefined),
  revokeDeviceCredential: jest.fn().mockResolvedValue(undefined),
  appendDeviceAcl: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/mqtt/handlers', () => ({
  publishCommand: jest.fn(),
  publishConfig: jest.fn(),
  registerMqttHandlers: jest.fn(),
}));

const prisma = require('../src/lib/prisma');
const mqttProvisioning = require('../src/services/mqttProvisioning.service');
const { signUserToken } = require('../src/lib/jwt');
const createApp = require('../src/app');

const app = createApp();
const ORG_ID = 'org_1';
const token = signUserToken({ id: 'user_1', email: 'jane@example.com' });

describe('devices routes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects requests without a token', async () => {
    const res = await request(app).get(`/api/orgs/${ORG_ID}/devices`);
    expect(res.status).toBe(401);
  });

  it('rejects users who are not members of the org', async () => {
    prisma.membership.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get(`/api/orgs/${ORG_ID}/devices`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('lists devices for a member', async () => {
    prisma.membership.findUnique.mockResolvedValue({ role: 'MEMBER' });
    prisma.device.findMany.mockResolvedValue([{ id: 'device_1', name: 'Sensor A' }]);

    const res = await request(app)
      .get(`/api/orgs/${ORG_ID}/devices`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('requires ADMIN role to provision a new device', async () => {
    prisma.membership.findUnique.mockResolvedValue({ role: 'MEMBER' });

    const res = await request(app)
      .post(`/api/orgs/${ORG_ID}/devices`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Greenhouse Sensor' });

    expect(res.status).toBe(403);
    expect(prisma.device.create).not.toHaveBeenCalled();
  });

  it('provisions a device and returns a one-time API key + QR code', async () => {
    prisma.membership.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prisma.device.create.mockResolvedValue({
      id: 'device_1',
      deviceKey: 'device-key-abc',
      organizationId: ORG_ID,
    });
    prisma.device.update.mockResolvedValue({
      id: 'device_1',
      deviceKey: 'device-key-abc',
      mqttUsername: 'device-device-key-abc',
      status: 'UNPROVISIONED',
    });

    const res = await request(app)
      .post(`/api/orgs/${ORG_ID}/devices`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Greenhouse Sensor' });

    expect(res.status).toBe(201);
    expect(res.body.device.mqttUsername).toBe('device-device-key-abc');
    expect(res.body.provisioning.apiKey).toEqual(expect.any(String));
    expect(res.body.provisioning.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(mqttProvisioning.addDeviceCredential).toHaveBeenCalledWith(
      'device-device-key-abc',
      expect.any(String)
    );
    expect(mqttProvisioning.appendDeviceAcl).toHaveBeenCalledWith(
      'device-device-key-abc',
      'device-key-abc'
    );
  });

  it('rejects provisioning with an invalid body', async () => {
    prisma.membership.findUnique.mockResolvedValue({ role: 'ADMIN' });

    const res = await request(app)
      .post(`/api/orgs/${ORG_ID}/devices`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });
});
