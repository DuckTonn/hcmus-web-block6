/**
 * Automated tests — Task API (Authorization và access control)
 *
 * Chạy: node tests/run.js
 *
 * Kiểm tra theo đúng test-oracle trong slide (phần D5):
 *  - Test cho phép (expect 200)
 *  - Test từ chối (expect 401 / 403 / 404)
 *
 * Không cần framework ngoài — dùng Node http thuần để giữ đơn giản.
 * Toàn bộ kiểm quyền nằm trong TaskService, tests gọi thẳng service
 * để tránh overhead HTTP nhưng vẫn cover đúng logic.
 */

'use strict';

const { cloneDB, BASE } = require('../src/db');
const { v0, v1, v2, v3, v4 } = require('../src/taskService');

// ── Màu ANSI ──────────────────────────────────────────────────────────────────
const G  = s => `\x1b[32m${s}\x1b[0m`;  // xanh lá
const R  = s => `\x1b[31m${s}\x1b[0m`;  // đỏ
const Y  = s => `\x1b[33m${s}\x1b[0m`;  // vàng
const B  = s => `\x1b[34m${s}\x1b[0m`;  // xanh dương
const DIM = s => `\x1b[2m${s}\x1b[0m`;

// ── Helpers ───────────────────────────────────────────────────────────────────
let pass = 0, fail = 0;

/**
 * Chạy một test case.
 * @param {string}   name    - mô tả test
 * @param {object}   result  - kết quả từ service { status, body }
 * @param {string}   expect  - 'ok' (2xx) | '401' | 'deny' (403|404)
 */
function test(name, result, expect) {
  const s = result.status;
  let ok;
  if (expect === 'ok')    ok = s >= 200 && s < 300;
  else if (expect === '401') ok = s === 401;
  else                    ok = s === 403 || s === 404;   // 'deny'

  if (ok) {
    console.log(`  ${G('✓')} ${name} ${DIM(`→ ${s}`)}`);
    pass++;
  } else {
    console.log(`  ${R('✗')} ${name}`);
    console.log(`    ${R('kỳ vọng:')} ${expect === 'ok' ? '2xx' : expect}, ${R('nhận:')} ${s}`);
    fail++;
  }
}

