import React, { useState, useEffect, useCallback } from 'react'
import { useSettingsContext } from './contexts/SettingsContext'
import Sidebar from './components/Sidebar'
import Main from './components/main'
import { useAuth } from './contexts/AuthContext'

// Create an inner component to use hooks
const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState('settings')
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const { refreshSettings, initializeVault } = useSettingsContext()
  const { isAuthenticated } = useAuth()

  const init = async () => {
    try {
      // Refresh settings
      await refreshSettings()

    } catch (err) {
      console.error('Error during initialization:', err)
      setMessage('Failed to initialize application')
      setError(true)
    }
  }

  const initVault = async () => {
    try {
      await initializeVault()
    } catch (err) {
      console.error('Error during vault initialization:', err)
      setMessage('Failed to initialize vault')
      setError(true)
    }
  }

  // Initialize on mount
  useEffect(() => {
    init()

    initVault()

    // Set up visibility change handler
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        init()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isAuthenticated])

  const quitApp = async () => {
    await window.electron.ipcRenderer.send('quit-app')
  }

  return (
    <div className="min-h-screen">
      <div className="flex h-screen">
        <Sidebar 
          currentView={currentView}
          setCurrentView={setCurrentView}
          quitApp={quitApp}
        />
        <Main 
          currentView={currentView} 
          init={init}
          setCurrentView={setCurrentView}
        />
      </div>
    </div>
  )
}

// Main App component with providers
const App: React.FC = () => {
  return (
    <AppContent />
  )
}

export default App 