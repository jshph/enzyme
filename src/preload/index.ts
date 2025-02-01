import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { Settings } from '../main/ipc/user.js';
import { LocalSettings } from '../main/ipc/index.js';
import { SpaceInfo } from '../main/ipc/space.js';


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
        removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel),
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