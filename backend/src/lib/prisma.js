const { PrismaClient } = require('@prisma/client');

// Single shared Prisma client for the process (avoids exhausting the
// Postgres connection pool by instantiating one per request).
const prisma = new PrismaClient();

module.exports = prisma;
