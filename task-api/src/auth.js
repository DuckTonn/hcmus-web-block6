/**
 * Middleware xác thực JWT (Authentication)
 *
 * Token được tạo bằng HS256 với SECRET_KEY.
 * Payload tối thiểu: { sub: userId }
 */

const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev-secret-key';

/**
 * Tạo token giả cho test
 * @param {string} userId
 * @param {object} extra  - payload tuỳ thêm (scope, …)
 */
function signToken(userId, extra = {}) {
  return jwt.sign({ sub: userId, ...extra }, SECRET, { expiresIn: '1h' });
}

/**
 * Middleware: đọc Bearer token, xác thực, gán req.user = { id, ...payload }
 * Nếu thiếu hoặc không hợp lệ → 401
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'unauthenticated', message: 'Thiếu token' });
  }

  try {
    const payload = jwt.verify(token, SECRET);
    req.user = { id: payload.sub, ...payload };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'unauthenticated', message: 'Token không hợp lệ hoặc hết hạn' });
  }
}

module.exports = { authenticate, signToken };

