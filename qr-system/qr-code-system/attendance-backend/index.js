const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const moment = require('moment-timezone');
const db = require('./firebaseConfig'); // Import Firebase database instance

const app = express();
const PORT = process.env.PORT || 3003;

app.use(bodyParser.json());
app.use(cors());

app.get('/clock-in', async (req, res) => {
  const { employeeId, name, location } = req.query;
  console.log('Clock-in request received:', { employeeId, name, location });

  if (!employeeId || !location || !name) {
    console.log(`Invalid parameters: employeeId=${employeeId}, name=${name}, location=${location}`);
    return res.status(400).send('Employee ID, name, and location are required');
  }

  const clockInTime = moment().tz('America/Chicago').format('YYYY-MM-DD hh:mm:ss A');

  try {
    const ref = db.ref('clockins');
    await ref.push({
      employeeId,
      name,
      clockInTime,
      location,
    });

    console.log(`Employee ${name} (${employeeId}) clocked in at location ${location} at ${clockInTime}`);
    res.send(`Employee ${name} clocked in at ${clockInTime} at location ${location}`);
  } catch (error) {
    console.error('Error clocking in:', error);
    res.status(500).send('Error clocking in');
  }
});

app.get('/attendance', async (req, res) => {
  const { location, employeeId } = req.query;
  try {
    const ref = db.ref('clockins');
    let snapshot = await ref.once('value');
    let data = snapshot.val();
    
    let attendance = Object.values(data || {});

    // Filter by location if provided
    if (location) {
      attendance = attendance.filter(record => record.location === location);
    }

    // Filter by employeeId if provided
    if (employeeId) {
      attendance = attendance.filter(record => record.employeeId === employeeId);
    }

    console.log(`Filtered data for location "${location}" and employeeId "${employeeId}":`, attendance);

    if (attendance.length === 0) {
      console.log(`No records found for location: ${location} and employeeId: ${employeeId}`);
      return res.json([]); 
    }

    res.json(attendance); 
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).send('Error fetching attendance');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
