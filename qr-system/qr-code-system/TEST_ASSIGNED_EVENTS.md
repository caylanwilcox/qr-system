# Testing Assigned Events Red Box Functionality - UPDATED

## Overview
This document explains how to test the enhanced red box functionality that shows assigned events from the global events database until users clock in.

## How It Works (Updated)

### 1. Global Events Integration
The system now loads events from the **global events collection** in Firebase:
- **Database Path**: `events/{eventId}`
- **Event Structure**: Each event contains participants with assignment details
- **Real-time Loading**: Events are loaded when viewing Employee Profile
- **Chronological Ordering**: Events are sorted by date (most recent first)

### 2. Event Assignment Process
When users are assigned to events through the Scheduler:
1. Go to Scheduler → Create/Edit Event → Assign Participants
2. Select users and assign them to the event
3. **Global event updated** with participant data:
   ```javascript
   "events": {
     "eventId": {
       "participants": {
         "userId": {
           "assigned": true,
           "assignedAt": "2025-01-25T10:00:00.000Z",
           "attended": false
         }
       }
     }
   }
   ```
4. **Statistics entries** are also created for tracking

### 3. Red Box Display (Enhanced)
In the Employee Profile → Registry section:
- **Loads global events** where user is a participant
- **Red boxes with "!" icon** appear for events where `assigned: true` and `attended: false`
- **Chronological order** - events displayed by date (most recent first)
- **Tooltip shows**: "Assigned - Clock in required (assigned Jan 25, 10:00 AM) - Event Title @ Location [global]"
- **Section header shows**: "Workshop (1 assigned)" with event count

### 4. Clock-In Process (Enhanced)
When the user scans their QR code:
1. **Global event updated**: `participants.userId.attended = true`
2. **Statistics updated**: `clockedIn: true, status: 'completed'`
3. **Red box changes** to green box with checkmark
4. **Tooltip updates** to: "Attended (Jan 25, 10:30 AM) - Event Title @ Location"

## Database Structure

### Global Events Collection
```javascript
events: {
  "eventId": {
    "title": "Workshop Meeting",
    "eventType": "workshops",
    "location": "Aurora",
    "start": "2025-01-25T10:00:00.000Z",
    "end": "2025-01-25T12:00:00.000Z",
    "participants": {
      "userId1": {
        "assigned": true,
        "assignedAt": "2025-01-25T09:00:00.000Z",
        "attended": false
      },
      "userId2": true  // Legacy format (attended)
    }
  }
}
```

### User Statistics (Backup tracking)
```javascript
users: {
  "userId": {
    "statistics": {
      "eventId": {
        "eventId": "eventId",
        "eventTitle": "Workshop Meeting",
        "eventType": "workshops",
        "location": "Aurora",
        "date": "2025-01-25",
        "assignedAt": "2025-01-25T09:00:00.000Z",
        "status": "assigned", // → "completed"
        "clockedIn": false,   // → true
        "clockInTime": null   // → "10:30 AM"
      }
    }
  }
}
```

## Testing Steps

### Step 1: Assign a User to an Event
1. Go to **Scheduler** page
2. Create a new event or edit existing event
3. Click **"Assign Participants"**
4. Select a user and click **"Assign X Participants"**
5. **Verify**: Check Firebase console for global event with participant data

### Step 2: Check Employee Profile (Enhanced)
1. Go to **Employee Profile** for the assigned user
2. Navigate to the **Registry** section
3. **Expected**: Loading indicator shows "Loading Events..."
4. **Expected**: Red box with "!" icon and detailed tooltip
5. **Expected**: Section header shows "(X assigned)" count
6. **Expected**: Events displayed in chronological order (most recent first)
7. **Expected**: Tooltip shows "[global]" source indicator

### Step 3: Test Clock-In (Enhanced)
1. Go to **QR Scanner** page
2. Set location and event type appropriately
3. Scan the user's QR code
4. **Expected**: Success message showing clock-in
5. **Expected**: Console logs show statistics updates

