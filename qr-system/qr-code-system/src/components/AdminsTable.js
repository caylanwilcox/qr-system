import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Edit2, Trash2 } from 'lucide-react';

// Helper to convert an attendanceRate (0-100) into a letter grade
function getAttendanceGrade(rate) {
  if (rate == null) return 'N/A';
  if (rate >= 95) return 'A';
  if (rate >= 85) return 'B';
  if (rate >= 75) return 'C';
  if (rate >= 65) return 'D';
  return 'F';
}

const AdminsTable = ({ 
  admins, 
  onEdit, 
  onDelete, 
  onRoleChange 
}) => {
  return (
    <div className="quadrant rounded-lg overflow-hidden bg-gray-800 bg-opacity-40">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-800 bg-opacity-40">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Name</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Email</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Location</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Phone</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Attendance</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Role</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700 bg-opacity-20">
            {admins.map((admin) => {
              // Use admin.stats.attendanceRate if available; otherwise, null.
              const attendanceRate = admin.stats?.attendanceRate ?? null;
              const attendanceGrade = getAttendanceGrade(attendanceRate);

              return (
                <tr
                  key={admin.id}
                  className="hover:bg-gray-700 hover:bg-opacity-20 transition-colors"
                >
                  {/* Name (with link to Profile) */}
                  <td className="px-6 py-4 whitespace-nowrap text-white">
                    <Link
                      to={`/super-admin/users/${admin.id}`}
                      className="hover:underline text-blue-400"
                    >
                      {admin.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-300">{admin.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                    {admin.primaryLocation || admin.location}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-300">{admin.phone}</td>
                  {/* Attendance Grade column */}
                  <td className="px-6 py-4 whitespace-nowrap text-gray-300">{attendanceGrade}</td>
                  {/* Role with a <select> to change it */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={admin.role}
                      onChange={(e) => onRoleChange(admin.id, e.target.value)}
                      className="bg-gray-800 bg-opacity-40 text-white rounded px-2 py-1 focus:outline-none"
                      disabled={admin.role === 'super-admin'}
                    >
                      <option value="employee">Employee</option>
                      <option value="admin">Admin</option>
                      <option value="super-admin">Super Admin</option>
                    </select>
                  </td>
                  {/* Actions: Edit or Delete */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-2">
                      <button
                        onClick={() => onEdit(admin)}
                        className="text-blue-400 hover:text-blue-300"
                        disabled={admin.role === 'super-admin'}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => onDelete(admin.id)}
                        className="text-red-400 hover:text-red-300"
                        disabled={admin.role === 'super-admin'}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

AdminsTable.propTypes = {
  admins: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string,
      email: PropTypes.string,
      location: PropTypes.string,
      primaryLocation: PropTypes.string,
      phone: PropTypes.string,
      role: PropTypes.string,
      stats: PropTypes.shape({
        attendanceRate: PropTypes.number
      })
    })
  ).isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onRoleChange: PropTypes.func.isRequired
};

export default AdminsTable;