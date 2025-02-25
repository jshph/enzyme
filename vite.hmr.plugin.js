/**
 * Custom plugin to enhance HMR for the chat application
 * @returns {import('vite').Plugin}
 */
export function chatHmrPlugin() {
  return {
    name: 'chat-hmr-plugin',
    
    // Apply in dev mode only
    apply: 'serve',
    
    // Configure server
    configureServer(server) {
      // Add custom HMR handler for chat components
      server.hot.on('chat:update', ({ file, timestamp }) => {
        console.log(`🔄 Chat component updated: ${file} at ${new Date(timestamp).toLocaleTimeString()}`);
      });
    },
    
    // Transform code to add custom HMR logic
    transform(code, id) {
      // Only apply to chat components
      if (id.includes('/chat/') && id.endsWith('.tsx') && !id.includes('index.tsx')) {
        // Add a timestamp comment to force updates
        const timestamp = Date.now();
        return `${code}\n\n// HMR Timestamp: ${timestamp}\n`;
      }
      
      return code;
    }
  };
} 