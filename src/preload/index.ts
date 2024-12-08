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
  searchVaultTags: (query?: string) => ipcRenderer.invoke('search-vault-tags', query),
  fetchSpaceSubmissions: (spaceId: string) => ipcRenderer.invoke('fetch-space-submissions', spaceId),

  // Prompts
  createPrompt: (prompt: string, name: string) => ipcRenderer.invoke('create-prompt', { prompt, name }),
  updatePrompt: (id: string, prompt: string, name: string) => ipcRenderer.invoke('update-prompt', { id, prompt, name }),
  deletePrompt: (id: string) => ipcRenderer.invoke('delete-prompt', id),
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

import fs from 'fs';
import path from 'path';

contextBridge.exposeInMainWorld('nodefs', {
  readFile: (path: string) => fs.promises.readFile(path, "utf-8"),
  writeFile: (path: string, data: string) => fs.promises.writeFile(path, data),
  readdir: (path: string) => fs.promises.readdir(path),
  mkdir: (path: string, options?: fs.MakeDirectoryOptions) => fs.promises.mkdir(path, options),
  stat: (path: string) => fs.promises.stat(path),
  exists: (path: string) => fs.existsSync(path)
})

contextBridge.exposeInMainWorld('nodepath', {
  join: (...paths: string[]) => path.join(...paths),
  resolve: (...paths: string[]) => path.resolve(...paths),
  dirname: (pathName: string) => path.dirname(pathName),
  basename: (pathName: string) => path.basename(pathName)
})