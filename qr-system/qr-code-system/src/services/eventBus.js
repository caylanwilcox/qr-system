// src/services/eventBus.js - Updated to ensure proper event handling
/**
 * Enhanced EventBus Service
 * 
 * Provides a centralized event system with improved debugging and reliability
 */

// Define event types as constants to avoid typos and ensure consistency
export const EVENTS = {
    ATTENDANCE_UPDATED: 'attendance:updated',
    USER_DATA_UPDATED: 'user:dataUpdated',
    EVENT_UPDATED: 'event:updated',
    DASHBOARD_DATA_UPDATED: 'dashboard:dataUpdated',
    // Add other event types here
  };
  
  class EventBus {
    constructor() {
      this.listeners = {};
      this.debug = process.env.NODE_ENV !== 'production';
    }
  
    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    subscribe(event, callback) {
      if (this.debug) {
        console.log(`📢 [EventBus] Subscribing to event: ${event}`);
      }
  
      // Initialize array if it doesn't exist
      if (!this.listeners[event]) {
        this.listeners[event] = [];
      }
  
      this.listeners[event].push(callback);
  
      if (this.debug) {
        console.log(`📢 [EventBus] Adding subscriber to event: ${event}, total subscribers: ${this.listeners[event].length}`);
      }
  
      // Return unsubscribe function
      return () => {
        if (this.debug) {
          console.log(`📢 [EventBus] Unsubscribing from event: ${event}`);
        }
        
        const index = this.listeners[event].indexOf(callback);
        if (index > -1) {
          this.listeners[event].splice(index, 1);
        }
        
        if (this.debug) {
          console.log(`📢 [EventBus] Remaining subscribers for ${event}: ${this.listeners[event]?.length || 0}`);
        }
      };
    }
  
    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {any} data - Event data
     */
    emit(event, data = {}) {
      if (this.debug) {
        console.log(`📢 [EventBus] Emitting event: ${event}`, data);
      }
  
      // Add event name to data for identification in listeners
      const eventData = {
        ...data,
        _eventName: event,
        _timestamp: new Date().toISOString()
      };
  
      if (!this.listeners[event]) {
        if (this.debug) {
          console.log(`📢 [EventBus] No listeners for event: ${event}`);
        }
        return;
      }
  
      // Notify all listeners
      this.listeners[event].forEach(callback => {
        try {
          callback(eventData);
        } catch (error) {
          console.error(`📢 [EventBus] Error in listener for ${event}:`, error);
        }
      });
  
      if (this.debug) {
        console.log(`📢 [EventBus] Event ${event} emitted to ${this.listeners[event].length} listeners`);
      }
    }
  
    /**
     * Subscribe to all events (for debugging)
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    subscribeToAll(callback) {
      const event = '*';
      if (!this.listeners[event]) {
        this.listeners[event] = [];
      }
  
      this.listeners[event].push(callback);
  
      // Return unsubscribe function
      return () => {
        const index = this.listeners[event].indexOf(callback);
        if (index > -1) {
          this.listeners[event].splice(index, 1);
        }
      };
    }
  }
  
  // Export a singleton instance
  export const eventBus = new EventBus();
  
  export default eventBus;