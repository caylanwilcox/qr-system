// src/components/Scheduler/utils/types.ts
export interface Event {
    id?: string;
    title: string;
    start: Date;
    end: Date;
    description?: string;
    location: string;
    attendees?: string[];
    color?: string;
    isUrgent?: boolean;
    isOptional?: boolean;
    isCompleted?: boolean;
    createdAt?: string;
    updatedAt?: string;
    createdBy?: string;
    type?: 'default' | 'meeting' | 'task' | 'reminder';
  }
  
  export interface SchedulerContextType {
    // UI State
    loading: boolean;
    error: string | null;
    view: string;
    setView: (view: string) => void;
    date: Date;
    setDate: (date: Date) => void;
    showEventDialog: boolean;
    setShowEventDialog: (show: boolean) => void;
    
    // Data State
    events: Event[];
    selectedEvent: Event | null;
    setSelectedEvent: (event: Event | null) => void;
    locations: string[];
    
    // Event Handlers
    handleCreateEvent: (event: Omit<Event, 'id'>) => Promise<void>;
    handleUpdateEvent: (eventId: string, event: Omit<Event, 'id'>) => Promise<void>;
    handleDeleteEvent: (eventId: string) => Promise<void>;
    
    // Helper Functions
    getEventsForDay: (date: Date) => Event[];
    getEventsForLocation: (location: string) => Event[];
  }