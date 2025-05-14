import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  Tag, 
  UserPlus, 
  Code, 
  Mail,
  Shield,
  Bell,
  Server
} from 'lucide-react';
import './Settings.css';
import CodesEditor from './CodesEditor';
import AddNewEmployee from './AddNewEmployee';

const Settings = () => {
  const [activeSection, setActiveSection] = useState('codes-editor');
  
  // Helper to render the active section component
  const renderActiveSection = () => {
    switch (activeSection) {
      case 'codes-editor':
        return <CodesEditor />;
      case 'add-new-employee':
        return <AddNewEmployee />;
      default:
        return <CodesEditor />;
    }
  };

  return (
    <div className="settings-container">
      {/* Settings Header */}
      <div className="settings-header">
        <div className="settings-title">
          <SettingsIcon size={24} className="text-blue-400" />
          <h1>System Settings</h1>
        </div>
        <p className="settings-description">
          Manage system-wide settings, configurations, and user administration
        </p>
      </div>

      <div className="settings-content-wrapper">
        {/* Settings Navigation */}
        <div className="settings-sidebar">
          <div className="settings-nav">
            <button
              className={`settings-nav-item ${activeSection === 'codes-editor' ? 'active' : ''}`}
              onClick={() => setActiveSection('codes-editor')}
            >
              <span className="settings-nav-icon"><Tag size={18} /></span>
              <span className="settings-nav-label">System Codes</span>
            </button>
            
            <button
              className={`settings-nav-item ${activeSection === 'add-new-employee' ? 'active' : ''}`}
              onClick={() => setActiveSection('add-new-employee')}
            >
              <span className="settings-nav-icon"><UserPlus size={18} /></span>
              <span className="settings-nav-label">Add New Employee</span>
            </button>
            
      
            
         
            
            <button className="settings-nav-item">
              <span className="settings-nav-icon"><Bell size={18} /></span>
              <span className="settings-nav-label">Notifications</span>
            </button>
                  </div>

          <div className="settings-sidebar-footer">
            <div className="settings-version">
              <Code size={14} className="text-gray-500" />
              <span>Version 1.2.4</span>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="settings-main-content">
          {renderActiveSection()}
        </div>
      </div>
    </div>
  );
};

export default Settings;