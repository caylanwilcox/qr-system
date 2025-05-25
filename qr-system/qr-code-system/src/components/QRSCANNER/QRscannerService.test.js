// src/services/QRScannerService.test.js
// Test file for QRScannerService to ensure proper database integration

import { render, screen, waitFor } from '@testing-library/react';
import { ref, get, set, update } from 'firebase/database';
import { database } from './firebaseConfig';
import QRScannerService from './QRScannerService';
import moment from 'moment-timezone';

// Mock Firebase
jest.mock('./firebaseConfig', () => ({
  database: {
    app: { options: { databaseURL: 'https://test-db.firebaseio.com' } }
  }
}));

jest.mock('firebase/database', () => ({
  ref: jest.fn().mockReturnValue({}),
  get: jest.fn(),
  set: jest.fn().mockResolvedValue({}),
  update: jest.fn().mockResolvedValue({}),
  query: jest.fn().mockReturnValue({}),
  orderByChild: jest.fn().mockReturnValue({}),
  equalTo: jest.fn().mockReturnValue({})
}));

// Mock AuthContext
jest.mock('./authContext', () => ({
  useAuth: jest.fn().mockReturnValue({
    user: {
      uid: 'admin123',
      role: 'SUPER_ADMIN',
      managementPermissions: {
        managedLocations: ['*'],
        managedDepartments: ['*']
      }
    }
  })
}));

// Mock moment-timezone
jest.mock('moment-timezone', () => {
  const moment = jest.requireActual('moment-timezone');
  moment.tz.guess = jest.fn().mockReturnValue('America/Chicago');
  moment.tz = jest.fn().mockImplementation((date, timezone) => {
    return {
      format: jest.fn().mockReturnValue('2023-05-17'),
      toISOString: jest.fn().mockReturnValue('2023-05-17T10:00:00.000Z'),
      subtract: jest.fn().mockReturnValue({
        format: jest.fn().mockReturnValue('2023-05-16')
      }),
      isBetween: jest.fn().mockReturnValue(true),
      diff: jest.fn().mockReturnValue(2),
      hour: jest.fn().mockReturnValue(10),
      minute: jest.fn().mockReturnValue(0)
    };
  });
  
  return moment;
});

// Setup mock state setters
const setMessage = jest.fn();
const setEmployeeInfo = jest.fn();
const setErrors = jest.fn();
const setAttendanceUpdated = jest.fn();
const setUserEvents = jest.fn();
const setPendingEvents = jest.fn();
const setScheduledEvents = jest.fn();