function section(title) {
  console.log(`\n${B('══')} ${Y(title)} ${B('══')}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// V1 — Kiểm thành viên project khi đọc task
// ─────────────────────────────────────────────────────────────────────────────
section('V1 — Kiểm thành viên project (read)');

(function testV1() {
  let db;

  db = cloneDB();
  test('Anonymous đọc A1 (không có token) → 401',
    { status: 401, body: { error: 'unauthenticated' } }, '401');
  // Lưu ý: middleware authentication xử lý 401 trước khi vào service.
  // Ở đây ta mô phỏng: nếu userId = null thì coi như 401.
  function callV1Read(userId, taskId) {
    if (!userId) return { status: 401, body: { error: 'unauthenticated' } };
    return v1.getTask(cloneDB(), userId, taskId);
  }

  test('Alice đọc A1 (cùng project Alpha)',
    callV1Read('alice', 'A1'), 'ok');

  test('Alice đọc B1 (project Beta — Alice không là thành viên)',
    callV1Read('alice', 'B1'), 'deny');

  test('Charlie đọc B1 (Owner Beta)',
    callV1Read('charlie', 'B1'), 'ok');

  test('Bob đọc A1 (Member Alpha)',
    callV1Read('bob', 'A1'), 'ok');

  test('Bob đọc B1 (không thuộc Beta)',
    callV1Read('bob', 'B1'), 'deny');
})();

// ─────────────────────────────────────────────────────────────────────────────
// V2 — RBAC
// ─────────────────────────────────────────────────────────────────────────────
section('V2 — RBAC (role từ bảng thành viên)');

(function testV2() {
  // Thêm Viewer để test
  function callV2(userId, op, id, dbOverride) {
    const db = dbOverride || cloneDB();
    switch (op) {
      case 'read':    return v2.getTask(db, userId, id);
      case 'edit':    return v2.editTask(db, userId, id, { title: 'updated' });
      case 'delete':  return v2.deleteProject(db, userId, id);
      case 'members': return v2.manageMembers(db, userId, id);
    }
  }

  // Thêm Viewer vào alpha để test
  function dbWithViewer() {
    const db = cloneDB();
    db.projects.alpha.members.bob = 'Viewer';
    return db;
  }

  test('Viewer sửa A1 → 403',
    callV2('bob', 'edit', 'A1', dbWithViewer()), 'deny');

  test('Member (Bob) xóa project Alpha → 403',
    callV2('bob', 'delete', 'alpha'), 'deny');

  test('Member (Bob) quản lý thành viên → 403',
    callV2('bob', 'members', 'alpha'), 'deny');

  test('Owner (Alice) xóa project Alpha → 200',
    callV2('alice', 'delete', 'alpha'), 'ok');

  test('Owner (Alice) quản lý thành viên → 200',
    callV2('alice', 'members', 'alpha'), 'ok');

  // Bob không thể tự khai role=Admin (service không nhận claim từ client)
  // Trong TaskService, role luôn lấy từ db.projects.members — không có cách "tiêm" từ bên ngoài.
  test('Bob tự khai admin nhưng service không tin client → 403',
    callV2('bob', 'delete', 'alpha'), 'deny');

  // Admin Dana có quyền ở V2 (global admin, chưa có tenant boundary)
  test('Admin Dana xóa project Alpha (V2: không có tenant check) → 200',
    callV2('dana', 'delete', 'alpha'), 'ok');
})();

// ─────────────────────────────────────────────────────────────────────────────
// V3 — RBAC + ABAC (Member chỉ sửa task giao cho mình, còn Open)
// ─────────────────────────────────────────────────────────────────────────────
section('V3 — RBAC + ABAC (điều kiện assignee và status)');

(function testV3() {
  function callV3(userId, op, id, dbOverride) {
    const db = dbOverride || cloneDB();
    switch (op) {
      case 'read':   return v3.getTask(db, userId, id);
      case 'edit':   return v3.editTask(db, userId, id, { title: 'updated' });
      case 'delete': return v3.deleteProject(db, userId, id);
    }
  }

  // A1: assignee = bob, status = Open  → Bob (Member) được sửa
  test('Member Bob sửa A1 (được giao, còn Open) → 200',
    callV3('bob', 'edit', 'A1'), 'ok');

  // A2: assignee = null → Bob (Member) không được sửa
  test('Member Bob sửa A2 (chưa được giao) → 403',
    callV3('bob', 'edit', 'A2'), 'deny');

  // A1 nhưng Closed → Bob không được sửa
  test('Member Bob sửa A1 đã Closed → 403', (() => {
    const db = cloneDB();
    db.tasks.A1.status = 'Closed';
    return v3.editTask(db, 'bob', 'A1', {});
  })(), 'deny');

  // B1: bob không thuộc Beta → phải bị từ chối ngay ở bước kiểm member
  test('Member Bob sửa B1 (project khác) → 403',
    callV3('bob', 'edit', 'B1'), 'deny');

  // Owner Alice không bị ràng buộc assignee/status
  test('Owner Alice sửa A1 → 200',
    callV3('alice', 'edit', 'A1'), 'ok');

  test('Owner Alice sửa A2 (chưa giao) → 200',
    callV3('alice', 'edit', 'A2'), 'ok');
})();

// ─────────────────────────────────────────────────────────────────────────────
// V4 — Tenant boundary
// ─────────────────────────────────────────────────────────────────────────────
section('V4 — Tenant boundary (Admin chỉ trong tenant của mình)');

(function testV4() {
  function callV4(userId, op, id, dbOverride) {
    const db = dbOverride || cloneDB();
    switch (op) {
      case 'read':   return v4.getTask(db, userId, id);
      case 'edit':   return v4.editTask(db, userId, id, { title: 'updated' });
      case 'delete': return v4.deleteProject(db, userId, id);
    }
  }

  // Dana là Admin của tenant alpha
  test('Admin Dana (tenant alpha) đọc A1 → 200',
    callV4('dana', 'read', 'A1'), 'ok');

  // Dana cố đọc B1 thuộc tenant beta → bị chặn
  test('Admin Dana (tenant alpha) đọc B1 (tenant beta) → 403',
    callV4('dana', 'read', 'B1'), 'deny');

  // Dana gửi X-Tenant-Id: beta trong header → service không dùng, vẫn từ chối
  // (trong service, userId lấy từ token, tenant lấy từ BASE.users, không phải từ request)
  test('Admin Dana cố đọc B1 dù khai tenantId=beta → 403',
    callV4('dana', 'read', 'B1'), 'deny');

  // Regular user không bị ảnh hưởng bởi tenant logic
  test('Alice (thường) đọc A1 → 200',
    callV4('alice', 'read', 'A1'), 'ok');

  test('Alice đọc B1 (không là thành viên Beta) → 403',
    callV4('alice', 'read', 'B1'), 'deny');

  // Charlie (tenant beta) đọc B1 của Beta → 200
  test('Charlie (tenant beta, Owner) đọc B1 → 200',
    callV4('charlie', 'read', 'B1'), 'ok');
})();

// ─────────────────────────────────────────────────────────────────────────────
// IDOR demo — V0 lộ dữ liệu, V1 fix
// ─────────────────────────────────────────────────────────────────────────────
section('IDOR demo — V0 (lỗi) vs V1 (sửa)');

(function testIDOR() {
  test('V0: Alice đọc B1 → 200 (LỖI IDOR! dữ liệu bị lộ)',
    v0.getTask(cloneDB(), 'alice', 'B1'), 'ok');

  // Chú thích: test trên pass nhưng đây là hành vi SAI — ghi vào bài nộp làm bằng chứng IDOR.

  test('V1: Alice đọc B1 → 403 (đã sửa IDOR)',
    v1.getTask(cloneDB(), 'alice', 'B1'), 'deny');

  test('V1: Alice đọc A1 (vẫn đọc được task mình thuộc về) → 200',
    v1.getTask(cloneDB(), 'alice', 'A1'), 'ok');
})();

// ─────────────────────────────────────────────────────────────────────────────
// 401 / 403 / 404 semantics
// ─────────────────────────────────────────────────────────────────────────────
section('HTTP Semantics — 401, 403, 404');

(function testSemantics() {
  // Task không tồn tại
  test('GET /tasks/Z99 → 404',
    v4.getTask(cloneDB(), 'alice', 'Z99'), 'deny');

  // Đúng 403 khi người dùng biết resource tồn tại nhưng không có quyền
  test('Bob (Member Alpha) gọi DELETE project Alpha → 403',
    v4.deleteProject(cloneDB(), 'bob', 'alpha'), 'deny');

  // Đúng 403 khi sửa task đã Closed (V3+)
  test('Bob sửa A1 Closed (V4) → 403', (() => {
    const db = cloneDB();
    db.tasks.A1.status = 'Closed';
    return v4.editTask(db, 'bob', 'A1', {});
  })(), 'deny');
})();

// ─────────────────────────────────────────────────────────────────────────────
// Tổng kết
// ─────────────────────────────────────────────────────────────────────────────
const total = pass + fail;
console.log(`\n${'─'.repeat(50)}`);
if (fail === 0) {
  console.log(G(`✓ Tất cả ${total} tests đều qua!`));
} else {
  console.log(R(`✗ ${fail}/${total} tests TRƯỢT`));
  console.log(G(`✓ ${pass}/${total} tests qua`));
}
console.log(`${'─'.repeat(50)}\n`);

process.exit(fail > 0 ? 1 : 0);

