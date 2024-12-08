import React, { useState } from 'react'
import SettingsManager from './components/SettingsManager'
import Sidebar from './components/Sidebar'
import { ipcRenderer } from 'electron'
import Main from './components/main'

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState('login')
  const settingsManager = new SettingsManager()
  const [saveState, setSaveState] = useState('idle')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const [showOtpForm, setShowOtpForm] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [hasVaultInitialized, setHasVaultInitialized] = useState(false)
  const [spaces, setSpaces] = useState([])
  const [newSpace, setNewSpace] = useState({
    id: null,
    name: '',
    destinationFolder: '',
    _manuallyModifiedDestination: false
  })
  const [tagInput, setTagInput] = useState('')
  const [tagSuggestions, setTagSuggestions] = useState([])
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const [showTagSuggestions, setShowTagSuggestions] = useState(false)
  const [enzymeBaseUrl, setEnzymeBaseUrl] = useState('https://enzyme.garden')
  const [editingSpace, setEditingSpace] = useState(false)


  const handleLogout = async () => {
    try {
      // Clear spaces first
      await ipcRenderer.invoke('clear-spaces');
      
      const { success, error } = await ipcRenderer.invoke('auth:logout');
      if (success) {
        setIsAuthenticated(false);
        setEmail('');
        setCurrentView('login');
        setSpaces([]); // Clear spaces array
        settingsManager.reset();
      } else {
        setMessage(error);
        setError(true);
      }
    } catch (err) {
      setMessage('Failed to logout');
      setError(true);
    }
  }

  const quitApp = async () => {
    await ipcRenderer.send('quit-app');
  }

  return (
    <div className="min-h-screen">
      <h1>Dashboard</h1>
      <Sidebar 
        currentView={currentView}
        setCurrentView={setCurrentView}
        isAuthenticated={isAuthenticated}
        handleLogout={handleLogout}
        quitApp={quitApp}
        email={email}
      />
      {/* <Main currentView={currentView} isAuthenticated={isAuthenticated} /> */}
    </div>
  )
}

export default App 