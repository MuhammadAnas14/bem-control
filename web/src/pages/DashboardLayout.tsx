import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';

export function DashboardLayout() {
  const { user, selectedOrgId, selectedOrg, selectOrg, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <span className="text-lg font-semibold text-brand-700">Bem Control</span>
            <nav className="flex gap-4 text-sm">
              <NavLink
                to="/devices"
                className={({ isActive }) =>
                  isActive ? 'font-medium text-brand-700' : 'text-gray-500 hover:text-gray-800'
                }
              >
                Devices
              </NavLink>
              <NavLink
                to="/devices/provision"
                className={({ isActive }) =>
                  isActive ? 'font-medium text-brand-700' : 'text-gray-500 hover:text-gray-800'
                }
              >
                Add device
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {user && user.organizations.length > 0 && (
              <select
                value={selectedOrgId ?? ''}
                onChange={(e) => selectOrg(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm"
              >
                {user.organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            )}
            <span className="text-sm text-gray-500">{user?.name}</span>
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="text-sm text-gray-500 hover:text-gray-800"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        {selectedOrg ? (
          <Outlet />
        ) : (
          <p className="text-sm text-gray-500">
            You don&apos;t belong to any organization yet.
          </p>
        )}
      </main>
    </div>
  );
}
