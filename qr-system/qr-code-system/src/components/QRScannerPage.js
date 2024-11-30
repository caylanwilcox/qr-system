import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCog } from "@fortawesome/free-solid-svg-icons";
import Scanner from "./Scanner";
import "./QRScannerPage.css";

const QrScannerPage = () => {
  const [message, setMessage] = useState("");
  const [location, setLocation] = useState("");
  const [mode, setMode] = useState("clock-in"); // Default mode
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [employeeInfo, setEmployeeInfo] = useState(null);

  const locations = [
    "Agua Viva West Chicago",
    "Agua Viva Lyons",
    "Agua Viva",
    "Agua Viva Elgin R7",
    "Agua Viva Joliet",
    "Agua Viva Wheeling",
  ];

  const toggleSettingsVisibility = () => {
    setSettingsVisible(!settingsVisible);
  };

  const handleModeSwitch = (newMode) => {
    setMode(newMode);
    setMessage(`Switched to ${newMode === "clock-in" ? "Clock In" : "Clock Out"} mode.`);
  };

  const handleClockIn = (employee) => {
    const clockInTime = new Date().toLocaleString();
    setEmployeeInfo({
      name: employee.name,
      photo: employee.photo,
      clockInTime,
    });
    setMessage(`Clocked in successfully at ${clockInTime}`);
  };

  return (
    <div className="admin-container">
      <header className="Admin-header">
        <h1>QR Code Scanner</h1>
      </header>

      {/* Gear Icon for Settings */}
      <div className="gear-icon" onClick={toggleSettingsVisibility}>
        <FontAwesomeIcon icon={faCog} size="2x" />
      </div>

      {/* Scanner Settings */}
      {settingsVisible && (
        <div className="scanner-settings">
          <h2>Scanner Settings</h2>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="location-dropdown"
          >
            <option value="">Select Location</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>

          <div className="button-group">
            <button onClick={() => handleModeSwitch("clock-in")}>Clock In</button>
            <button onClick={() => handleModeSwitch("clock-out")}>Clock Out</button>
          </div>

          <p>Current Mode: {mode === "clock-in" ? "Clock In" : "Clock Out"}</p>
        </div>
      )}

      {/* QR Code Scanner */}
      <div className="scanner-container">
        <Scanner setMessage={setMessage} location={location} mode={mode} onClockIn={handleClockIn} />
      </div>

      {/* Message Display */}
      <div className="message-container">
        <p>{message}</p>
      </div>

      {/* Employee Information */}
      {employeeInfo && (
        <div className="employee-info-container">
          <div className="employee-img-container">
            <img src={employeeInfo.photo} alt="Employee" className="employee-img" />
          </div>
          <div className="employee-details">
            <h2>{employeeInfo.name}</h2>
            <p>Clocked in at: {employeeInfo.clockInTime}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default QrScannerPage;
