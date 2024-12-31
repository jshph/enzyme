import React, { useState, useEffect } from 'react'
import { useSettingsContext } from './contexts/SettingsContext'
import Sidebar from './components/Sidebar'
import Main from './components/main'
import { useAuth } from './contexts/AuthContext'
import { RecipeExecutor } from './components/RecipeExecutor'

interface AppState {
  isAppReady: boolean;
  isVaultInitialized: boolean;
}

const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState('settings')
  const [appState, setAppState] = useState<AppState>({ 
    isAppReady: false, 
    isVaultInitialized: false 
  })
  const { refreshSettings, initializeVault } = useSettingsContext()
  const { isAuthenticated, isAuthReady } = useAuth()

  // Listen for app state updates
  useEffect(() => {
    // Get initial state
    window.electron.ipcRenderer.getAppState().then(setAppState)

    // Set up subscription to state changes
    const unsubscribe = window.electron.ipcRenderer.onAppStateChange(setAppState)
    return () => unsubscribe()
  }, [])

  // Initialize vault when app is ready and auth state is known
  useEffect(() => {
    const initVault = async () => {
      // Only proceed if app is ready and auth state is determined
      if (!appState.isAppReady || !isAuthReady) {
        return
      }

      // Don't reinitialize if already done
      if (appState.isVaultInitialized) {
        return
      }

      try {
        await refreshSettings()
        await initializeVault()
        await window.electron.ipcRenderer.invoke('set-vault-initialized', true)
      } catch (err) {
        console.error('Failed to initialize vault:', err)
        setCurrentView('settings')
      }
    }

    initVault()
  }, [appState.isAppReady, isAuthReady])

  // Show loading state while app initializes
  if (!appState.isAppReady) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand/80 mx-auto"></div>
          <p className="mt-4 text-secondary/70">Starting Enzyme...</p>
        </div>
      </div>
    )
  }

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
          setCurrentView={setCurrentView}
          isVaultInitialized={appState.isVaultInitialized}
        />
      </div>
      
      <RecipeExecutor />
    </div>
  )
}

const App: React.FC = () => {
  return (
    <AppContent />
  )
}

export default App 