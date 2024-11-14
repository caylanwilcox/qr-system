import React, { useState, useRef, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import './App.css';

const Scanner = ({ setMessage, mode, location }) => {
  const [errors, setErrors] = useState([]);
  const lastErrorTimeRef = useRef(0);
  const modeRef = useRef(mode); // Holds the mode value
  const ERROR_THROTTLE_TIME = 5000; // 5 seconds
  const qrScannerRef = useRef(null); // Ref for html5-qrcode instance

  useEffect(() => {
    modeRef.current = mode; // Update ref whenever mode changes
    console.log('Scanner component received mode:', mode);
  }, [mode]);

  useEffect(() => {
    if (!qrScannerRef.current) {
      qrScannerRef.current = new Html5Qrcode("qr-reader");
      startScanning();
    }
    
    // Cleanup on component unmount
    return () => {
      if (qrScannerRef.current) {
        qrScannerRef.current.stop().then(() => {
          qrScannerRef.current = null;
          console.log("QR scanner stopped.");
        }).catch(console.error);
      }
    };
  }, []);

  const startScanning = () => {
    qrScannerRef.current.start(
      { facingMode: "environment" }, // Use back camera
      { fps: 10, qrbox: 250 }, // Optional settings
      handleScan,
      handleError
    ).catch((err) => {
      console.error("Error starting QR scanner:", err);
      logError(`Error starting scanner: ${err.message}`);
    });
  };

  const handleScan = async (data) => {
    if (!data) {
      console.log('No data scanned');
      setMessage('No data scanned');
      logError('No data scanned');
      return;
    }
  
    console.log('Current mode in handleScan:', modeRef.current);
    console.log('Scanned data:', data);
  
    // Split the scanned data
    const [employeeId, name] = data.split('|');
    console.log(`Parsed employeeId: ${employeeId}, name: ${name}`);
  
    if (!employeeId) {
      const errorMsg = `Invalid scanned data: ${data}`;
      console.error(errorMsg);
      logError(errorMsg);
      return;
    }
  
    if (!location) {
      const errorMsg = `Missing location: ${location}`;
      console.error(errorMsg);
      logError(errorMsg);
      return;
    }
  
    if (!name) {
      const errorMsg = `Name is missing in scanned data: ${data}`;
      console.warn(errorMsg);
      logError(errorMsg);
    }
  
    const url = `http://localhost:3003/${modeRef.current}?employeeId=${employeeId}&name=${encodeURIComponent(name || '')}&location=${encodeURIComponent(location)}`;
    console.log(`Fetching URL: ${url}, Mode: ${modeRef.current}`);
  
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      const result = await response.text();
      setMessage(result);
      console.log('Server response:', result);
    } catch (error) {
      console.error('Error during fetch:', error);
      setMessage('Error during clock-in/out process: ' + error.message);
      logError(`Error during fetch: ${error.message}`);
    }
  };

  const handleError = (err) => {
    const currentTime = Date.now();
    if (err && currentTime - lastErrorTimeRef.current > ERROR_THROTTLE_TIME) {
      console.error('Scanner error:', err);
      lastErrorTimeRef.current = currentTime;
      logError(`Scanner error: ${err.message}`);
    }
  };

  const logError = (message) => {
    setErrors((prevErrors) => [...prevErrors, message]);
  };

  return (
    <div className="scanner-container">
      <div id="qr-reader" style={{ width: '100%' }}>
        <p>Scanner is active. Please scan a QR code.</p>
      </div>
    </div>
  );
};

export default Scanner;
