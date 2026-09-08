import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { EmergencyProvider } from './context/EmergencyContext';
import AppRoutes from './routes/AppRoutes';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <EmergencyProvider>
          <AppRoutes />
        </EmergencyProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
