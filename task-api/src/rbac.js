/**
 * Ma trận quyền RBAC (Role-Based Access Control)
 * Dùng chung cho V2, V3, V4.
 *
 * Cấu trúc: MATRIX[role][action] = true | false
 */

const MATRIX = {
  Viewer: { read: true,  edit: false, delete: false, members: false },
  Member: { read: true,  edit: true,  delete: false, members: false },
  Owner:  { read: true,  edit: true,  delete: true,  members: true  },
};

/**
 * Kiểm role trong project có action được không.
 * @param {string} role   - 'Viewer' | 'Member' | 'Owner'
 * @param {string} action - 'read' | 'edit' | 'delete' | 'members'
 * @returns {boolean}
 */
function canByRole(role, action) {
  return !!(MATRIX[role] && MATRIX[role][action]);
}

module.exports = { MATRIX, canByRole };

