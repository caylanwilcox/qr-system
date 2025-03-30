import React, { useState, useEffect } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { ref, get } from 'firebase/database';
import { database } from '../../services/firebaseConfig';
import { Loader2, AlertCircle, Filter, X } from 'lucide-react';
import './EmployeeList.css';

const EmployeeList = () => {
  const { location: locationParam } = useParams();
  const [employeeList, setEmployeeList] = useState([]);
  const [filteredList, setFilteredList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState({});
  
  // Get location state and query parameters
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  
  // Get filter parameters from either location state or URL query params
  const filterFromState = location.state?.filter;
  const dateFromState = location.state?.date;
  const expectedCount = location.state?.count;
  
  const filterFromQuery = queryParams.get('filter');
  const colorFromQuery = queryParams.get('color');
  const dateFromQuery = queryParams.get('date');
  
  // Determine which filter to use, prioritizing state over query params
  const filter = filterFromState || filterFromQuery || 'all';
  const filterDate = dateFromState || dateFromQuery || new Date().toISOString().split('T')[0];
  
  console.log('-------- EMPLOYEE LIST INITIALIZATION --------');
  console.log('Filter from state:', filterFromState);
  console.log('Date from state:', dateFromState);
  console.log('Expected count from state:', expectedCount);
  console.log('Filter from query:', filterFromQuery);
  console.log('Color from query:', colorFromQuery);
  console.log('Date from query:', dateFromQuery);
  console.log('Final filter being used:', filter);
  console.log('Final date being used:', filterDate);
  
  // Set up page title based on filter
  const getPageTitle = () => {
    if (filter === 'all') return 'All Members';
    if (filter === 'orejas') return 'Orejas Members';
    if (filter === 'apoyos') return 'Apoyos Members';
    if (filter === 'absent') return `Absent Employees (${filterDate})`;
    if (filter === 'present') return `Present Employees (${filterDate})`;
    if (filter === 'late') return `Late Employees (${filterDate})`;
    if (filter === 'onTime') return `On-Time Employees (${filterDate})`;
    if (filter === 'padrino' && colorFromQuery) {
      return `Padrinos (${colorFromQuery.charAt(0).toUpperCase() + colorFromQuery.slice(1)})`;
    }
    return 'Employee List';
  };

  // Handle clear filter button
  const handleClearFilter = () => {
    navigate('/employee-list');
  };

  useEffect(() => {
    const fetchEmployeeList = async () => {
      try {
        console.log('-------- FETCHING EMPLOYEE DATA --------');
        // Query all users
        const usersRef = ref(database, 'users');
        const snapshot = await get(usersRef);
        
        if (!snapshot.exists()) {
          throw new Error('No employee data found');
        }
        
        const data = snapshot.val();
        console.log(`Raw data fetched: ${Object.keys(data).length} records`);
        
        // Transform data to array with detailed logging
        const employeeData = Object.entries(data).map(([id, user]) => {
          const employee = {
            employeeId: id,
            name: user.profile?.name || 'No Name',
            service: user.profile?.service || '',
            padrino: user.profile?.padrino || false,
            padrinoColor: user.profile?.padrinoColor || null,
            status: user.profile?.status || 'inactive',
            primaryLocation: user.profile?.primaryLocation || 'Unknown',
            lastClockIn: user.stats?.lastClockIn || null,
            daysPresent: user.stats?.daysPresent || 0,
            daysAbsent: user.stats?.daysAbsent || 0,
            daysLate: user.stats?.daysLate || 0,
            attendanceRate: user.stats?.attendanceRate || 0
          };
          return employee;
        });
        
        console.log(`Transformed to ${employeeData.length} employee records`);
        
        // Count initial metrics for debugging
        const initialMetrics = {
          total: employeeData.length,
          active: employeeData.filter(e => e.status === 'active').length,
          inactive: employeeData.filter(e => e.status === 'inactive').length,
          clockedIn: employeeData.filter(e => e.lastClockIn !== null).length,
          notClockedIn: employeeData.filter(e => e.lastClockIn === null).length,
          byLocation: {}
        };
        
        // Count by location
        employeeData.forEach(emp => {
          const loc = emp.primaryLocation;
          if (!initialMetrics.byLocation[loc]) initialMetrics.byLocation[loc] = 0;
          initialMetrics.byLocation[loc]++;
        });
        
        console.log('Initial metrics:', initialMetrics);
        setDebugInfo(prev => ({ ...prev, initialMetrics }));
        
        setEmployeeList(employeeData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching employee list:', error);
        setError(error.message);
        setLoading(false);
      }
    };

    fetchEmployeeList();
  }, []);

  // Apply filters whenever the filter parameter or employee list changes
  useEffect(() => {
    if (employeeList.length === 0) return;
    
    console.log('-------- APPLYING FILTERS --------');
    console.log(`Starting with ${employeeList.length} employees`);
    console.log('Filter type:', filter);
    console.log('Filter date:', filterDate);
    console.log('Expected count:', expectedCount);
    
    let filtered = [...employeeList];
    const filterSteps = {};
    
    // Step 1: Apply status filter - default to active employees only
    // This is where the discrepancy might be happening - do we want inactive employees?
    const includeInactive = filter === 'absent'; // Only include inactive for absent filter
    if (!includeInactive) {
      filtered = filtered.filter(employee => employee.status === 'active');
      filterSteps.activeOnly = filtered.length;
      console.log(`After active-only filter: ${filtered.length} employees`);
    } else {
      filterSteps.allStatuses = filtered.length;
      console.log(`Keeping all statuses (active and inactive): ${filtered.length} employees`);
    }
    
    // Step 2: Apply filter based on query parameters
    if (filter === 'orejas') {
      filtered = filtered.filter(employee => employee.service === 'RSG');
      filterSteps.orejasFilter = filtered.length;
      console.log(`After orejas filter: ${filtered.length} employees`);
    } else if (filter === 'apoyos') {
      filtered = filtered.filter(employee => employee.service === 'COM');
      filterSteps.apoyosFilter = filtered.length;
      console.log(`After apoyos filter: ${filtered.length} employees`);
    } else if (filter === 'padrino' && colorFromQuery) {
      filtered = filtered.filter(employee => 
        employee.padrino === true && 
        employee.padrinoColor?.toLowerCase() === colorFromQuery.toLowerCase()
      );
      filterSteps.padrinoFilter = filtered.length;
      console.log(`After padrino filter (color=${colorFromQuery}): ${filtered.length} employees`);
    } else if (filter === 'absent') {
      filtered = filtered.filter(employee => employee.lastClockIn === null);
      filterSteps.absentFilter = filtered.length;
      console.log(`After absent filter: ${filtered.length} employees`);
    } else if (filter === 'present') {
      filtered = filtered.filter(employee => employee.lastClockIn !== null);
      filterSteps.presentFilter = filtered.length;
      console.log(`After present filter: ${filtered.length} employees`);
    } else if (filter === 'late') {
      filtered = filtered.filter(employee => employee.daysLate > 0);
      filterSteps.lateFilter = filtered.length;
      console.log(`After late filter: ${filtered.length} employees`);
    } else if (filter === 'onTime') {
      filtered = filtered.filter(employee => 
        employee.lastClockIn !== null && employee.daysLate === 0
      );
      filterSteps.onTimeFilter = filtered.length;
      console.log(`After onTime filter: ${filtered.length} employees`);
    }
    
    // Step 3: Apply location filter if provided
    if (locationParam && locationParam !== 'all') {
      filtered = filtered.filter(
        employee => employee.primaryLocation === locationParam
      );
      filterSteps.locationFilter = filtered.length;
      console.log(`After location filter (${locationParam}): ${filtered.length} employees`);
    }
    
    // Log detailed breakdown for absence/presence
    const statusBreakdown = {
      active: filtered.filter(e => e.status === 'active').length,
      inactive: filtered.filter(e => e.status === 'inactive').length,
      withClockIn: filtered.filter(e => e.lastClockIn !== null).length,
      withoutClockIn: filtered.filter(e => e.lastClockIn === null).length
    };
    
    console.log('Final status breakdown:', statusBreakdown);
    
    // Log comparison with expected count
    if (expectedCount !== undefined) {
      console.log(`IMPORTANT - Expected count: ${expectedCount}, Actual count: ${filtered.length}`);
      console.log(`Difference: ${filtered.length - expectedCount}`);
      
      if (filtered.length !== expectedCount) {
        console.log('MISMATCH DETECTED: The filtered count does not match the expected count!');
        
        // Debugging: list of employees that might be causing the discrepancy
        if (filter === 'absent') {
          const inactiveAbsent = filtered.filter(e => e.status === 'inactive' && e.lastClockIn === null);
          console.log(`Number of INACTIVE absent employees: ${inactiveAbsent.length}`);
          console.log('Inactive absent employees:', inactiveAbsent.map(e => e.name));
        }
      }
    }
    
    // Save all debug info
    setDebugInfo(prev => ({ 
      ...prev, 
      filterSteps, 
      statusBreakdown,
      finalCount: filtered.length,
      expectedCount,
      difference: filtered.length - (expectedCount || 0)
    }));
    
    setFilteredList(filtered);
  }, [employeeList, filter, colorFromQuery, locationParam, filterDate, expectedCount]);

  if (loading) {
    return <div className="loading-overlay"><Loader2 className="animate-spin h-8 w-8 text-blue-500" /><p>Loading employee list...</p></div>;
  }

  if (error) {
    return (
      <div className="error-container">
        <AlertCircle className="h-5 w-5 text-red-500" />
        <p>Error fetching employee list: {error}</p>
      </div>
    );
  }

  return (
    <div className="employee-list-container">
      <div className="list-header">
        <h2>{getPageTitle()}</h2>
        
        <div className="filter-info">
          <span>Showing {filteredList.length} employees</span>
          {(filter !== 'all' || colorFromQuery || locationParam) && (
            <button 
              onClick={handleClearFilter}
              className="clear-filter-btn"
            >
              <X size={16} /> Clear Filters
            </button>
          )}
        </div>
        
        {/* Debug Information Panel - Toggle with a button in production */}
        <div className="debug-panel">
          <details>
            <summary>Debug Information (Expected: {expectedCount}, Actual: {filteredList.length})</summary>
            <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
          </details>
        </div>
      </div>
      
      {filteredList.length === 0 ? (
        <div className="empty-state">
          <p>No employees found matching the selected criteria.</p>
        </div>
      ) : (
        <ul className="employee-list">
          {filteredList.map(employee => (
            <li key={employee.employeeId} className="employee-item">
              <Link 
                to={`/employee/${employee.employeeId}`} 
                className="employee-link"
              >
                <div className="employee-info">
                  <p className="employee-name">{employee.name}</p>
                  <div className="employee-details">
                    <p className="employee-service">{employee.service}</p>
                    <p className="employee-location">{employee.primaryLocation}</p>
                    <p className="employee-status">{employee.status}</p>
                  </div>
                  {employee.padrino && (
                    <div 
                      className="padrino-indicator" 
                      style={{ backgroundColor: employee.padrinoColor }}
                      title={`Padrino color: ${employee.padrinoColor}`}
                    />
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default EmployeeList;