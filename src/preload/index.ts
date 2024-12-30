import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { Settings } from '../main/ipc/user.js';
import { LocalSettings } from '../main/ipc/index.js';
import { SpaceInfo } from '../main/ipc/space.js';

// Custom APIs for renderer
const api = {
  // Auth
  login: (email: string, password: string) => ipcRenderer.invoke('login', email, password),
  getAuth: () => ipcRenderer.invoke('get-auth'),
  verifyOtp: (email: string, token: string) => ipcRenderer.invoke('verify-otp', email, token),
  authSendVerificationCode: (email: string) => ipcRenderer.invoke('auth:send-verification-code', email),
  authVerifySession: () => ipcRenderer.invoke('auth:verify-session'),
  logout: () => ipcRenderer.invoke('auth:logout'),

  // Digest
  getPromptTemplates: () => ipcRenderer.invoke('get-prompt-templates'),
  analyzeVault: (templateId: string | null, userPrompt: string | null) => ipcRenderer.invoke('analyze-vault', templateId, userPrompt),

  // Vault
  initializeIndex: (settings: Settings) => ipcRenderer.invoke('initialize-index', settings),
  reindexDirectory: (settings: Settings) => ipcRenderer.invoke('reindex-directory', settings),
  trendingDataUpdate: () => ipcRenderer.invoke('trending-data-update'),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (newSettings: Settings) => ipcRenderer.invoke('update-settings', newSettings),
  updateLocalSettings: (newLocalSettings: LocalSettings) => ipcRenderer.invoke('update-local-settings', newLocalSettings),

  // Spaces
  createSpace: (spaceData: SpaceInfo) => ipcRenderer.invoke('create-space', spaceData),
  submitToSpace: (spaceName: string, submission: any) => ipcRenderer.invoke('submit-to-space', { spaceName, submission }),
  clearSpaces: () => ipcRenderer.invoke('clear-spaces'),
  fetchSpaceSubmissions: (spaceId: string) => ipcRenderer.invoke('fetch-space-submissions', spaceId)
}

// Define the app state type
interface AppState {
  isAppReady: boolean
  isVaultInitialized: boolean
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
// if (process.contextIsolated) {
//   console.log('contextIsolated')
  try {
    contextBridge.exposeInMainWorld('electron', {
      ...electronAPI,
      ipcRenderer: {
        send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
        on: (channel: string, func: (...args: any[]) => void) => {
          ipcRenderer.on(channel, (_, ...args) => func(...args))
        },
        invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
        removeListener: (channel: string, func: (...args: any[]) => void) => ipcRenderer.removeListener(channel, func),
        getAppState: () => ipcRenderer.invoke('get-app-state'),
        setVaultInitialized: (initialized: boolean) => 
          ipcRenderer.invoke('set-vault-initialized', initialized),
        onAppStateChange: (callback: (state: AppState) => void) => {
          const subscription = (_: any, state: AppState) => callback(state)
          ipcRenderer.on('app-state-update', subscription)
          return () => {
            ipcRenderer.removeListener('app-state-update', subscription)
          }
        }
      }
    })
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
// } else {
//   console.log('not contextIsolated')
//   // @ts-ignore (define in dts)
//   window.electron = electronAPI
//   // @ts-ignore (define in dts)
//   window.api = api
// }