// src/components/QRSCANNER/index.js
// Main export file that brings together all scanner components

import QRScannerPage from './QRScannerPage';
import Scanner from './Scanner';
import PendingEvents from './PendingEvents';
import SettingsPanel from './SettingsPanel';
import EmployeeInfo from './EmployeeInfo';
import EventSelector from './EventSelector';
import MessageBanner from './MessageBanner';
import { eventBus, EVENTS } from '../../services/eventBus';

// Add a custom initialize function to ensure we emit events when testing
const emitTestEvents = () => {
  console.log('🧪 [QRScanner] Emitting test events to validate event propagation');
  
  // Create test data
  const testData = {
    userId: 'test-user-12345',
    action: 'clockIn',
    timestamp: new Date().toISOString(),
    location: 'Aurora',
    eventId: null,
    testMode: true
  };
  
  // Emit events
  setTimeout(() => {
    console.log('🧪 [QRScanner] Emitting ATTENDANCE_UPDATED event');
    eventBus.emit(EVENTS.ATTENDANCE_UPDATED, testData);
  }, 1000);
  
  setTimeout(() => {
    console.log('🧪 [QRScanner] Emitting USER_DATA_UPDATED event');
    eventBus.emit(EVENTS.USER_DATA_UPDATED, {
      ...testData,
      updateType: 'attendance'
    });
  }, 2000);
  
  setTimeout(() => {
    console.log('🧪 [QRScanner] Emitting DASHBOARD_DATA_UPDATED event');
    eventBus.emit(EVENTS.DASHBOARD_DATA_UPDATED, {
      ...testData,
      type: 'attendance'
    });
  }, 3000);
  
  return true;
};

// Export all components for use elsewhere in the app
export {
  QRScannerPage,  // Main component
  Scanner,        // QR/barcode scanning component
  SettingsPanel,  // Settings panel component
  EmployeeInfo,   // Employee information display
  EventSelector,  // Event selection modal
  PendingEvents,  // Pending events list
  MessageBanner,  // Status message display
  emitTestEvents  // Test function for event propagation
};

// Default export the main page component
export default QRScannerPage;