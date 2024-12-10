import React from 'react';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  quitApp: () => Promise<void>;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView, quitApp }) => {
  const { isAuthenticated, email, handleLogout } = useAuth();

  console.log('isAuthenticated', isAuthenticated)

  return (
    <div className="w-64 bg-white shadow-lg fixed h-screen overflow-y-auto">
      <nav className="mt-12">
          <a onClick={() => setCurrentView('settings')} 
              className={`flex items-center px-4 py-3 cursor-pointer hover:bg-gray-50 ${currentView === 'settings' ? 'bg-blue-50 text-blue-600' : ''}`}
          >
              <span className="ml-2">Settings</span>
          </a>

          {isAuthenticated && (
            <a onClick={() => setCurrentView('spaces')} 
                className={`flex items-center px-4 py-3 cursor-pointer hover:bg-gray-50 ${currentView === 'spaces' ? 'bg-blue-50 text-blue-600' : ''}`}>
                <span className="ml-2">Spaces</span>
            </a>
          )}

          {isAuthenticated && (
            <a onClick={() => setCurrentView('prompts')} 
                className={`flex items-center px-4 py-3 cursor-pointer hover:bg-gray-50 ${currentView === 'prompts' ? 'bg-blue-50 text-blue-600' : ''}`}>
                <span className="ml-2">Prompts</span>
            </a>
          )}

          <a onClick={() => setCurrentView('playground')} 
              className={`flex items-center px-4 py-3 cursor-pointer hover:bg-gray-50 ${currentView === 'playground' ? 'bg-blue-50 text-blue-600' : ''}`}>
              <span className="ml-2">Playground</span>
          </a>

          {!isAuthenticated && (
            <a onClick={() => setCurrentView('login')} 
                className={`flex items-center px-4 py-3 cursor-pointer hover:bg-gray-50 ${currentView === 'login' ? 'bg-blue-50 text-blue-600' : ''}`}>
                <span className="ml-2">Login</span>
            </a>
          )}
          
          {isAuthenticated && (
            <a onClick={handleLogout} 
                className="flex items-center px-4 py-3 cursor-pointer hover:bg-gray-50 text-red-600">
                <span className="ml-2">Logout</span>
            </a>
          )}

          <a onClick={quitApp} 
              className="flex items-center px-4 py-3 cursor-pointer hover:bg-gray-50 text-red-600">
              <span className="ml-2">Quit Enzyme</span>
          </a>
      </nav>

      {isAuthenticated && (
        <div className="p-4 border-t mt-4">
            <div className="text-sm text-gray-600">
                Logged in as:
                <div className="font-medium text-gray-900">{email}</div>
            </div>
        </div>
      )}
    </div>
  );
}

export default Sidebar;