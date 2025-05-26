const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3003;

// Middleware
app.use(express.json());
app.use(cors());

// Simple test endpoint
app.get('/test', (req, res) => {
  console.log('Test endpoint hit');
  res.json({ success: true, message: 'Server is working!' });
});

// Admin test endpoint
app.post('/api/admin/update-user-auth', (req, res) => {
  console.log('Admin endpoint hit:', req.body);
  res.json({ 
    success: true, 
    message: 'Test admin endpoint working',
    received: req.body 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  console.log('Server is ready to receive requests');
});

// Keep alive
setInterval(() => {
  console.log('Server still running...', new Date().toISOString());
}, 10000);

// Error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
}); 