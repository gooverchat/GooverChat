const { jwtVerify } = require('jose');

const DEV_ACCESS_SECRET = 'dev-access-secret-min-32-characters-long';
if (process.env.NODE_ENV === 'production') {
  const access = process.env.JWT_ACCESS_SECRET;
  if (!access || access === DEV_ACCESS_SECRET) {
    throw new Error('Production requires JWT_ACCESS_SECRET to be set and different from dev default.');
  }
}

const ACCESS_SECRET = new TextEncoder().encode(
  process.env.JWT_ACCESS_SECRET || DEV_ACCESS_SECRET
);

async function verifyAccessToken(token) {
  try {
    const { payload } = await jwtVerify(token, ACCESS_SECRET);
    if (payload.sub && payload.email) {
      return { sub: payload.sub, email: String(payload.email) };
    }
    return null;
  } catch {
    return null;
  }
}

module.exports = { verifyAccessToken };
