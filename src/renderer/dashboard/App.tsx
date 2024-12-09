import React, { useState, useEffect, useCallback } from 'react'
import { useSettingsContext } from './contexts/SettingsContext'
import Sidebar from './components/Sidebar'
import Main from './components/main'
import { VaultProvider, useVault } from './components/VaultProvider'
import { useSpaceManager } from './hooks/useSpaceManager'
import { useAuth } from './contexts/AuthContext'

// Create an inner component to use hooks
const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState('login')
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const { refreshSettings, settings } = useSettingsContext()
  const { initializeVault } = useVault()
  const { fetchSpaces } = useSpaceManager()
  const auth = useAuth()

  const init = useCallback(async () => {
    try {
      // Refresh settings
      await refreshSettings()
      console.log(settings)
      
      // Initialize vault if needed
      const vaultInitialized = await initializeVault(settings)
      if (!vaultInitialized) {
        setMessage('Failed to initialize vault')
        setError(true)
      }

      // If authenticated, set view and fetch spaces
      if (auth.isAuthenticated) {
        setCurrentView('settings')
        await fetchSpaces()
      }
    } catch (err) {
      console.error('Error during initialization:', err)
      setMessage('Failed to initialize application')
      setError(true)
    }
  }, [auth.isAuthenticated])

  // Initialize on mount
  useEffect(() => {
    init()

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
  }, [])

  // Watch for view changes
  useEffect(() => {
    if (currentView === 'spaces' && auth.isAuthenticated) {
      fetchSpaces()
    }
  }, [currentView, auth.isAuthenticated])

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
    <VaultProvider>
      <AppContent />
    </VaultProvider>
  )
}

export default App 