# QR System Backend Scripts

This directory contains utility scripts for managing the QR System database, specifically for resetting attendance data and managing events.

## Prerequisites

1. **Node.js** installed on your system
2. **Firebase Admin SDK** credentials configured
3. **Database access** to the QR System Firebase project

## Installation

1. Navigate to the attendance-backend directory:
   ```bash
   cd attendance-backend
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   npm run install-deps
   ```

## Available Scripts

### 1. Reset Attendance Data (`reset-attendance-data.js`)

**Purpose**: Completely resets all attendance-related data in the system while preserving user profiles and event schedules.

**What it removes**:
- ✅ Global attendance records (`attendance` collection)
- ✅ User clock-in times (`users/{userId}/clockInTimes`)
- ✅ User attendance records (`users/{userId}/attendance`)
- ✅ User attendance statistics (days present, late, etc.)
- ✅ User location history
- ✅ User `clockedIn` status (sets to false)

**What it preserves**:
- ✅ User profiles and basic information
- ✅ Event schedules and event data
- ✅ System settings and configurations
- ✅ User permissions and roles

**Usage**:
```bash
npm run reset-attendance
# or
node reset-attendance-data.js
```

**Safety Features**:
- Interactive confirmation prompt (must type "YES")
- Detailed summary of what will be removed
- Comprehensive logging of all operations

### 2. Remove Scheduled Events (`database-update.js`)

**Purpose**: Removes all scheduled events from both the global events collection and user event records.

**What it removes**:
- ✅ Global events collection
- ✅ User event schedules
- ✅ All event categories (workshops, meetings, haciendas, etc.)

**Usage**:
```bash
npm run remove-events
# or
node database-update.js
```

## Usage Examples

### Complete System Reset (for testing)
```bash
# 1. First remove all events
npm run remove-events

# 2. Then reset all attendance data
npm run reset-attendance
```

### Attendance Data Only Reset (preserve events)
```bash
# Only reset attendance, keep events intact
npm run reset-attendance
```

## Script Output

Both scripts provide detailed logging:

```
🔄 Starting attendance data reset...
📊 Scanning global attendance collection...
Found 1,234 global attendance records
✅ Global attendance collection marked for removal
👥 Scanning user profiles...
Found 50 users
  📅 User user123: Removing 15 clock-in times
  📋 User user123: Removing 10 attendance records
  📈 User user123: Resetting attendance statistics
  ✅ User user123: Attendance data reset

========= ATTENDANCE RESET SUMMARY =========
Global attendance records removed: 1,234
Users processed:                   50
User attendance records removed:   500
Clock-in times removed:            750
User stats reset:                  45
Total database updates:            1,295
============================================

🎉 Attendance data reset completed successfully!
```

## Safety Considerations

⚠️ **IMPORTANT**: These scripts make permanent changes to your database!

1. **Always backup your database** before running these scripts
2. **Test on a development environment** first
3. **Confirm you have the correct Firebase project** configured
4. **Read the confirmation prompts carefully**

## Configuration

The scripts use Firebase Admin SDK with service account credentials embedded in the code. In a production environment, you should:

1. Store credentials in environment variables
2. Use a separate service account for each environment
3. Implement additional access controls

## Troubleshooting

### Common Issues

1. **Permission Denied**: Ensure your service account has the necessary permissions
2. **Network Timeout**: Large datasets may take time to process
3. **Memory Issues**: For very large databases, consider processing in batches

### Error Handling

Both scripts include comprehensive error handling and will:
- Log detailed error messages
- Exit with appropriate error codes
- Preserve database integrity even if interrupted

## Development

To modify these scripts:

1. Update the service account credentials for your environment
2. Modify the data structures being reset as needed
3. Test thoroughly on development data
4. Update this README with any changes

## Support

For issues or questions:
1. Check the console output for detailed error messages
2. Verify Firebase project configuration
3. Ensure proper permissions are set
4. Contact the development team for assistance 