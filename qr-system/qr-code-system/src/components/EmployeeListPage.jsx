import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import { database } from '../services/firebaseConfig';
import { Activity, Calendar, Users, Clock } from 'lucide-react';
import './EmployeeListPage.css';

// Reuse the getScoreClass function from the paste.txt component
const getScoreClass = (score) => {
  const numScore = parseFloat(score);
  if (numScore >= 95) return 'bg-emerald-400';
  if (numScore >= 85) return 'bg-green-400';
  if (numScore >= 75) return 'bg-teal-400';
  if (numScore >= 65) return 'bg-yellow-400';
  if (numScore >= 55) return 'bg-orange-400';
  if (numScore >= 45) return 'bg-red-400';
  return 'bg-red-600';
};

// Status indicator component
const AttendanceIndicator = ({ score }) => (
  <div
    className={`w-3 h-3 rounded-full ${getScoreClass(score)} inline-block mr-2`}
    title={`Attendance: ${score}%`}
  />
);

// Event category attendance indicator
const EventCategoryIndicator = ({ events = [], total = 0 }) => {
  const attendanceRate = events.length > 0 
    ? ((events.filter(e => e.attended).length / events.length) * 100).toFixed(1) 
    : 0;
  
  return (
    <div 
      className={`w-4 h-4 rounded-full ${getScoreClass(attendanceRate)} flex items-center justify-center`} 
      title={`Attendance: ${attendanceRate}%`}
    >
      <span className="text-xs text-white font-bold">{events.length}</span>
    </div>
  );
};

