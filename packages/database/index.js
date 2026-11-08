module.exports = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
module.exports.createDatabase = function createDatabase(connectionString) {
  return new module.exports.PrismaClient({ adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5000 }) });
};
