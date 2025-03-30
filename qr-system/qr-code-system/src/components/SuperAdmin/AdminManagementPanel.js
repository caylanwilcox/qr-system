import React, { useState } from 'react';
import { Shield, Users } from 'lucide-react';
import AssignRoles from './AssignRoles';
import AssignUsersToAdmins from './AssignUsersToAdmins';

const AdminManagementPanel = () => {
  const [activeTab, setActiveTab] = useState('roles');
  
  return (
    <div className="admin-management-container">
      {/* Navigation Tabs */}
      <div className="bg-gray-800 bg-opacity-40 rounded-lg mb-6 overflow-hidden">
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setActiveTab('roles')}
            className={`flex items-center gap-2 px-6 py-4 text-lg font-medium transition-all duration-200 ${
              activeTab === 'roles'
                ? 'bg-gray-700 bg-opacity-50 text-white border-b-2 border-purple-500'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700 hover:bg-opacity-30'
            }`}
          >
            <Shield size={20} />
            Manage Admin Roles
          </button>
          
          <button
            onClick={() => setActiveTab('assignments')}
            className={`flex items-center gap-2 px-6 py-4 text-lg font-medium transition-all duration-200 ${
              activeTab === 'assignments'
                ? 'bg-gray-700 bg-opacity-50 text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700 hover:bg-opacity-30'
            }`}
          >
            <Users size={20} />
            Assign Users to Admins
          </button>
        </div>
        
        <div className="p-4 text-gray-300 bg-gray-800 bg-opacity-20">
          {activeTab === 'roles' ? (
            <p>
              This section allows you to assign admin and super-admin roles to users. 
              Super admins have full system access, while regular admins can manage assigned users.
            </p>
          ) : (
            <p>
              This section allows you to assign regular users to administrators.
              Admins will be able to manage and oversee their assigned users.
            </p>
          )}
        </div>
      </div>
      
      {/* Active Component */}
      <div className="component-container">
        {activeTab === 'roles' ? <AssignRoles /> : <AssignUsersToAdmins />}
      </div>
    </div>
  );
};

export default AdminManagementPanel;