import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute from './services/PrivateRoute';
import AuthProvider from './services/authContext';

const Login = lazy(() => import('./components/Login'));
const Admin = lazy(() => import('./components/Admin'));
const Profile = lazy(() => import('./components/Profile'));
const UserDashboard = lazy(() => import('./components/UserDashboard'));
const QRScannerPage = lazy(() => import('./components/QRScannerPage'));
const ManageEmployees = lazy(() => import('./components/ManageEmployees'));
const Reports = lazy(() => import('./components/Reports'));
const Settings = lazy(() => import('./components/Settings'));
const AddUser = lazy(() => import('./components/AddUser'));
const AccountSettings = lazy(() => import('./components/AccountSettings'));
const NotFound = lazy(() => import('./components/NotFound'));
const EmployeeProfile = lazy(() => import('./components/EmployeeProfile')); // Employee profile route

function App() {
  return (
    <AuthProvider>
      <Router>
        <Suspense fallback={<div>Loading...</div>}>
          <Routes>
            {/* Default route redirect to login */}
            <Route path="/" element={<Navigate to="/login" />} />
            <Route path="/login" element={<Login />} />

            {/* Admin Routes Protected by Role */}
            <Route
              path="/admin"
              element={
                <PrivateRoute requiredRole="admin">
                  <Admin />
                </PrivateRoute>
              }
            >
              {/* Nested routes inside the Admin panel */}
              <Route path="manage-employees" element={<ManageEmployees />} />
              <Route path="reports" element={<Reports />} />
              <Route path="settings" element={<Settings />} />
              <Route path="add-user" element={<AddUser />} />
              <Route path="account-settings" element={<AccountSettings />} />
              <Route path="qr-scanner" element={<QRScannerPage />} />
            </Route>

            {/* Employee Profile Route */}
            <Route
              path="/employee/:employeeId"
              element={
                <PrivateRoute requiredRole="employee">
                  <EmployeeProfile />
                </PrivateRoute>
              }
            />

            {/* Employee Profile */}
            <Route
              path="/profile"
              element={
                <PrivateRoute requiredRole="employee">
                  <Profile />
                </PrivateRoute>
              }
            />

            {/* Employee Dashboard */}
            <Route
              path="/user-dashboard"
              element={
                <PrivateRoute requiredRole="employee">
                  <UserDashboard />
                </PrivateRoute>
              }
            />

            {/* Not Found Route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
}

export default App;
