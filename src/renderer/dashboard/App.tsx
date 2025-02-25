import React, { useState, useEffect } from 'react'
import { useSettingsContext } from './contexts/SettingsContext.js'
import Sidebar from './components/Sidebar.js'
import Main from './components/main/index.js'
import { useAuth } from './contexts/AuthContext.js'
import { RecipeExecutor } from './components/RecipeExecutor.js'
import { ChatModal } from '../chat/ChatModal.js'

interface AppState {
  isAppReady: boolean;
  isVaultInitialized: boolean;
}

const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState('recipes')
  const [isChatModalOpen, setIsChatModalOpen] = useState(false)
  const [appState, setAppState] = useState<AppState>({ 
    isAppReady: false, 
    isVaultInitialized: false 
  })
  const { refreshSettings } = useSettingsContext()
  const { isAuthReady } = useAuth()

  // Function to open the chat modal
  const openChatModal = () => {
    setIsChatModalOpen(true)
  }

  // Function to close the chat modal
  const closeChatModal = () => {
    setIsChatModalOpen(false)
  }

  // Listen for app state updates
  useEffect(() => {
    // Get initial state
    const getAppState = async () => {
      try {
        const state = await window.electron.ipcRenderer.invoke('get-app-state')
        setAppState(state)
      } catch (err) {
        console.error('Failed to get app state:', err)
      }
    }
    getAppState()

    // Set up subscription to state changes
    const handleAppStateChange = (newState: AppState) => {
      setAppState(newState)
    }
    
    window.electron.ipcRenderer.on('app-state-update', handleAppStateChange)
    return () => {
      window.electron.ipcRenderer.removeListener('app-state-update', handleAppStateChange)
    }
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
          openChatModal={openChatModal}
        />
        <Main 
          currentView={currentView}
          setCurrentView={setCurrentView}
          isVaultInitialized={appState.isVaultInitialized}
        />
      </div>
      
      <RecipeExecutor />
      
      {/* Global chat modal that can be accessed from sidebar */}
      <ChatModal 
        isOpen={isChatModalOpen} 
        onClose={closeChatModal}
        selectedEntities={new Map()}
        context={[]}
      />
    </div>
  )
}

const App: React.FC = () => {
  return (
    <AppContent />
  )
}

export default App 