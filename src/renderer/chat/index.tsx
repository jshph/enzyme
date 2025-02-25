import React from 'react';
import ReactDOM from 'react-dom/client';
import { ChatApp } from './ChatApp.js';
import './ChatApp.css';

// Create root outside of render function to preserve it between HMR updates
const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

// Render the app
root.render(
  // Remove StrictMode in development to prevent double rendering during HMR
  process.env.NODE_ENV === 'development' ? <ChatApp /> : <React.StrictMode><ChatApp /></React.StrictMode>
);

// HMR setup
// @ts-ignore - Vite-specific HMR API
if (import.meta.hot) {
  // @ts-ignore - Vite-specific HMR API
  import.meta.hot.accept('./ChatApp.js', (newModule: any) => {
    if (newModule) {
      // Re-render the app with the updated component
      const NewChatApp = newModule.ChatApp;
      root.render(
        process.env.NODE_ENV === 'development' ? <NewChatApp /> : <React.StrictMode><NewChatApp /></React.StrictMode>
      );
    }
  });
} 