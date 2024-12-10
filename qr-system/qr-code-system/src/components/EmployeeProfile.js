import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { database } from "../services/firebaseConfig";
import { ref, get, update } from "firebase/database";
import { auth } from "../services/firebaseConfig";
import { updateEmail, updatePassword } from "firebase/auth";
import QRCode from "qrcode.react";
import { jsPDF } from "jspdf";
import "./EmployeeProfile.css";

const EmployeeProfile = () => {
  const { employeeId } = useParams();
  const [employeeDetails, setEmployeeDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [calendarValue, setCalendarValue] = useState(new Date());
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [assignedDates, setAssignedDates] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [updatingAccount, setUpdatingAccount] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Editable fields
  const [newPosition, setNewPosition] = useState("");
  const [newRank, setNewRank] = useState("1");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const fetchEmployeeDetails = async () => {
      setError(null);
      try {
        const employeeRef = ref(database, `attendance/Agua Viva Elgin R7/${employeeId}`);
        const snapshot = await get(employeeRef);

        if (snapshot.exists()) {
          const data = snapshot.val();
          const today = new Date();

          // Filter out past dates from assigned dates
          const validDates = (data.assignedDates || []).filter(
            (date) => new Date(date).setHours(0, 0, 0, 0) >= today.setHours(0, 0, 0, 0)
          );

          setEmployeeDetails(data);
          setAssignedDates(validDates);
          const records = formatAttendanceRecords(data.clockInTimes, data.clockOutTimes);
          setAttendanceRecords(records);
          setNewPosition(data.position || "");
          setNewRank(data.rank || "1");
          setNewEmail(data.email || "");
          setNewPhone(data.phone || "");

          // Update database if any invalid dates were filtered
          if (validDates.length !== (data.assignedDates || []).length) {
            await update(employeeRef, { assignedDates: validDates });
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
    };

    fetchEmployeeDetails();
  }, [employeeId]);

  const formatAttendanceRecords = (clockInTimes = {}, clockOutTimes = {}) => {
    const dates = Array.from(new Set([...Object.keys(clockInTimes), ...Object.keys(clockOutTimes)]));
    return dates.map((date) => ({
      date: new Date(parseInt(date, 10) * 1000).toLocaleDateString(),
      clockInTime: clockInTimes[date] ? new Date(clockInTimes[date] * 1000).toLocaleTimeString() : "N/A",
      clockOutTime: clockOutTimes[date] ? new Date(clockOutTimes[date] * 1000).toLocaleTimeString() : "N/A",
    }));
  };

  const handleReassign = async () => {
    if (!scheduleTime) {
      alert("Please select a time.");
      return;
    }

    const formattedSchedule = `${calendarValue.toDateString()} at ${scheduleTime}`;
    if (assignedDates.includes(formattedSchedule)) {
      alert("This date and time are already assigned.");
      return;
    }

    setIsSaving(true);
    try {
      const updatedDetails = {
        ...employeeDetails,
        assignedDates: [...assignedDates, formattedSchedule],
      };

      const employeeRef = ref(database, `attendance/Agua Viva Elgin R7/${employeeId}`);
      await update(employeeRef, { assignedDates: updatedDetails.assignedDates });

      setEmployeeDetails(updatedDetails);
      setAssignedDates(updatedDetails.assignedDates);
      alert("Schedule added successfully.");
    } catch (error) {
      console.error("Error updating schedule:", error);
      alert("An error occurred while updating the schedule.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateAccount = async () => {
    if (!username && !password) {
      alert("Please provide either a username or password to update.");
      return;
    }

    setUpdatingAccount(true);
    try {
      if (username) {
        await updateEmail(auth.currentUser, username);
      }
      if (password) {
        await updatePassword(auth.currentUser, password);
      }
      alert("Account updated successfully.");
    } catch (error) {
      console.error("Error updating account:", error);
      alert("Failed to update account. Please try again.");
    } finally {
      setUpdatingAccount(false);
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "in", format: [3.5, 2] }); // Flashcard size
    doc.setFontSize(10);
    doc.text(`Name: ${employeeDetails.name}`, 0.5, 0.3);
    doc.text(`Rank: ${employeeDetails.rank}`, 0.5, 0.5);
    doc.text(`Position: ${employeeDetails.position}`, 0.5, 0.7);

    const qrCanvas = document.querySelector("canvas");
    const qrDataURL = qrCanvas.toDataURL("image/png");
    doc.addImage(qrDataURL, "PNG", 1.25, 0.75, 1, 1); // Center the QR code properly
    doc.save(`${employeeDetails.name}_Badge.pdf`);
  };

  const nextAssignedDate = assignedDates.length
    ? assignedDates.sort((a, b) => new Date(a) - new Date(b))[0]
    : null;

  if (loading) return <p className="loading">Loading employee details...</p>;
  if (error) return <p className="error-message">{error}</p>;
  if (!employeeDetails) return <p>No employee details found for {employeeId}</p>;

  return (
    <div className="employee-profile-container">
      <div className="profile-header">
        <h1>{employeeDetails.name}</h1>
        <p>Employee ID: {employeeId}</p>
      </div>

      <div className="profile-details">
        <h2>Personal Information</h2>
        <label>Position:</label>
        <input type="text" value={newPosition} onChange={(e) => setNewPosition(e.target.value)} />
        <label>Rank:</label>
        <select value={newRank} onChange={(e) => setNewRank(e.target.value)}>
          <option value="1">1 - Entry Level</option>
          <option value="2">2 - Intermediate</option>
          <option value="3">3 - Senior</option>
          <option value="4">4 - Manager</option>
          <option value="5">5 - Director</option>
        </select>
        <label>Email:</label>
        <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
        <label>Phone:</label>
        <input type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
      </div>

      <div className="account-management">
        <h2>Account Management</h2>
        <label>Username (Email):</label>
        <input type="email" value={username} onChange={(e) => setUsername(e.target.value)} />
        <label>Password:</label>
        <div className="password-input">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button onClick={() => setShowPassword(!showPassword)}>
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        <button onClick={handleUpdateAccount} disabled={updatingAccount}>
          {updatingAccount ? "Updating Account..." : "Update Account"}
        </button>
      </div>
      <div className="profile-calendar">
  <h2>Assigned Schedule</h2>
  {nextAssignedDate && (
    <p>
      <strong>Next Assignment:</strong> {nextAssignedDate}
    </p>
  )}
  <div className="calendar-container">
    <Calendar
      onChange={setCalendarValue}
      value={calendarValue}
      tileClassName={({ date }) => {
        const isAssignedDate = assignedDates.some(
          (assignedDate) => new Date(assignedDate).toDateString() === date.toDateString()
        );
        const isImportantDate = assignedDates.some(
          (assignedDate) =>
            new Date(assignedDate).toDateString() === date.toDateString() &&
            new Date(assignedDate).getTime() > new Date().getTime() // Highlight future dates
        );

        if (isImportantDate) return "highlight-important";
        if (isAssignedDate) return "highlight-assigned";
        return null;
      }}
    />
    <div className="assigned-dates">
      <h3>Assigned Dates</h3>
      <ul>
        {assignedDates.map((date, index) => (
          <li key={index}>{date}</li>
        ))}
      </ul>
    </div>
  </div>
  <label>Time:</label>
  <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
  <button onClick={handleReassign} disabled={isSaving}>
    {isSaving ? "Saving..." : "Add Schedule"}
  </button>
</div>


      <div className="badge-section">
        <h2>QR Badge</h2>
        <QRCode value={JSON.stringify({ employeeId, name: employeeDetails.name })} />
        <button onClick={generatePDF}>Print Badge</button>
      </div>
    </div>
  );
};

export default EmployeeProfile;
