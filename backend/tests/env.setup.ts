// This file MUST have no imports besides none at all — ES module import
// hoisting means any import here would resolve before these assignments
// run if they came from another module that itself imports prisma/app.
// Keeping this file import-free guarantees these are the first env
// values anything in the process sees.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "file:./test.db";
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.JWT_ACCESS_EXPIRES_IN = "15m";
process.env.JWT_REFRESH_EXPIRES_IN = "7d";
process.env.PORT = "4001";