### Step 4: Verify Status Change (Enhanced)
1. Return to **Employee Profile** → **Registry**
2. **Expected**: Red box changed to green box with checkmark
3. **Expected**: Tooltip shows "Attended" with timestamp
4. **Expected**: Section header count updated
5. **Expected**: Firebase shows `attended: true` in global event

## Visual Indicators (Updated)

### Red Box (Assigned - Priority 1)
- **Background**: `bg-red-500/30`
- **Border**: `border-red-500/50`
- **Icon**: `AlertCircle` (!)
- **Text Color**: `text-red-300`
- **Condition**: `assigned: true && attended: false`

### Green Box (Attended - Priority 2)
- **Background**: `bg-green-500/20`
- **Border**: `border-green-500/30`
- **Icon**: `CheckSquare` (✓)
- **Text Color**: `text-green-400`
- **Condition**: `attended: true || clockedIn: true`

### Orange Box (Pending - Priority 3)
- **Background**: `bg-orange-500/20`
- **Border**: `border-orange-500/30`
- **Icon**: `Clock` (⏱)
- **Text Color**: `text-orange-400`
- **Condition**: `scheduled: true && !attended && !assigned`

## Debugging (Enhanced)

### Check Global Events Loading
In browser console, look for:
```
🔍 [StatsSection] Loading global events for user: userId
🔍 [StatsSection] Found 5 events for user: [{id, title, eventType, assigned, attended}]
🔍 [StatsSection] Found 2 global events for workshops
```

### Check Event Processing
```
🔍 [StatsSection] Processing attendance stats with events: ["workshops", "meetings"]
🔍 [StatsSection] Processing statistics: ["event-123"]
🔍 [StatsSection] Processing global events: 5
🔍 [StatsSection] Processed 3 total events for workshops: [{source: "global"}]
```

### Check Database Structure
In Firebase console, verify:
```
events/
  {eventId}/
    participants/
      {userId}/
        assigned: true → (stays true)
        attended: false → true
        attendedAt: null → "2025-01-25T10:30:00.000Z"

users/
  {userId}/
    statistics/
      {eventId}/
        status: "assigned" → "completed"
        clockedIn: false → true
```

## Troubleshooting (Updated)

### Red Box Not Showing
1. **Check global events loading**: Look for loading indicators
2. **Verify participant data**: Check Firebase events collection
3. **Check event type matching**: Ensure eventType matches section
4. **Check user ID**: Verify correct user is in participants

### Events Not Loading
1. **Check console errors**: Look for Firebase permission issues
2. **Verify database structure**: Ensure events collection exists
3. **Check user permissions**: Verify user can read events
4. **Check network**: Ensure Firebase connection is working

### Wrong Event Order
1. **Check date parsing**: Verify start/end dates are valid
2. **Check sorting logic**: Events should be sorted by date
3. **Check event dates**: Ensure events have proper timestamps

### Event Type Matching Issues
The system matches event types using normalized keys:
- "workshops" → "workshops"
- "haciendas" → "haciendas"
- "juntahacienda" → "juntahacienda"
- "meetings" → "meetings"
- "gestion" → "gestion"

## Performance Considerations

### Caching
- Global events are loaded once per user session
- Events refresh on manual refresh or event updates
- Loading states prevent multiple simultaneous requests

### Data Sources
1. **Primary**: Global events collection (real-time assignments)
2. **Secondary**: User statistics (backup tracking)
3. **Legacy**: User events structure (backwards compatibility)

## Expected Behavior Summary (Updated)

1. **Loading**: Shows "Loading Events..." while fetching global events
2. **Assignment**: User gets red box with "!" for assigned events from global collection
3. **Chronological**: Events displayed in date order (most recent first)
4. **Clock-in**: Red box changes to green box with "✓" after QR scan
5. **Dual Update**: Both global events and statistics are updated
6. **Real-time**: Changes appear immediately after QR scan
7. **Source Tracking**: Tooltips show "[global]" or "[legacy]" source indicators
8. **Count Display**: Shows actual events vs total slots (e.g., "3/12") 