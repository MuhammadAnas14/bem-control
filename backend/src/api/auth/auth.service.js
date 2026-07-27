const bcrypt = require('bcryptjs');
const prisma = require('../../lib/prisma');
const { signUserToken } = require('../../lib/jwt');

const PASSWORD_SALT_ROUNDS = 10;

class HttpError extends Error {
  constructor(status, publicMessage) {
    super(publicMessage);
    this.status = status;
    this.publicMessage = publicMessage;
  }
}

/**
 * Creates a user and, unless the caller is joining an existing org via
 * invite (not implemented in this demo), a brand-new organization owned by
 * them - this is the standard "first user creates the tenant" SaaS signup flow.
 */
async function signup({ email, password, name, organizationName }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new HttpError(409, 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
  const slug = slugify(organizationName);

  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({ data: { email, passwordHash, name } });
    const organization = await tx.organization.create({
      data: { name: organizationName, slug },
    });
    await tx.membership.create({
      data: { userId: createdUser.id, organizationId: organization.id, role: 'OWNER' },
    });
    return createdUser;
  });

  const token = signUserToken(user);
  return { token, user: publicUser(user) };
}

async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new HttpError(401, 'Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new HttpError(401, 'Invalid email or password');
  }

  const token = signUserToken(user);
  return { token, user: publicUser(user) };
}

async function getCurrentUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { memberships: { include: { organization: true } } },
  });
  if (!user) throw new HttpError(404, 'User not found');

  return {
    ...publicUser(user),
    organizations: user.memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
    })),
  };
}

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name };
}

function slugify(name) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base || 'org'}-${suffix}`;
}

module.exports = { signup, login, getCurrentUser, HttpError };
