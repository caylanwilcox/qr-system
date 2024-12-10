import React, { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

const SCAN_STATES = {
  UNKNOWN: 0,
  NOT_STARTED: 1,
  SCANNING: 2,
  PAUSED: 3,
};

const Scanner = ({ setMessage, mode, location, onClockIn }) => {
  const [errors, setErrors] = useState([]);
  const qrScannerRef = useRef(null);
  const modeRef = useRef(mode);
  const loggedErrorsRef = useRef(new Set());

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    const html5QrCode = new Html5Qrcode("qr-reader");
    qrScannerRef.current = html5QrCode;

    const startScanner = async () => {
      try {
        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: 300,
          },
          handleScan,
          handleError
        );
        console.log("Scanner started successfully.");
      } catch (err) {
        logErrorOnce(`Error starting scanner: ${err.message || err}`);
      }
    };

    startScanner();

    return () => {
      if (qrScannerRef.current) {
        const scannerState = qrScannerRef.current.getState();
        console.log("Scanner state during cleanup:", scannerState);

        if (
          scannerState === Html5Qrcode.SCAN_STATE_SCANNING ||
          scannerState === Html5Qrcode.SCAN_STATE_PAUSED
        ) {
          qrScannerRef.current
            .stop()
            .then(() => {
              console.log("QR scanner stopped.");
              qrScannerRef.current.clear();
              qrScannerRef.current = null;
            })
            .catch((err) => {
              logErrorOnce(`Error stopping scanner: ${err.message || err}`);
            });
        } else {
          console.log("Scanner not running or already cleared.");
          qrScannerRef.current.clear();
          qrScannerRef.current = null;
        }
      }
    };
  }, []);

  const handleScan = async (decodedText) => {
    if (!decodedText) {
      setMessage("No data scanned");
      logErrorOnce("No data scanned");
      return;
    }

    console.log("Scanned data:", decodedText);

    let scannedData;
    try {
      scannedData = JSON.parse(decodedText);
    } catch (e) {
      setMessage("Error parsing scanned data");
      logErrorOnce("Error parsing scanned data");
      return;
    }

    const { employeeId, name, location } = scannedData;

    if (!employeeId || !location) {
      const errorMsg = "Invalid scanned data: employeeId or location is missing.";
      setMessage(errorMsg);
      logErrorOnce(errorMsg);
      return;
    }

    const clockInData = {
      employeeId,
      location,
      name,
      mode: modeRef.current,
      timestamp: new Date().toISOString(),
    };

    try {
      const response = await fetch("http://localhost:3003/clock-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clockInData),
      });

      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      setMessage(result.message);

      if (result.success && modeRef.current === "clock-in") {
        onClockIn({
          name: result.employeeName,
          photo: result.employeePhoto || "",
        });
      }
    } catch (error) {
      const errorMsg = `Error during clock-in/out process: ${error.message}`;
      setMessage(errorMsg);
      logErrorOnce(errorMsg);
    }
  };

  const handleError = (err) => {
    if (!err.message) return;
    logErrorOnce(`Scanner error: ${err.message}`);
  };

  const logErrorOnce = (message) => {
    if (!loggedErrorsRef.current.has(message)) {
      loggedErrorsRef.current.add(message);
      console.error(message);
      setErrors((prevErrors) => [...prevErrors, message]);
    }
  };

  return <div id="qr-reader"></div>;
};

export default Scanner;