describe('QRScannerService', () => {
  let service;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create service instance
    service = QRScannerService(
      setMessage,
      setEmployeeInfo,
      setErrors,
      setAttendanceUpdated,
      setUserEvents,
      setPendingEvents,
      setScheduledEvents,
      'SUPER_ADMIN',
      false
    );
  });
  
  describe('fetchEventTypesAndLocations', () => {
    test('should fetch event types and locations from database', async () => {
      // Setup mock data
      const mockEventTypeCategories = {
        workshops: 'Workshop',
        meetings: 'Meeting',
        haciendas: 'Hacienda'
      };
      
      const mockEventTypes = {
        workshops: {
          displayName: 'PO Workshop',
          name: 'workshops',
          description: 'Workshop events'
        },
        meetings: {
          displayName: 'PO Meeting',
          name: 'meetings',
          description: 'Meeting events'
        }
      };
      
      const mockLocations = {
        'west-chicago': {
          name: 'West Chicago',
          address: '123 Main St'
        },
        'aurora': {
          name: 'Aurora',
          address: '456 Oak Ave'
        }
      };
      
      // Setup mock responses
      get.mockImplementation((dbRef) => {
        // Check which path is being requested
        const refPath = dbRef.toString();
        
        if (refPath.includes('eventTypeCategories')) {
          return Promise.resolve({
            exists: () => true,
            val: () => mockEventTypeCategories
          });
        }
        
        if (refPath.includes('eventTypes')) {
          return Promise.resolve({
            exists: () => true,
            val: () => mockEventTypes
          });
        }
        
        if (refPath.includes('locations')) {
          return Promise.resolve({
            exists: () => true,
            val: () => mockLocations
          });
        }
        
        // Default for meetingTypes
        return Promise.resolve({
          exists: () => false,
          val: () => null
        });
      });
      
      // Call the function
      const result = await service.fetchEventTypesAndLocations();
      
      // Assertions
      expect(result.eventTypes).toEqual(mockEventTypeCategories);
      expect(result.locations).toEqual(['west-chicago', 'aurora']);
      expect(result.defaultType).toBe('workshops');
      expect(result.eventTypeDisplayNames).toEqual({
        workshops: 'PO Workshop',
        meetings: 'PO Meeting'
      });
      
      // Verify Firebase was called correctly
      expect(ref).toHaveBeenCalledWith(database, 'eventTypeCategories');
      expect(ref).toHaveBeenCalledWith(database, 'eventTypes');
      expect(ref).toHaveBeenCalledWith(database, 'locations');
    });
    
    test('should handle errors and return empty data', async () => {
      // Setup mock to throw error
      get.mockRejectedValue(new Error('Database error'));
      
      // Call function
      const result = await service.fetchEventTypesAndLocations();
      
      // Assertions - should return empty objects
      expect(result.eventTypes).toEqual({});
      expect(result.locations).toEqual([]);
      expect(result.eventTypeDisplayNames).toEqual({});
      
      // Should set error
      expect(setErrors).toHaveBeenCalled();
    });
  });
  
  describe('handleClockIn', () => {
    test('should correctly process a clock-in scan', async () => {
      // Mock user data
      const mockUserData = {
        name: 'John Doe',
        profile: {
          position: 'Member',
          name: 'John Doe'
        },
        stats: {
          daysPresent: 10,
          daysLate: 2
        }
      };
      
      // Mock response for user fetch
      get.mockResolvedValueOnce({
        exists: () => true,
        val: () => mockUserData
      });
      
      // Call the function
      await service.handleClockIn(
        'user123',
        'west-chicago',
        'clock-in',
        'workshops',
        '',
        null
      );
      
      // Assertions
      expect(update).toHaveBeenCalled();
      
      // Should record attendance in correct path format
      expect(ref).toHaveBeenCalledWith(
        database,
        expect.stringContaining('attendance/west-chicago/2023-05-17/')
      );
      
      // Should update employee info
      expect(setEmployeeInfo).toHaveBeenCalledWith(expect.objectContaining({
        name: 'John Doe',
        position: 'Member'
      }));
      
      // Should show success message
      expect(setMessage).toHaveBeenCalledWith(expect.stringContaining('Clock-in successful'));
    });
  });
  
  describe('fetchUserEvents', () => {
    test('should fetch and process user events correctly', async () => {
      // Mock user data with events
      const mockUserData = {
        events: {
          workshops: {
            'event1': {
              date: '2023-05-17T09:00:00.000Z',
              title: 'Morning Workshop',
              scheduled: true,
              attended: false
            }
          },
          meetings: {
            'event2': {
              date: '2023-05-18T13:00:00.000Z',
              title: 'Team Meeting',
              scheduled: true,
              attended: false
            }
          }
        }
      };
      
      // Mock responses
      get.mockResolvedValueOnce({
        exists: () => true,
        val: () => mockUserData
      });
      
      // Mock empty attendance data
      get.mockResolvedValue({
        exists: () => false,
        val: () => null
      });
      
      // Call the function
      const result = await service.fetchUserEvents('user123');
      
      // Assertions
      expect(result.pendingEvents.length).toBe(2);
      expect(setUserEvents).toHaveBeenCalled();
      expect(setPendingEvents).toHaveBeenCalled();
      
      // Verify events were processed correctly
      const pendingEvents = result.pendingEvents;
      expect(pendingEvents.some(e => e.title === 'Morning Workshop')).toBeTruthy();
      expect(pendingEvents.some(e => e.title === 'Team Meeting')).toBeTruthy();
    });
  });
  
  describe('fetchScheduledEvents', () => {
    test('should fetch events for today from database', async () => {
      // Mock events data
      const mockEvents = {
        'event1': {
          title: 'Morning Workshop',
          start: '2023-05-17T09:00:00.000Z',
          end: '2023-05-17T11:00:00.000Z',
          eventType: 'workshops',
          location: 'west-chicago'
        },
        'event2': {
          title: 'Evening Meeting',
          start: '2023-05-17T18:00:00.000Z',
          end: '2023-05-17T19:00:00.000Z',
          eventType: 'meetings',
          location: 'aurora'
        }
      };
      
      // Mock response
      get.mockResolvedValueOnce({
        exists: () => true,
        val: () => mockEvents
      });
      
      // Call function with location filter
      const result = await service.fetchScheduledEvents('west-chicago');
      
      // Should set scheduled events state
      expect(setScheduledEvents).toHaveBeenCalled();
      
      // Should only return matching location events
      expect(result.length).toBe(1);
      expect(result[0].title).toBe('Morning Workshop');
    });
  });
});