const request = require('supertest');

jest.mock('../src/lib/prisma', () => ({
  user: { findUnique: jest.fn(), create: jest.fn() },
  organization: { create: jest.fn() },
  membership: { create: jest.fn(), findUnique: jest.fn() },
  $transaction: jest.fn(),
}));

const prisma = require('../src/lib/prisma');
const createApp = require('../src/app');

const app = createApp();

describe('POST /api/auth/signup', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a user + organization and returns a token', async () => {
    const fakeUser = { id: 'user_1', email: 'jane@example.com', name: 'Jane', passwordHash: 'x' };
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (fn) =>
      fn({
        user: { create: jest.fn().mockResolvedValue(fakeUser) },
        organization: { create: jest.fn().mockResolvedValue({ id: 'org_1', name: 'Acme' }) },
        membership: { create: jest.fn().mockResolvedValue({}) },
      })
    );

    const res = await request(app).post('/api/auth/signup').send({
      email: 'jane@example.com',
      password: 'super-secret-1',
      name: 'Jane',
      organizationName: 'Acme',
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toEqual({ id: 'user_1', email: 'jane@example.com', name: 'Jane' });
  });

  it('rejects a duplicate email with 409', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

    const res = await request(app).post('/api/auth/signup').send({
      email: 'jane@example.com',
      password: 'super-secret-1',
      name: 'Jane',
      organizationName: 'Acme',
    });

    expect(res.status).toBe(409);
  });

  it('rejects an invalid payload with 400', async () => {
    const res = await request(app).post('/api/auth/signup').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 for an unknown email', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever1' });

    expect(res.status).toBe(401);
  });

  it('returns 401 for a wrong password', async () => {
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash('correct-password', 10);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      email: 'jane@example.com',
      passwordHash,
      name: 'Jane',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'jane@example.com', password: 'wrong-password' });

    expect(res.status).toBe(401);
  });

  it('returns a token for correct credentials', async () => {
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash('correct-password', 10);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      email: 'jane@example.com',
      passwordHash,
      name: 'Jane',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'jane@example.com', password: 'correct-password' });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });
});
