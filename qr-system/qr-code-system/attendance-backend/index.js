const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const moment = require('moment-timezone'); // Import moment-timezone
const app = express();
const PORT = process.env.PORT || 3003;

const attendanceFilePath = path.join(__dirname, 'attendanceData.json');

app.use(bodyParser.json());
app.use(cors());

const logRequest = (type, employeeId, location, time) => {
  console.log(`Employee ${employeeId} ${type} at ${time} at location ${location}`);
};

const saveData = (data) => {
  fs.writeFileSync(attendanceFilePath, JSON.stringify(data, null, 2));
};

const loadData = () => {
  if (fs.existsSync(attendanceFilePath)) {
    const fileData = fs.readFileSync(attendanceFilePath);
    try {
      const parsedData = JSON.parse(fileData);
      return {
        clockins: parsedData.clockins || [],
        clockouts: parsedData.clockouts || []
      };
    } catch (error) {
      console.error('Error parsing JSON data:', error);
      return { clockins: [], clockouts: [] };
    }
  }
  return { clockins: [], clockouts: [] };
};

const isWithinTimeLimit = (lastTime, limitMinutes) => {
  const currentTime = new Date();
  const lastDateTime = new Date(lastTime);
  const timeDifference = (currentTime - lastDateTime) / (1000 * 0); // in minutes
  return timeDifference < limitMinutes;
};

app.get('/clock-in', (req, res) => {
  const { employeeId, location } = req.query;
  console.log('Clock-in request received:', { employeeId, location });

  if (!employeeId || !location) {
    console.log(`Invalid parameters: employeeId=${employeeId}, location=${location}`);
    return res.status(400).send('Employee ID and location are required');
  }

  const clockInTime = moment().tz('America/Chicago').format('YYYY-MM-DD hh:mm:ss A'); // Central Time in 12-hour format

  try {
    const data = loadData();
    console.log('Loaded data for clock-in:', data);

    const lastClockIn = data.clockins.filter(clockin => clockin.employeeId === employeeId).pop();
    if (lastClockIn) {
      console.log(`Last clock-in time for ${employeeId}: ${lastClockIn.clockInTime}`);
    }
    if (lastClockIn && isWithinTimeLimit(lastClockIn.clockInTime, 5)) {
      console.log(`Clock-in attempt too soon for ${employeeId}`);
      return res.status(400).send('You can only clock in once every 5 minutes');
    }

    data.clockins.push({ employeeId, clockInTime, location });
    saveData(data);
    logRequest('clocked in', employeeId, location, clockInTime);
    res.send(`Employee ${employeeId} clocked in at location ${location}`);
  } catch (error) {
    console.error('Error clocking in:', error);
    res.status(500).send('Error clocking in');
  }
});

app.get('/clock-out', (req, res) => {
  const { employeeId, location } = req.query;
  console.log('Clock-out request received:', { employeeId, location });

  if (!employeeId || !location) {
    console.log(`Invalid parameters: employeeId=${employeeId}, location=${location}`);
    return res.status(400).send('Employee ID and location are required');
  }

  const clockOutTime = moment().tz('America/Chicago').format('YYYY-MM-DD hh:mm:ss A'); // Central Time in 12-hour format

  try {
    const data = loadData();
    console.log('Loaded data for clock-out:', data);

    const lastClockOut = data.clockouts.filter(clockout => clockout.employeeId === employeeId).pop();
    if (lastClockOut) {
      console.log(`Last clock-out time for ${employeeId}: ${lastClockOut.clockOutTime}`);
    }
    // Commented out this block for testing
    /*
    if (lastClockOut && isWithinTimeLimit(lastClockOut.clockOutTime, 5)) {
      console.log(`Clock-out attempt too soon for ${employeeId}`);
      return res.status(400).send('You can only clock out once every 5 minutes');
    }
    */

    data.clockouts.push({ employeeId, clockOutTime, location });
    saveData(data);
    logRequest('clocked out', employeeId, location, clockOutTime);
    res.send(`Employee ${employeeId} clocked out at location ${location}`);
  } catch (error) {
    console.error('Error clocking out:', error);
    res.status(500).send('Error clocking out');
  }
});

app.get('/attendance', (req, res) => {
  try {
    const data = loadData();
    const attendance = {};

    // Combine clock-in and clock-out data to determine attendance and rank
    data.clockins.forEach(clockin => {
      const { employeeId, clockInTime, location } = clockin;
      if (!attendance[employeeId]) {
        attendance[employeeId] = { days: 0, rank: 0, location: location };
      }
      const clockOut = data.clockouts.find(
        clockout => clockout.employeeId === employeeId && moment(clockout.clockOutTime).isSame(clockInTime, 'day')
      );
      if (clockOut) {
        const today = moment().format('YYYY-MM-DD');
        if (!attendance[employeeId][today]) {
          attendance[employeeId].days += 1;
          attendance[employeeId][today] = true;
          if (attendance[employeeId].days % 10 === 0) {
            attendance[employeeId].rank += 1;
          }
        }
      }
    });

    res.json(attendance);
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).send('Error fetching attendance');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
