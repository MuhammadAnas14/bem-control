import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { DashboardLayout } from './pages/DashboardLayout';
import { DevicesListPage } from './pages/DevicesListPage';
import { DeviceDetailPage } from './pages/DeviceDetailPage';
import { ProvisionDevicePage } from './pages/ProvisionDevicePage';
import { RequireAuth } from './components/RequireAuth';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route
        element={
          <RequireAuth>
            <DashboardLayout />
          </RequireAuth>
        }
      >
        <Route path="/devices" element={<DevicesListPage />} />
        <Route path="/devices/provision" element={<ProvisionDevicePage />} />
        <Route path="/devices/:deviceId" element={<DeviceDetailPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/devices" replace />} />
    </Routes>
  );
}
