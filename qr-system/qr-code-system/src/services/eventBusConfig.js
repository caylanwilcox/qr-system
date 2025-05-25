// src/services/eventBus.js
/**
 * Simple event bus implementation for application-wide events
 * Provides a centralized way to emit and subscribe to events across components
 */
class EventBus {
  constructor() {
    this.subscribers = {};
    this.debugMode = false;
  }

  /**
   * Enable or disable debug logging
   * @param {boolean} enabled - Whether debug mode should be enabled
   */
  setDebug(enabled) {
    this.debugMode = !!enabled;
  }

  /**
   * Log a message if debug mode is enabled
   * @param {string} message - Message to log
   * @param {any} data - Optional data to log
   */
  debug(message, data = null) {
    if (this.debugMode) {
      console.log(`[EventBus] ${message}`, data || '');
    }
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name to subscribe to
   * @param {Function} callback - Function to call when event is emitted
   * @returns {Function} - Unsubscribe function
   */
  subscribe(event, callback) {
    if (!event || typeof callback !== 'function') {
      console.error('[EventBus] Invalid subscription parameters:', { event, callback });
      return () => {}; // Return empty function to avoid errors
    }

    if (!this.subscribers[event]) {
      this.subscribers[event] = [];
    }

    this.subscribers[event].push(callback);
    this.debug(`Subscribed to "${event}" - Total subscribers: ${this.subscribers[event].length}`);

    // Return an unsubscribe function
    return () => {
      this.unsubscribe(event, callback);
    };
  }

  /**
   * Unsubscribe from an event
   * @param {string} event - Event name to unsubscribe from
   * @param {Function} callback - Callback function to remove
   */
  unsubscribe(event, callback) {
    if (!this.subscribers[event]) {
      return;
    }

    const index = this.subscribers[event].indexOf(callback);
    if (index !== -1) {
      this.subscribers[event].splice(index, 1);
      this.debug(`Unsubscribed from "${event}" - Remaining subscribers: ${this.subscribers[event].length}`);
    }
  }

  /**
   * Emit an event
   * @param {string} event - Event name to emit
   * @param {any} data - Data to pass to subscribers
   */
  emit(event, data = null) {
    if (!this.subscribers[event] || this.subscribers[event].length === 0) {
      this.debug(`Event "${event}" emitted but no subscribers`);
      return;
    }

    this.debug(`Emitting "${event}" with data:`, data);
    this.subscribers[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`[EventBus] Error in subscriber for "${event}":`, error);
      }
    });
  }

  /**
   * Remove all subscribers for an event
   * @param {string} event - Event to clear subscribers for
   */
  clear(event) {
    if (event) {
      this.subscribers[event] = [];
      this.debug(`Cleared all subscribers for "${event}"`);
    } else {
      this.subscribers = {};
      this.debug('Cleared all subscribers for all events');
    }
  }

  /**
   * Get the number of subscribers for an event
   * @param {string} event - Event name
   * @returns {number} - Number of subscribers
   */
  subscriberCount(event) {
    if (!this.subscribers[event]) {
      return 0;
    }
    return this.subscribers[event].length;
  }
}

// Export a singleton instance
export const eventBus = new EventBus();

// For direct import
export default eventBus;