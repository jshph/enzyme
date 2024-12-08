import { readFileSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';
import { ServerContext } from './server';

// Read and parse the config file
const configPath = join(__dirname, 'config.yml');
const config = YAML.parse(readFileSync(configPath, 'utf8'));

class StandaloneServerContext {
  serverContext: ServerContext;

  constructor() {
    this.serverContext = new ServerContext();
  }

  async start() {
    try {
      await this.serverContext.startServer(config);
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  async stop() {
    try {
      await this.serverContext.stopServer();
      console.log('Server stopped.');
      process.exit(0);
    } catch (error) {
      console.error('Error stopping server:', error);
      process.exit(1);
    }
  }
}

// Create an instance of the StandaloneServerContext
const standaloneServer = new StandaloneServerContext();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await standaloneServer.stop();
});

// Start the server
standaloneServer.start();