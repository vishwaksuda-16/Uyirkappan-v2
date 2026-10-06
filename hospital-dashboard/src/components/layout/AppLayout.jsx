import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import NotificationToast from './NotificationToast';

export function AppLayout() {
  return (
    <div className="app-layout" style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <Navbar />

      <div className="app-main-layout" style={{ flex: 1 }}>
        <Sidebar />
        <main className="app-main-content" style={{ backgroundColor: 'var(--bg-primary)' }}>
          <Outlet />
        </main>
      </div>

      <NotificationToast />
    </div>
  );
}

export default AppLayout;
