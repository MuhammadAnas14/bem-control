const request = require('supertest');

jest.mock('../src/lib/prisma', () => ({
  pushToken: { upsert: jest.fn() },
}));

const prisma = require('../src/lib/prisma');
const { signUserToken } = require('../src/lib/jwt');
const createApp = require('../src/app');

const app = createApp();
const token = signUserToken({ id: 'user_1', email: 'jane@example.com' });

describe('POST /api/push-tokens', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).post('/api/push-tokens').send({ token: 'ExponentPushToken[abc]' });
    expect(res.status).toBe(401);
  });

  it('registers a push token for the current user', async () => {
    prisma.pushToken.upsert.mockResolvedValue({ id: 'pt_1' });

    const res = await request(app)
      .post('/api/push-tokens')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'ExponentPushToken[abc]' });

    expect(res.status).toBe(201);
    expect(prisma.pushToken.upsert).toHaveBeenCalledWith({
      where: { token: 'ExponentPushToken[abc]' },
      update: { userId: 'user_1' },
      create: { userId: 'user_1', token: 'ExponentPushToken[abc]' },
    });
  });

  it('rejects an empty token', async () => {
    const res = await request(app)
      .post('/api/push-tokens')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: '' });
    expect(res.status).toBe(400);
  });
});
