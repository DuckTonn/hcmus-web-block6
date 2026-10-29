/**
 * Dữ liệu mẫu cho Task API (không phải dữ liệu thật)
 * Dựa theo dữ liệu trong slide Authorization và access control
 */

const BASE = {
  users: {
    alice: { name: 'Alice', tenant: 'alpha' },
    bob:   { name: 'Bob',   tenant: 'alpha' },
    charlie: { name: 'Charlie', tenant: 'beta' },
    dana:  { name: 'Dana',  tenant: 'alpha', admin: true },
  },
  projects: {
    alpha: {
      name: 'Alpha',
      tenant: 'alpha',
      members: { alice: 'Owner', bob: 'Member' },
    },
    beta: {
      name: 'Beta',
      tenant: 'beta',
      members: { charlie: 'Owner' },
    },
  },
  tasks: {
    A1: { project: 'alpha', title: 'Thiết kế màn hình đăng nhập', assignee: 'bob',   status: 'Open'   },
    A2: { project: 'alpha', title: 'Viết tài liệu API',           assignee: null,    status: 'Open'   },
    B1: { project: 'beta',  title: 'Ngân sách dự án Beta',        assignee: 'charlie', status: 'Open' },
    B2: { project: 'beta',  title: 'Kế hoạch phát hành Beta',     assignee: null,    status: 'Open'   },
  },
};

/** Trả về bản sao sâu của DB để mỗi request không chia sẻ dữ liệu */
function cloneDB() {
  return JSON.parse(JSON.stringify(BASE));
}

module.exports = { BASE, cloneDB };

