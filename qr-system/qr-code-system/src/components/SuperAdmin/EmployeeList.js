'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../../services/firebaseConfig';
import { User, TrendingUp, TrendingDown, Search, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const EmployeeList = ({ colorFilter }) => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  useEffect(() => {
    const usersRef = ref(database, 'users');
    
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      const employeeList = Object.entries(data)
        .map(([id, user]) => ({
          id,
          name: user.name || 'N/A',
          position: user.position || 'N/A',
          location: user.location || 'N/A',
          padrinoColor: user.padrinoColor || 'N/A',
          stats: {
            attendanceRate: calculateAttendanceRate(user.stats),
            onTimeRate: calculateOnTimeRate(user.stats),
            rankChange: user.stats?.rankChange
          }
        }));

      setEmployees(employeeList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const calculateAttendanceRate = (stats) => {
    if (!stats) return 0;
    const total = (stats.daysPresent || 0) + (stats.daysAbsent || 0);
    return total > 0 ? ((stats.daysPresent || 0) / total * 100).toFixed(1) : 0;
  };

  const calculateOnTimeRate = (stats) => {
    if (!stats || !stats.daysPresent) return 0;
    const onTime = stats.daysPresent - (stats.daysLate || 0);
    return ((onTime / stats.daysPresent) * 100).toFixed(1);
  };

  const getColorClass = (color) => {
    const colors = {
      blue: 'text-blue-400 bg-blue-500',
      green: 'text-green-400 bg-green-500',
      red: 'text-red-400 bg-red-500',
      orange: 'text-orange-400 bg-orange-500'
    };
    return colors[color?.toLowerCase()] || 'text-gray-400 bg-gray-500';
  };

  const sortedEmployees = useMemo(() => {
    let filteredList = [...employees];
    
    if (searchTerm) {
      filteredList = filteredList.filter(emp => 
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.position.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (colorFilter) {
      filteredList = filteredList.filter(emp => 
        emp.padrinoColor?.toLowerCase() === colorFilter.replace('padrinos', '').toLowerCase()
      );
    }

    filteredList.sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];
      
      if (sortConfig.key === 'stats.attendanceRate' || sortConfig.key === 'stats.onTimeRate') {
        aValue = Number(a.stats[sortConfig.key.split('.')[1]]);
        bValue = Number(b.stats[sortConfig.key.split('.')[1]]);
      }
      
      return sortConfig.direction === 'asc' 
        ? aValue < bValue ? -1 : 1
        : aValue > bValue ? -1 : 1;
    });

    return filteredList;
  }, [employees, searchTerm, sortConfig, colorFilter]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleEmployeeClick = (employeeId) => {
    navigate(`/super-admin/users/${employeeId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="sticky top-0 z-10 bg-opacity-90 bg-gray-900 backdrop-blur-sm p-4 rounded-t-lg border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white">Employees ({sortedEmployees.length})</h3>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-gray-800 bg-opacity-50 rounded-lg border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-4 gap-4 text-sm font-medium text-gray-400">
          <div className="cursor-pointer hover:text-white" onClick={() => handleSort('name')}>
            Employee
          </div>
          <div className="cursor-pointer hover:text-white text-center" onClick={() => handleSort('stats.attendanceRate')}>
            Attendance
          </div>
          <div className="cursor-pointer hover:text-white text-center" onClick={() => handleSort('stats.onTimeRate')}>
            On Time
          </div>
          <div className="cursor-pointer hover:text-white text-right" onClick={() => handleSort('padrinoColor')}>
            Rank
          </div>
        </div>
      </div>

      <div className="employees-list overflow-auto max-h-[calc(100vh-240px)]">
        {sortedEmployees.map((employee) => (
          <div
            key={employee.id}
            onClick={() => handleEmployeeClick(employee.id)}
            className="bg-opacity-20 bg-gray-800 backdrop-blur-sm rounded-lg shadow-sm p-4 mb-3 border border-gray-700 cursor-pointer hover:bg-opacity-30 transition-all duration-200"
          >
            <div className="grid grid-cols-4 gap-4 items-center">
              <div className="flex items-center space-x-4">
                <div className={`${getColorClass(employee.padrinoColor)} bg-opacity-20 p-2 rounded-full`}>
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-medium text-white">{employee.name}</h4>
                  <p className="text-sm text-gray-300">
                    {employee.location.replace('Agua Viva ', '')} • {employee.position}
                  </p>
                </div>
              </div>

              <div className="text-center">
                <div className="text-sm font-medium text-gray-300">Attendance</div>
                <div className={`text-sm font-bold ${
                  Number(employee.stats.attendanceRate) >= 75 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {employee.stats.attendanceRate}%
                </div>
              </div>

              <div className="text-center">
                <div className="text-sm font-medium text-gray-300">On Time</div>
                <div className={`text-sm font-bold ${
                  Number(employee.stats.onTimeRate) >= 90 ? 'text-green-400' 
                  : Number(employee.stats.onTimeRate) >= 75 ? 'text-yellow-400' 
                  : 'text-red-400'
                }`}>
                  {employee.stats.onTimeRate}%
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm font-medium text-gray-300">Rank</div>
                <div className="flex items-center justify-end space-x-1">
                  <span className={`text-sm font-bold ${getColorClass(employee.padrinoColor)}`}>
                    {employee.padrinoColor || 'N/A'}
                  </span>
                  {employee.stats.rankChange &&
                    Date.now() - new Date(employee.stats.rankChange.date).getTime() <= 30 * 24 * 60 * 60 * 1000 && (
                    employee.stats.rankChange.direction === 'up' ? (
                      <TrendingUp className="h-4 w-4 text-green-400" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-400" />
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EmployeeList;