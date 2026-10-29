/**
 * Task API — Express server
 *
 * Biến môi trường:
 *   VERSION=v0|v1|v2|v3|v4   (mặc định: v4)
 *   PORT                      (mặc định: 3000)
 *   JWT_SECRET                (mặc định: dev-secret-key)
 *
 * Chạy: VERSION=v4 node src/server.js
 */

'use strict';

const express   = require('express');
const { cloneDB }    = require('./db');
const { authenticate } = require('./auth');
const services  = require('./taskService');

const VERSION = process.env.VERSION || 'v4';
const service = services[VERSION];
if (!service) {
  console.error(`VERSION không hợp lệ: ${VERSION}. Chọn v0, v1, v2, v3, hoặc v4.`);
  process.exit(1);
}

const app = express();
app.use(express.json());

// ── In-memory DB (reset mỗi lần khởi động) ───────────────────────────────────
let db = cloneDB();

// ── Utility ───────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true, version: VERSION }));

/** Reset DB về trạng thái ban đầu (dùng trong test) */
app.post('/test/reset', (_req, res) => {
  db = cloneDB();
  res.json({ ok: true });
});

// ── Tasks ─────────────────────────────────────────────────────────────────────

/**
 * GET /tasks/:id
 * Đọc task theo ID.
 * Yêu cầu: token hợp lệ.
 * Authorization tùy theo VERSION.
 */
app.get('/tasks/:id', authenticate, (req, res) => {
  const result = service.getTask(db, req.user.id, req.params.id);
  res.status(result.status).json(result.body);
});

/**
 * PATCH /tasks/:id
 * Sửa task (title, status, assignee).
 * Yêu cầu: token hợp lệ.
 */
app.patch('/tasks/:id', authenticate, (req, res) => {
  if (!service.editTask) {
    return res.status(501).json({ error: 'not_implemented' });
  }
  const result = service.editTask(db, req.user.id, req.params.id, req.body);
  res.status(result.status).json(result.body);
});

// ── Projects ──────────────────────────────────────────────────────────────────

/**
 * DELETE /projects/:id
 * Xóa project.
 */
app.delete('/projects/:id', authenticate, (req, res) => {
  if (!service.deleteProject) {
    return res.status(501).json({ error: 'not_implemented' });
  }
  const result = service.deleteProject(db, req.user.id, req.params.id);
  res.status(result.status).json(result.body);
});

/**
 * POST /projects/:id/members
 * Quản lý thành viên project.
 */
app.post('/projects/:id/members', authenticate, (req, res) => {
  if (!service.manageMembers) {
    return res.status(501).json({ error: 'not_implemented' });
  }
  const result = service.manageMembers(db, req.user.id, req.params.id);
  res.status(result.status).json(result.body);
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

function startServer(port = PORT) {
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`Task API [${VERSION}] đang chạy trên http://localhost:${port}`);
      resolve(server);
    });
  });
}

// Chỉ start khi chạy trực tiếp (không phải require từ test)
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };

