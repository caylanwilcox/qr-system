import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import { BrowserQRCodeReader } from '@zxing/browser';

function App() {
  const [employeeId, setEmployeeId] = useState('');
  const [scannedData, setScannedData] = useState('');
  const [attendance, setAttendance] = useState({});
  const [scanner, setScanner] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    const codeReader = new BrowserQRCodeReader();
    codeReader.getVideoInputDevices().then((videoInputDevices) => {
      setScanner(new BrowserQRCodeReader(videoInputDevices[0].deviceId));
    });

    return () => {
      if (scanner) {
        scanner.reset();
      }
    };
  }, [scanner]);

  const handleGenerateQR = () => {
    if (employeeId) {
      setAttendance({ ...attendance, [employeeId]: { clockIn: null, clockOut: null } });
    }
  };

  const handleScan = async () => {
    if (scanner && videoRef.current) {
      try {
        const result = await scanner.decodeOnceFromVideoDevice(undefined, videoRef.current);
        const id = result.text;
        if (attendance[id]) {
          const currentTime = new Date().toLocaleTimeString();
          if (!attendance[id].clockIn) {
            setAttendance({ ...attendance, [id]: { ...attendance[id], clockIn: currentTime } });
          } else if (!attendance[id].clockOut) {
            setAttendance({ ...attendance, [id]: { ...attendance[id], clockOut: currentTime } });
          }
        }
        setScannedData(id);
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="App">
      <h1>QR Code System</h1>
      <div>
        <h2>Generate QR Code</h2>
        <input
          type="text"
          placeholder="Enter Employee ID"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
        />
        <button onClick={handleGenerateQR}>Generate QR Code</button>
        {employeeId && (
          <div>
            <QRCode value={employeeId} />
            <p>Screenshot this QR code and save it on your phone.</p>
          </div>
        )}
      </div>
      <div>
        <h2>Scan QR Code</h2>
        <video ref={videoRef} style={{ width: '100%' }}></video>
        <button onClick={handleScan}>Start Scan</button>
        {scannedData && <p>Scanned Employee ID: {scannedData}</p>}
      </div>
      <div>
        <h2>Attendance Records</h2>
        <table>
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Clock In</th>
              <th>Clock Out</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(attendance).map((id) => (
              <tr key={id}>
                <td>{id}</td>
                <td>{attendance[id].clockIn || 'N/A'}</td>
                <td>{attendance[id].clockOut || 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
