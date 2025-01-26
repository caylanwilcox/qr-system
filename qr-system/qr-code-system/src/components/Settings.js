import React, { useState } from 'react';
import { ref, push, set } from 'firebase/database';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { database, auth } from '../services/firebaseConfig';
import { User, AlertCircle } from 'lucide-react';

const Settings = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    position: '',
    department: 'Main Church',
    location: 'Aurora',
    joinDate: '',
    role: 'employee',
    status: 'active'
  });
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 3000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Create auth account with default password
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        'baby123!' // Default password
      );

      const newUserRef = ref(database, `users/${userCredential.user.uid}`);
      await set(newUserRef, {
        ...formData,
        uid: userCredential.user.uid,
        stats: {
          daysPresent: 0,
          daysAbsent: 0,
          daysLate: 0,
          rank: 0,
          attendanceRate: 0,
          onTimeRate: 0
        },
        locationHistory: [
          {
            locationId: formData.location,
            startDate: formData.joinDate
          }
        ],
        service: formData.department,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      });
      
      setFormData({
        name: '',
        email: '',
        phone: '',
        position: '',
        department: 'Main Church',
        location: 'Aurora',
        joinDate: '',
        role: 'employee',
        status: 'active'
      });
      showNotification('Member created successfully');
    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  // Rest of the component remains the same...
  return (
    <div className="p-6 max-w-4xl mx-auto">
      {notification.show && (
        <div className={`notification ${notification.type} fixed top-4 right-4`}>
          {notification.message}
        </div>
      )}
      
      <div className="glass-panel mb-8">
        <div className="section-header flex items-center gap-3">
          <User className="w-5 h-5 text-blue-400" />
          <h2 className="section-title">System Settings</h2>
        </div>
        <div className="p-6">
          <p className="text-white/70 mb-6">
            Manage system settings and create new members
          </p>
        </div>
      </div>

      <div className="glass-panel">
        <div className="section-header">
          <h3 className="section-title">Create New Member</h3>
          <p className="text-sm text-white/70 mt-2">Default password for new members: baby123!</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="form-group">
              <label className="form-label text-white/90">Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="form-input bg-white/5 border-white/10 text-white"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label text-white/90">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="form-input bg-white/5 border-white/10 text-white"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label text-white/90">Phone</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="form-input bg-white/5 border-white/10 text-white"
              />
            </div>

            <div className="form-group">
              <label className="form-label text-white/90">Position</label>
              <input
                type="text"
                name="position"
                value={formData.position}
                onChange={handleInputChange}
                className="form-input bg-white/5 border-white/10 text-white"
              />
            </div>

            <div className="form-group">
              <label className="form-label text-white/90">Service Type</label>
              <select
                name="department"
                value={formData.department}
                onChange={handleInputChange}
                className="form-select bg-white/5 border-white/10 text-white"
              >
                <option value="LIDER">LIDER</option>
                <option value="RSG">RSG</option>
                <option value="COM">COM</option>
                <option value="TESORERO DE GRUPO">TESORERO DE GRUPO</option>
                <option value="PPI">PPI</option>
                <option value="MANAGER DE HACIENDA">MANAGER DE HACIENDA</option>
                <option value="COORDINADOR DE HACIENDA">COORDINADOR DE HACIENDA</option>
                <option value="ATRACCION INTERNA">ATRACCION INTERNA</option>
                <option value="ATRACCION EXTERNA">ATRACCION EXTERNA</option>
                <option value="SECRETARY">SECRETARY</option>
                <option value="LITERATURA">LITERATURA</option>
                <option value="SERVIDOR DE CORO">SERVIDOR DE CORO</option>
                <option value="SERVIDOR DE JAV EN MESA">SERVIDOR DE JAV EN MESA</option>
                <option value="SERVIDOR DE SEGUIMIENTOS">SERVIDOR DE SEGUIMIENTOS</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label text-white/90">Location</label>
              <select
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                className="form-select bg-white/5 border-white/10 text-white"
              >
                <option value="Aurora">Aurora</option>
                <option value="Agua Viva West Chicago">Agua Viva West Chicago</option>
                <option value="Agua Viva Lyons">Agua Viva Lyons</option>
                <option value="Agua Viva Elgin R7">Agua Viva Elgin R7</option>
                <option value="Agua Viva Joliet">Agua Viva Joliet</option>
                <option value="Agua Viva Wheeling">Agua Viva Wheeling</option>
                <option value="Retreat">Retreat</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label text-white/90">Join Date</label>
              <input
                type="date"
                name="joinDate"
                value={formData.joinDate}
                onChange={handleInputChange}
                className="form-input bg-white/5 border-white/10 text-white"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label text-white/90">Role</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                className="form-select bg-white/5 border-white/10 text-white"
              >
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => setFormData({
                name: '',
                email: '',
                phone: '',
                position: '',
                department: 'Main Church',
                location: 'Aurora',
                joinDate: '',
                role: 'employee',
                status: 'active'
              })}
              className="btn btn-secondary"
            >
              Reset
            </button>
            <button type="submit" className="btn btn-primary">
              Create Member
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Settings;