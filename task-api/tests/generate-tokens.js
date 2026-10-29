/**
 * Tạo JWT token mẫu cho từng user để dùng với curl hoặc Postman
 *
 * Chạy: node tests/generate-tokens.js
 */

'use strict';

const { signToken } = require('../src/auth');

const users = ['alice', 'bob', 'charlie', 'dana'];

console.log('=== JWT Tokens (dùng để test với curl / Postman) ===\n');
users.forEach(u => {
  console.log(`${u.padEnd(10)}: ${signToken(u)}`);
});
console.log('\nDùng:\n  curl -H "Authorization: Bearer <token>" http://localhost:3000/tasks/A1\n');

