# QR Code System Data Standards

This document outlines the standardized data structure for attendance tracking in the QR Code System to ensure consistent data writing and reading across all components.

## Database Structure

### User Attendance Records

When a user scans their QR code, the system writes data to the following locations:

1. **Global attendance collection**:
   ```
   attendance/{locationKey}/{date}/{userId}
   ```

2. **User-specific records**:
   ```
   users/{userId}/clockInTimes/{timestamp}
   users/{userId}/clockedIn
   users/{userId}/attendance/{date}/...
   users/{userId}/stats/...
   users/{userId}/events/{eventType}/{eventId}/...  // For specific event types
   ```

## Data Format Standards

### Timestamps and Dates

- **Dates** should be stored in `YYYY-MM-DD` format (e.g., `2023-05-15`)
- **Timestamps** should be stored as Unix milliseconds (e.g., `1684108800000`)
- **Display times** should be formatted as `hh:mm A` (e.g., `09:30 AM`)

### Event Type Normalization

When recording attendance for specific event types:

1. **Event Type Storage**: The original event type value (e.g., "Junta Hacienda") is stored in the attendance record
2. **Event Recording**: Events are stored under normalized keys in the user's events section:
   - "Junta Hacienda" → stored under `events/juntahacienda/{eventId}`
   - "Meeting" → stored under `events/meetings/{eventId}`
   - "Workshop" → stored under `events/workshops/{eventId}`
   - "Hacienda" → stored under `events/haciendas/{eventId}`
   - "Gestion" → stored under `events/gestion/{eventId}`

### Attendance Record Structure

When a QR code is scanned, the following data structure is written:

```json
{
  "userId": "user123",
  "name": "John Doe",
  "position": "Coordinator",
  "location": "aurora",
  "locationName": "Aurora",
  "eventType": "Junta Hacienda",  // Original event type value
  "clockInTime": "09:15 AM",
  "clockInTimestamp": 1684108800000,
  "isLate": false,
  "onTime": true,
  "date": "2023-05-15"
}
```

### Event Record Structure

For specific event types (not GENERAL), an additional event record is created:

```json
{
  "attended": true,
  "attendedAt": "2023-05-15T14:15:00.000Z",
  "date": "2023-05-15",
  "title": "Junta de Hacienda - Clock In",
  "scheduled": true,
  "location": "aurora",
  "eventType": "juntahacienda"  // Normalized event type
}
```

## Component Integration

### QR Scanner (QRScannerPage.js)
- Writes attendance data to both global and user-specific locations
- Normalizes event types for storage in the events section
- Emits events for real-time updates

### SuperAdminDashboard.js
- Reads from global attendance collection
- Checks user's clockInTimes and attendance objects
- Displays real-time clocked-in users

### StatsSection.js (Employee Profile)
- Reads from user's events object for event-specific attendance
- Displays attendance history from attendance object
- Shows event squares based on events data

### ClockedInList.js
- Processes attendance data for the current date
- Displays users who have clocked in today

### Reports Components
- Can query both global attendance and user-specific data
- Aggregates data across locations and dates

## Best Practices

1. **Always use normalized keys** when storing events in the user's events section
2. **Preserve original values** in attendance records for display purposes
3. **Emit appropriate events** after data updates for real-time synchronization
4. **Handle both object and array formats** when reading event data
5. **Check multiple date formats** when querying attendance data

## Event Bus Events

The following events are emitted for real-time updates:

- `ATTENDANCE_UPDATED`: When a user clocks in/out
- `USER_DATA_UPDATED`: When user data changes
- `EVENT_UPDATED`: When event attendance is recorded
- `DASHBOARD_DATA_UPDATED`: For dashboard refreshes

## Troubleshooting

If events aren't showing up in the scheduled squares:
1. Check that events are being written to `users/{userId}/events/{normalizedEventType}/`
2. Verify the event type normalization matches between writing and reading
3. Ensure the `scheduled` property is set to `true` for the event
4. Check console logs for event extraction debugging information 