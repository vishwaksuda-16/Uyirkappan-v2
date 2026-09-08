import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import NotificationToast from './NotificationToast';

export function AppLayout() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
      }}
    >
      {/* Top Operations Navbar */}
      <Navbar />

      {/* Main Container with Sidebar + Page Viewport */}
      <div style={{ display: 'flex', flex: 1, minHeight: 'calc(100vh - 64px)' }}>
        <Sidebar />

        <main
          style={{
            flex: 1,
            padding: '24px 32px',
            backgroundColor: 'var(--bg-primary)',
            overflowY: 'auto',
            maxHeight: 'calc(100vh - 64px)',
          }}
        >
          <Outlet />
        </main>
      </div>

      {/* Real-time Floating Notification Toasts */}
      <NotificationToast />
    </div>
  );
}

export default AppLayout;