export default function EmployeeListPage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    // Fetch all user records from Firebase
    const usersRef = ref(database, 'users');
    const unsubscribe = onValue(
      usersRef,
      (snapshot) => {
        try {
          const data = snapshot.val() || {};
          const userArray = [];

          // Convert each user object into a friendlier format
          Object.entries(data).forEach(([userId, userRecord]) => {
            if (userRecord?.profile) {
              const { name, role, status, primaryLocation } = userRecord.profile;
              
              // Calculate attendance stats
              const stats = userRecord?.stats || {};
              const events = userRecord?.events || {};
              
              // Get event data
              const workshops = events.workshops || [];
              const meetings = events.meetings || [];
              const haciendas = events.haciendas || [];
              const juntaHacienda = events.juntaHacienda || [];
              
              // Calculate weighted attendance score for the user
              // Define weights for different event types (adjust as needed)
              const weights = {
                workshops: 0.25,    // 25% weight for workshops
                meetings: 0.25,     // 25% weight for meetings
                haciendas: 0.3,     // 30% weight for haciendas
                juntaHacienda: 0.2  // 20% weight for junta hacienda
              };
              
              // Calculate attendance rate for each event type
              const workshopRate = workshops.length ? 
                (workshops.filter(e => e.attended).length / workshops.length * 100) : 0;
              
              const meetingsRate = meetings.length ? 
                (meetings.filter(e => e.attended).length / meetings.length * 100) : 0;
              
              const haciendasRate = haciendas.length ? 
                (haciendas.filter(e => e.attended).length / haciendas.length * 100) : 0;
              
              const juntaRate = juntaHacienda.length ? 
                (juntaHacienda.filter(e => e.attended).length / juntaHacienda.length * 100) : 0;
              
              // Calculate weighted average score
              let weightedScore = 0;
              let totalWeight = 0;
              
              if (workshops.length) {
                weightedScore += workshopRate * weights.workshops;
                totalWeight += weights.workshops;
              }
              
              if (meetings.length) {
                weightedScore += meetingsRate * weights.meetings;
                totalWeight += weights.meetings;
              }
              
              if (haciendas.length) {
                weightedScore += haciendasRate * weights.haciendas;
                totalWeight += weights.haciendas;
              }
              
              if (juntaHacienda.length) {
                weightedScore += juntaRate * weights.juntaHacienda;
                totalWeight += weights.juntaHacienda;
              }
              
              // Calculate final weighted attendance rate
              const weightedAttendanceRate = totalWeight > 0 
                ? (weightedScore / totalWeight).toFixed(1) 
                : 0;
              
              // Also calculate regular attendance for completeness
              const totalDays = (stats.daysPresent || 0) + (stats.daysAbsent || 0);
              const regularAttendanceRate = totalDays ? ((stats.daysPresent || 0) / totalDays * 100).toFixed(1) : 0;
              
              userArray.push({
                id: userId,
                name: name || 'Unknown',
                role: role || 'Unknown',
                status: status || 'unknown',
                location: primaryLocation || 'unknown',
                attendanceRate: weightedAttendanceRate, // Use weighted score for the indicator
                regularAttendanceRate,                  // Keep this for reference if needed
                events: {
                  workshops: workshops,
                  meetings: meetings,
                  haciendas: haciendas,
                  juntaHacienda: juntaHacienda
                }
              });
            }
          });

          setEmployees(userArray);
          setLoading(false);
        } catch (err) {
          setError(err.message);
          setLoading(false);
        }
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    // Cleanup subscription
    return () => unsubscribe();
  }, []);

  // Handler for "Back" button – navigates one step back in history
  const handleBackClick = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="employee-list-page">
        <div className="glass-card p-4 text-center">
          <h2>Loading employees...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="employee-list-page">
        <div className="glass-card p-4 text-center">
          <h2>Error</h2>
          <p>{error}</p>
          <button className="back-button" onClick={handleBackClick}>
            ← Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="employee-list-page">
      <div className="glass-card p-4">
        {/* Back button at the top */}
        <button className="back-button" onClick={handleBackClick}>
          ← Back
        </button>

        <h1 className="employee-list-title">Employee List Page</h1>
        <p className="employee-list-subtitle">
          Below is a list of all users in the system.
        </p>
        
        {/* Legend for attendance indicators */}
        <div className="mb-4 p-2 bg-slate-800/30 rounded-lg">
          <h3 className="text-sm font-medium text-white/80 mb-2">Attendance Legend:</h3>
          <div className="space-y-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-emerald-400 mr-2"></div>
                <span className="text-xs">Excellent (95%+)</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-green-400 mr-2"></div>
                <span className="text-xs">Good (85%+)</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-yellow-400 mr-2"></div>
                <span className="text-xs">Average (65%+)</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-red-400 mr-2"></div>
                <span className="text-xs">Needs Improvement (&lt;65%)</span>
              </div>
            </div>
            <div className="text-xs bg-slate-800/50 p-2 rounded">
              <span className="font-medium">Note:</span> The color next to employee names shows their weighted attendance score across all event types (Workshops: 25%, Meetings: 25%, Haciendas: 30%, Junta: 20%)
            </div>
          </div>
        </div>

        {/* Table of employees */}
        <table className="employee-list-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Status</th>
              <th>Location</th>
              <th className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span className="hidden md:inline">Workshops</span>
                </div>
              </th>
              <th className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Users className="w-4 h-4" />
                  <span className="hidden md:inline">Meetings</span>
                </div>
              </th>
              <th className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Activity className="w-4 h-4" />
                  <span className="hidden md:inline">Haciendas</span>
                </div>
              </th>
              <th className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span className="hidden md:inline">Junta</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id}>
                <td>
                  <div className="flex items-center">
                    <AttendanceIndicator score={emp.attendanceRate} />
                    {emp.name}
                  </div>
                </td>
                <td>{emp.role}</td>
                <td>{emp.status}</td>
                <td>{emp.location}</td>
                <td className="text-center">
                  <div className="flex justify-center">
                    <EventCategoryIndicator 
                      events={emp.events.workshops} 
                      total={12} 
                    />
                  </div>
                </td>
                <td className="text-center">
                  <div className="flex justify-center">
                    <EventCategoryIndicator 
                      events={emp.events.meetings} 
                      total={4} 
                    />
                  </div>
                </td>
                <td className="text-center">
                  <div className="flex justify-center">
                    <EventCategoryIndicator 
                      events={emp.events.haciendas} 
                      total={52} 
                    />
                  </div>
                </td>
                <td className="text-center">
                  <div className="flex justify-center">
                    <EventCategoryIndicator 
                      events={emp.events.juntaHacienda} 
                      total={12} 
                    />
                  </div>
                </td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '1rem' }}>
                  No employees found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}