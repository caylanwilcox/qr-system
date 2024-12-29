import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { database } from "../services/firebaseConfig";
import { ref, get, update } from "firebase/database";
import { auth } from "../services/firebaseConfig";
import { updateEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import QRCode from "qrcode.react";
import { jsPDF } from "jspdf";
import CollapsibleSection from './CollapsibleSection';
import Calendar from './Calendar';
import './EmployeeProfile.css';

const EmployeeProfile = () => {
  const { employeeId } = useParams();

  // Core states
  const [employeeDetails, setEmployeeDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [updateStatus, setUpdateStatus] = useState({ type: "", message: "" });

  // Form states
  const [formData, setFormData] = useState({
    position: "",
    rank: "1",
    email: "",
    phone: "",
    department: "",
    supervisor: "",
  });

  // Schedule and attendance states
  const [scheduledDates, setScheduledDates] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);

  // Account update states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [updatingAccount, setUpdatingAccount] = useState(false);

  // Stats state
  const [stats, setStats] = useState({
    totalHours: 0,
    avgHoursPerDay: 0,
    attendanceRate: 0,
    punctualityRate: 0
  });

  const clearUpdateStatus = () => {
    setTimeout(() => setUpdateStatus({ type: "", message: "" }), 5000);
  };

  const calculateStats = (records) => {
    const totalRecords = records.length;
    if (totalRecords === 0) return {
      totalHours: 0,
      avgHoursPerDay: 0,
      attendanceRate: 0,
      punctualityRate: 0
    };

    let totalHours = 0;
    let onTimeCount = 0;
    let attendedCount = 0;

    records.forEach(record => {
      if (record.clockInTime && record.clockOutTime) {
        const clockIn = new Date(`${record.date} ${record.clockInTime}`);
        const clockOut = new Date(`${record.date} ${record.clockOutTime}`);
        const hours = (clockOut - clockIn) / (1000 * 60 * 60);
        totalHours += hours;
        attendedCount++;

        const scheduledStart = new Date(`${record.date} 09:00:00`);
        scheduledStart.setMinutes(scheduledStart.getMinutes() + 15);
        if (clockIn <= scheduledStart) {
          onTimeCount++;
        }
      }
    });

    return {
      totalHours: totalHours.toFixed(1),
      avgHoursPerDay: (totalHours / totalRecords).toFixed(1),
      attendanceRate: ((attendedCount / totalRecords) * 100).toFixed(1),
      punctualityRate: ((onTimeCount / attendedCount) * 100).toFixed(1)
    };
  };

  const formatAttendanceRecords = useCallback((clockInTimes = {}, clockOutTimes = {}) => {
    const records = [];
    for (const timestamp in clockInTimes) {
      const date = new Date(parseInt(timestamp) * 1000);
      const dateStr = date.toLocaleDateString();
      const clockInTime = clockInTimes[timestamp] ? 
        new Date(clockInTimes[timestamp] * 1000).toLocaleTimeString() : null;
      const clockOutTime = clockOutTimes[timestamp] ? 
        new Date(clockOutTimes[timestamp] * 1000).toLocaleTimeString() : null;
      
      records.push({
        timestamp: parseInt(timestamp),
        date: dateStr,
        clockInTime,
        clockOutTime
      });
    }
    return records.sort((a, b) => b.timestamp - a.timestamp);
  }, []);

  const fetchEmployeeDetails = useCallback(async () => {
    setError(null);
    try {
      const employeeRef = ref(database, `attendance/Agua Viva Elgin R7/${employeeId}`);
      const snapshot = await get(employeeRef);

      if (snapshot.exists()) {
        const data = snapshot.val();
        const today = new Date().setHours(0, 0, 0, 0);

        const formattedDates = (data.assignedDates || [])
          .filter(dateStr => new Date(dateStr).setHours(0, 0, 0, 0) >= today)
          .map(dateStr => ({
            date: dateStr,
            time: "09:00",
            status: 'scheduled'
          }))
          .sort((a, b) => new Date(a.date) - new Date(b.date));

        const records = formatAttendanceRecords(data.clockInTimes, data.clockOutTimes);
        
        setEmployeeDetails(data);
        setScheduledDates(formattedDates);
        setAttendanceRecords(records);
        setStats(calculateStats(records));
        
        setFormData({
          position: data.position || "",
          rank: data.rank || "1",
          email: data.email || "",
          phone: data.phone || "",
          department: data.department || "",
          supervisor: data.supervisor || "",
        });

        if (formattedDates.length !== (data.assignedDates || []).length) {
          const updatedDates = formattedDates.map(d => d.date);
          await update(employeeRef, { assignedDates: updatedDates });
        }
      } else {
        setError("No data available for this employee.");
      }
    } catch (error) {
      console.error("Error fetching employee details:", error);
      setError("An error occurred while fetching employee details.");
    } finally {
      setLoading(false);
    }
  }, [employeeId, formatAttendanceRecords]);

  useEffect(() => {
    fetchEmployeeDetails();
  }, [fetchEmployeeDetails]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const employeeRef = ref(database, `attendance/Agua Viva Elgin R7/${employeeId}`);
      await update(employeeRef, formData);
      
      setEmployeeDetails(prev => ({
        ...prev,
        ...formData
      }));
      
      setUpdateStatus({ type: "success", message: "Profile updated successfully." });
      setEditMode(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      setUpdateStatus({ type: "error", message: "Failed to update profile." });
    } finally {
      setIsSaving(false);
      clearUpdateStatus();
    }
  };

  const handleScheduleUpdate = async (newSchedule) => {
    if (!newSchedule.date || !newSchedule.time) {
      setUpdateStatus({ type: "error", message: "Please select both date and time." });
      clearUpdateStatus();
      return;
    }

    const scheduleDate = new Date(`${newSchedule.date}T${newSchedule.time}`);
    if (scheduleDate < new Date()) {
      setUpdateStatus({ type: "error", message: "Cannot assign past dates." });
      clearUpdateStatus();
      return;
    }

    setIsSaving(true);
    try {
      const updatedSchedules = [...scheduledDates, newSchedule]
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      
      const employeeRef = ref(database, `attendance/Agua Viva Elgin R7/${employeeId}`);
      await update(employeeRef, { 
        assignedDates: updatedSchedules.map(schedule => schedule.date)
      });

      setScheduledDates(updatedSchedules);
      setUpdateStatus({ type: "success", message: "Schedule added successfully." });
    } catch (error) {
      console.error("Error updating schedule:", error);
      setUpdateStatus({ type: "error", message: "Failed to update schedule." });
    } finally {
      setIsSaving(false);
      clearUpdateStatus();
    }
  };

  const handleUpdateAccount = async () => {
    if (!formData.email && !newPassword) {
      setUpdateStatus({ type: "error", message: "Please provide new email or password." });
      clearUpdateStatus();
      return;
    }

    if (!currentPassword) {
      setUpdateStatus({ type: "error", message: "Current password is required." });
      clearUpdateStatus();
      return;
    }

    setUpdatingAccount(true);
    try {
      const user = auth.currentUser;
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      if (formData.email !== user.email) {
        await updateEmail(user, formData.email);
        await update(ref(database, `attendance/Agua Viva Elgin R7/${employeeId}`), { 
          email: formData.email 
        });
      }
      
      if (newPassword) {
        await updatePassword(user, newPassword);
      }

      setUpdateStatus({ type: "success", message: "Account updated successfully." });
      setNewPassword("");
      setCurrentPassword("");
    } catch (error) {
      console.error("Error updating account:", error);
      setUpdateStatus({ type: "error", message: "Failed to update account." });
    } finally {
      setUpdatingAccount(false);
      clearUpdateStatus();
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "in",
      format: [3.5, 2]
    });

    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 3.5, 2, "F");

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("Employee Badge", 1.75, 0.3, { align: "center" });
    
    doc.setFontSize(10);
    doc.text(`Name: ${employeeDetails.name}`, 0.2, 0.6);
    doc.text(`Rank: ${employeeDetails.rank}`, 0.2, 0.8);
    doc.text(`Position: ${employeeDetails.position}`, 0.2, 1.0);

    const qrCanvas = document.querySelector("canvas");
    const qrDataURL = qrCanvas.toDataURL("image/png");
    doc.addImage(qrDataURL, "PNG", 2.0, 0.5, 1, 1);

    doc.save(`${employeeDetails.name}_Badge.pdf`);
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        Loading employee details...
      </div>
    );
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (!employeeDetails) {
    return <div className="error-message">No employee details found</div>;
  }

  return (
    <div className="employee-profile-container">
      {updateStatus.message && (
        <div className={`update-status ${updateStatus.type}`}>
          {updateStatus.message}
        </div>
      )}

      <div className="profile-header">
        <div className="profile-info">
          <div className="avatar">
            {employeeDetails.name.charAt(0)}
          </div>
          <div>
            <h1>{employeeDetails.name}</h1>
            <p>Employee ID: {employeeId}</p>
          </div>
        </div>
        
        <div className="profile-actions">
          <button
            onClick={() => setEditMode(!editMode)}
            className={`btn ${editMode ? 'secondary' : 'primary'}`}
          >
            {editMode ? 'Cancel' : 'Edit Profile'}
          </button>
          {editMode && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="btn primary"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>

      <div className="profile-sections">
        <div className="left-section">
          <CollapsibleSection 
            title="Personal Information"
            defaultExpanded={true}
            className="profile-details"
          >
            <div className="form-grid">
              <div className="form-group">
                <label>Position:</label>
                <input
                  type="text"
                  name="position"
                  value={formData.position}
                  onChange={handleFormChange}
                  disabled={!editMode}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Rank:</label>
                <select
                  name="rank"
                  value={formData.rank}
                  onChange={handleFormChange}
                  disabled={!editMode}
                  className="form-select"
                >
                  <option value="1">1 - Entry Level</option>
                  <option value="2">2 - Intermediate</option>
                  <option value="3">3 - Senior</option>
                  <option value="4">4 - Manager</option>
                  <option value="5">5 - Director</option>
                </select>
              </div>

              <div className="form-group">
                <label>Email:</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleFormChange}
                  disabled={!editMode}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Phone:</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleFormChange}
                  disabled={!editMode}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Department:</label>
                <input
                  type="text"
                  name="department"
                  value={formData.department}
                  onChange={handleFormChange}
                  disabled={!editMode}
                  className="form-input"
                />
              </div><div className="form-group">
                <label>Supervisor:</label>
                <input
                  type="text"
                  name="supervisor"
                  value={formData.supervisor}
                  onChange={handleFormChange}
                  disabled={!editMode}
                  className="form-input"
                />
              </div>
            </div>

            {editMode && (
              <div className="account-security">
                <h3>Account Security</h3>
                <div className="form-group">
                  <label>Current Password:</label>
                  <div className="password-input">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="form-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="password-toggle"
                    >
                      {showCurrentPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label>New Password:</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="form-input"
                  />
                </div>
                <button
                  onClick={handleUpdateAccount}
                  disabled={updatingAccount}
                  className="btn secondary"
                >
                  {updatingAccount ? "Updating..." : "Update Account"}
                </button>
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection 
            title="Performance Statistics"
            defaultExpanded={true}
            className="stats-section"
          >
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Total Hours</h3>
                <p>{stats.totalHours}</p>
              </div>
              <div className="stat-card">
                <h3>Avg Hours/Day</h3>
                <p>{stats.avgHoursPerDay}</p>
              </div>
              <div className="stat-card">
                <h3>Attendance Rate</h3>
                <p>{stats.attendanceRate}%</p>
              </div>
              <div className="stat-card">
                <h3>Punctuality Rate</h3>
                <p>{stats.punctualityRate}%</p>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection 
            title="Recent Attendance"
            defaultExpanded={true}
            className="attendance-section"
          >
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Clock In</th>
                    <th>Clock Out</th>
                    <th>Hours Worked</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceRecords.map((record, index) => {
                    let hoursWorked = "N/A";
                    if (record.clockInTime && record.clockOutTime) {
                      const clockIn = new Date(`${record.date} ${record.clockInTime}`);
                      const clockOut = new Date(`${record.date} ${record.clockOutTime}`);
                      const diff = (clockOut - clockIn) / (1000 * 60 * 60);
                      hoursWorked = diff.toFixed(2);
                    }
                    return (
                      <tr key={index}>
                        <td>{record.date}</td>
                        <td>{record.clockInTime || "Not Clocked In"}</td>
                        <td>{record.clockOutTime || "Not Clocked Out"}</td>
                        <td>{hoursWorked}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>
        </div>

        <div className="right-section">
          <CollapsibleSection 
            title="Employee ID Card"
            defaultExpanded={true}
            className="id-card-section"
          >
            <div className="id-card">
              <div className="id-card-avatar">
                {employeeDetails.name.charAt(0)}
              </div>
              <h3>{employeeDetails.name}</h3>
              <p>{formData.position}</p>
              <div className="qr-container">
                <QRCode
                  value={JSON.stringify({ employeeId })}
                  size={120}
                  level="H"
                />
              </div>
              <p className="id-number">ID: {employeeId}</p>
            </div>
            <button onClick={generatePDF} className="btn primary full-width">
              Download ID Card
            </button>
          </CollapsibleSection>

          <CollapsibleSection 
            title="Schedule Management"
            defaultExpanded={true}
            className="schedule-section"
          >
            <Calendar
              scheduledDates={scheduledDates}
              onScheduleUpdate={handleScheduleUpdate}
              minDate={new Date()}
            />
          </CollapsibleSection>
        </div>
      </div>
    </div>
  );
};

export default EmployeeProfile;