import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { database } from "../services/firebaseConfig";
import { ref, get, update } from "firebase/database";
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

  // Fields to update
  const [newPosition, setNewPosition] = useState("");
  const [newRank, setNewRank] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");

  useEffect(() => {
    const fetchEmployeeDetails = async () => {
      setError(null);
      try {
        const employeeRef = ref(database, `attendance/Agua Viva Elgin R7/${employeeId}`);
        const snapshot = await get(employeeRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          setEmployeeDetails(data);
          setAssignedDates(data.assignedDates || []);
          setAttendanceRecords(data.attendanceRecords || []);
          setNewPosition(data.position || "");
          setNewRank(data.rank || "");
          setNewEmail(data.email || "");
          setNewPhone(data.phone || "");
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

  const checkAttendanceStatus = (scheduleDate, clockInTime) => {
    if (!clockInTime) return "Absent";

    const [scheduledDate, scheduledTime] = scheduleDate.split(" at ");
    const scheduledDateTime = new Date(`${scheduledDate} ${scheduledTime}`);
    const clockInDateTime = new Date(clockInTime);

    return clockInDateTime > scheduledDateTime ? "Late" : "On Time";
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

  const handleUpdateDetails = async () => {
    setIsSaving(true);
    try {
      const updatedDetails = {
        ...employeeDetails,
        position: newPosition,
        rank: newRank,
        email: newEmail,
        phone: newPhone,
      };

      const employeeRef = ref(database, `attendance/Agua Viva Elgin R7/${employeeId}`);
      await update(employeeRef, {
        position: newPosition,
        rank: newRank,
        email: newEmail,
        phone: newPhone,
      });

      setEmployeeDetails(updatedDetails);
      alert("Employee details updated successfully.");
    } catch (error) {
      console.error("Error updating employee details:", error);
      alert("An error occurred while updating employee details.");
    } finally {
      setIsSaving(false);
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Employee Badge", 20, 20);
    doc.text(`Name: ${employeeDetails.name}`, 20, 40);
    doc.text(`Rank: ${employeeDetails.rank}`, 20, 60);
    doc.text(`Position: ${employeeDetails.position}`, 20, 80);
    doc.text(`Email: ${employeeDetails.email}`, 20, 100);
    doc.text(`Phone: ${employeeDetails.phone}`, 20, 120);

    const qrCanvas = document.querySelector("canvas");
    const qrDataURL = qrCanvas.toDataURL("image/png");
    doc.addImage(qrDataURL, "PNG", 20, 130, 50, 50);

    doc.save(`${employeeDetails.name}_Badge.pdf`);
  };

  if (loading) return <p>Loading employee details...</p>;
  if (error) return <p className="error-message">{error}</p>;
  if (!employeeDetails) return <p>No employee details found for {employeeId}</p>;

  return (
    <div className="employee-profile-container">
      <div className="profile-header">
        <h1>{employeeDetails.name}</h1>
        <p>Employee ID: {employeeId}</p>
      </div>

      <div className="profile-content">
        <div className="profile-details">
          <h2>Employee Details</h2>
          <label>Position:</label>
          <input
            type="text"
            value={newPosition}
            onChange={(e) => setNewPosition(e.target.value)}
            placeholder="Enter new position"
          />
          <label>Rank:</label>
          <input
            type="text"
            value={newRank}
            onChange={(e) => setNewRank(e.target.value)}
            placeholder="Enter new rank"
          />
          <label>Email:</label>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Enter new email"
          />
          <label>Phone:</label>
          <input
            type="tel"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="Enter new phone"
          />
          <button className="btn" onClick={handleUpdateDetails} disabled={isSaving}>
            {isSaving ? "Saving..." : "Update Details"}
          </button>
          <QRCode value={JSON.stringify({ employeeId, name: employeeDetails.name, location: "Agua Viva Elgin R7" })} />
          <button className="btn" onClick={generatePDF}>Download Badge</button>
        </div>

        <div className="profile-calendar">
          <h2>Schedule</h2>
          <Calendar onChange={setCalendarValue} value={calendarValue} />
          <label>Time:</label>
          <input
            type="time"
            value={scheduleTime}
            onChange={(e) => setScheduleTime(e.target.value)}
          />
          <button className="btn" onClick={handleReassign} disabled={isSaving}>
            {isSaving ? "Saving..." : "Add Schedule"}
          </button>
          <h3>Upcoming Dates</h3>
          {assignedDates.length > 0 ? (
            <ul>
              {assignedDates.sort().map((date, index) => (
                <li key={index}>{date}</li>
              ))}
            </ul>
          ) : (
            <p>No upcoming schedules.</p>
          )}
        </div>
      </div>

      <div className="attendance-section">
        <h2>Attendance Records</h2>
        {attendanceRecords.length > 0 ? (
          <table className="attendance-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Clock-In Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {attendanceRecords.map((record, index) => (
                <tr key={index}>
                  <td>{record.date}</td>
                  <td>{record.clockInTime || "N/A"}</td>
                  <td>{checkAttendanceStatus(record.date, record.clockInTime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No attendance records available.</p>
        )}
      </div>
    </div>
  );
};

export default EmployeeProfile;
