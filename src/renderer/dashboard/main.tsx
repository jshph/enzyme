import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import '../styles/dashboard.css'
import { SettingsProvider } from './contexts/SettingsContext'

const Component: React.FC = () => {

  // const [ipcReady, setIpcReady] = useState(false)

  // useEffect(() => {
  //   const handleIpcReady = () => setIpcReady(true)
  //   window.electron.ipcRenderer.on('ipc-ready', handleIpcReady)
  //   return () => {
  //     window.electron.ipcRenderer.removeListener('ipc-ready', handleIpcReady)
  //   }
  // }, [])

  // if (!ipcReady) {
  //   return (
  //     <div className="flex items-center justify-center min-h-screen">
  //       <div className="loader"></div>
  //     </div>
  //   )
  // }

  return (
    <AuthProvider>
      <SettingsProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<App />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </BrowserRouter>
      </SettingsProvider>
    </AuthProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Component />
  </React.StrictMode>
) 