# Task API — Bài thực hành Authorization & Access Control (Block 6)

## Cấu trúc dự án

```
task-api/
├── src/
│   ├── db.js           # Dữ liệu mẫu (users, projects, tasks)
│   ├── auth.js         # Middleware xác thực JWT
│   ├── rbac.js         # Ma trận quyền RBAC
│   ├── taskService.js  # Business layer: v0, v1, v2, v3, v4
│   └── server.js       # Express server
└── tests/
    ├── run.js           # Test runner (31 test cases)
    └── generate-tokens.js
```

## Dữ liệu mẫu

| User    | Tenant | Role                  |
|---------|--------|-----------------------|
| alice   | alpha  | Owner của Alpha       |
| bob     | alpha  | Member của Alpha      |
| charlie | beta   | Owner của Beta        |
| dana    | alpha  | Admin (global → V2) / Admin Alpha (V4) |

| Task | Project | Assignee | Status |
|------|---------|----------|--------|
| A1   | Alpha   | bob      | Open   |
| A2   | Alpha   | (chưa)   | Open   |
| B1   | Beta    | charlie  | Open   |
| B2   | Beta    | (chưa)   | Open   |

## Các phiên bản

### V0 — Starter (IDOR lỗ hổng)
Chỉ kiểm token. Alice có thể đọc B1 (task của Beta) dù không thuộc project Beta.

### V1 — Kiểm thành viên project
- `GET /tasks/:id`: kiểm `member(project)` → fix IDOR cho thao tác đọc.
- Thao tác ghi (PATCH, DELETE) chưa được bảo vệ.

### V2 — RBAC
- Role lấy từ `db.projects[pid].members[userId]` (không tin client tự khai).
- Ma trận: `Viewer → read; Member → read+edit; Owner → all`.
- Admin global = Owner mọi project (chưa có tenant boundary).

### V3 — RBAC + ABAC
- Giữ nguyên V2.
- **Thêm**: Member chỉ sửa task được giao cho mình (`assignee == userId`) VÀ task còn Open (`status == 'Open'`).

### V4 — Tenant Boundary
- **Thêm**: Admin chỉ là Owner trong tenant của chính họ.
- `tenantId` lấy từ `BASE.users[userId].tenant` — không đọc từ header/body client.

## Chạy server

```bash
# Cài đặt
npm install

# Chạy V4 (phiên bản đầy đủ)
npm start           # VERSION mặc định = v4

# Hoặc chạy từng phiên bản
npm run start:v0    # Starter (có lỗi IDOR)
npm run start:v1
npm run start:v2
npm run start:v3
npm run start:v4
```

## Chạy tests

```bash
npm test
# → 31 tests: V1, V2, V3, V4, IDOR demo, HTTP semantics
```

## Test với curl

```bash
# Tạo token
npm run tokens

# Đọc task A1 với token alice
curl -H "Authorization: Bearer <token-alice>" http://localhost:3000/tasks/A1

# Thử IDOR: Alice đọc B1 (phải 403 ở V1+, nhưng 200 ở V0!)
curl -H "Authorization: Bearer <token-alice>" http://localhost:3000/tasks/B1

# Bob xóa project Alpha (phải 403)
curl -X DELETE -H "Authorization: Bearer <token-bob>" http://localhost:3000/projects/alpha

# Alice xóa project Alpha (phải 200 ở V2+)
curl -X DELETE -H "Authorization: Bearer <token-alice>" http://localhost:3000/projects/alpha
```

## Nguyên tắc bảo mật áp dụng

| Nguyên tắc | Được thể hiện ở |
|---|---|
| **Deny by default** | Service trả 403 nếu không có rule nào cho phép |
| **Authentication → Scope → Object-level** | Middleware `authenticate` → RBAC → ABAC |
| **Không tin client** | `tenantId`, `role`, `userId` luôn lấy từ DB/token, không từ body/header |
| **PEP ở business layer** | `taskService.js` là PEP/PDP duy nhất cho mọi entry point |
| **Test cho phép + test từ chối** | 31 tests bao gồm cả hai loại |
| **IDOR/BOLA fix** | V1 kiểm `member(project)` trước khi trả dữ liệu |
| **Tenant isolation** | V4 kiểm `user.tenant === project.tenant` |

