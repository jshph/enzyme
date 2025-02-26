import express, { Express } from 'express';
import { Server } from 'http';
import { extractPatterns, MatchResult, QueryPattern } from './extract/index.js';
import { parseQueryString } from './extract/queryParser.js';
import { ElectronFileIndexer, getFileIndexer } from './indexer/electron.js';
import * as winston from 'winston';
import path from 'path';
import { app as electronApp, Notification } from 'electron';
import cors from 'cors';
import { initializeLogger } from './utils/logger.js';
import axios from 'axios';

interface ServerConfig {
  vaultPath: string;
  includedPatterns: string[];
  excludedPatterns: string[];
  excludedTags: string[];
  doCache: boolean;
  port: number;
  defaultPatternLimit: number;
}


const TEMPLATE_RESULT = `## File: {file}
* Folder: {folder}
* Tags: {tags}
* Last modified: {lastModified}
* Created: {createdAt}


### Contents
\`\`\`
{contents}
\`\`\`
`;

let server: Server | null = null;
const app: Express = express();

export class ServerContext {
  indexer: ElectronFileIndexer | null = null;
  private logger: winston.Logger;
  private config: ServerConfig | null = null;
  constructor() {
    this.logger = initializeLogger('server');
  }

  public async getContext(query: string, format: 'json' | 'md' = 'md'): Promise<string[] | MatchResult[]> {
    const queryPatterns: QueryPattern[] = parseQueryString(query);
    const results = await extractPatterns(queryPatterns, this.config?.defaultPatternLimit);
      
    const combinedResults = [...results];
    
    const formattedResults = combinedResults.map(result => {
      const folder = result.file.split(path.sep).slice(0, -1).join(path.sep);
      if (format === 'md') {
        return TEMPLATE_RESULT.replace('{file}', result.file)
          .replace('{folder}', folder)
          .replace('{tags}', result.tags.join(', '))
          .replace('{lastModified}', result.lastModified.toString())
          .replace('{createdAt}', result.createdAt.toString())
          .replace('{contents}', result.extractedContents.join('\n'));
      } else {
        return result;
      }
      });

    return formattedResults as string[] | MatchResult[];
  }

  async getTrendingEntities(): Promise<string[]> {
    const trendingData = await this.indexer?.getTrendingData();
    const items = trendingData?.items;
    const tags = items?.tags.map(item => item.name) ?? [];
    const links = items?.links.map(item => item.name) ?? [];
    return [...tags, ...links];
  }

  async startServer(port: number) {
    if (server) {
      await this.stopServer();
    }
    
    this.indexer = getFileIndexer();

    // Configure CORS to allow requests from the Vite dev server
    const corsOptions = {
      origin: [
        `http://localhost:${port}`,
        'http://localhost:5173', // Vite dev server
        'http://localhost:5174', // Alternative Vite dev server port
        'http://127.0.0.1:5173',  // Vite dev server alternative
        'http://127.0.0.1:5174',   // Alternative Vite dev server port
        '*' // Allow all origins in development
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization']
    };

    app.use(cors(corsOptions));
    app.use(express.json());
    
    // Add request logging middleware
    app.use((req, res, next) => {
      this.logger.info(`${req.method} ${req.url}`);
      next();
    });
    
    // Add a debug endpoint to check if the server is running
    app.get('/api/health', (req, res) => {
      this.logger.info('Health check endpoint called');
      res.json({ status: 'ok', port: port });
    });
    
    // Add a root endpoint for basic connectivity testing
    app.get('/', (req, res) => {
      this.logger.info('Root endpoint called');
      res.json({ status: 'ok', message: 'Enzyme API server is running' });
    });
  
    app.get('/context', (async (req: express.Request, res: express.Response) => {
      const query = req.query.query as string;
  
      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: `Query parameter is required and must be a string but was: ${JSON.stringify(req.query)}` });
        return;
      }

      const decodedQuery = decodeURIComponent(query as string);
  
      try {
        const formattedResults = await this.getContext(decodedQuery);
        res.json({
          content: formattedResults.map((result) => ({
            type: "text",
            text: result
          }))
        });
      } catch (error) {
        this.logger.error(`Error retrieving notes: ${error}`);
        res.status(500).json({ error: "An error occurred while retrieving notes" });
      }
    }) as express.RequestHandler);

    app.get('/trending-entities', (async (req: express.Request, res: express.Response) => {
      const trendingEntities = await this.getTrendingEntities();
      res.json({
        entities: trendingEntities
      });
    }) as express.RequestHandler);
    
    // Add a test endpoint for the chat API
    app.get('/api/chat/test', (req, res) => {
      this.logger.info('Chat API test endpoint called');
      res.json({ 
        status: 'ok', 
        message: 'Chat API is available',
        endpoints: {
          chat: '/api/chat',
          health: '/api/health'
        }
      });
    });
    
    // API endpoint for local processing
    app.post('/api/chat', (async (req: express.Request, res: express.Response) => {
      const { messages } = req.body;
      
      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ error: "Messages array is required" });
        return;
      }
      
      try {
        // Get the last user message
        const lastUserMessage = messages.filter(m => m.role === 'user').pop();
        
        if (!lastUserMessage) {
          res.status(400).json({ error: "No user message found" });
          return;
        }
        
        // Use the existing context functionality to get relevant information
        const query = lastUserMessage.content;
        const contextResults = await this.getContext(query, 'md');
        
        // Format the response
        let responseContent = "Based on your notes, here's what I found:\n\n";
        
        if (Array.isArray(contextResults) && contextResults.length > 0) {
          // Add the context results to the response
          responseContent += contextResults.join('\n\n');
        } else {
          responseContent = "I couldn't find any relevant information in your notes. Please try a different query.";
        }
        
        // Return the response in the format expected by the client
        res.json({
          role: 'assistant',
          content: responseContent
        });
      } catch (error) {
        this.logger.error(`Error in chat API: ${error}`);
        res.status(500).json({ error: "An error occurred while processing your request" });
      }
    }) as express.RequestHandler);
  
    server = app.listen(port, () => {
      this.logger.info(`Context server listening at http://localhost:${port}`);
      
      // Check if app is ready before creating notification
      if (electronApp.isReady()) {
        new Notification({
          title: 'Enzyme MCP Server',
          body: `Model Context Protocol server available at http://localhost:${port}`
        }).show();
      } else {
        this.logger.info('App not ready, queueing notification for when app is ready');
        electronApp.whenReady().then(() => {
          new Notification({
            title: 'Enzyme MCP Server',
            body: `Model Context Protocol server available at http://localhost:${port}`
          }).show();
        });
      }
    });
  
    return server;
  }
  
  async stopServer(): Promise<void> {
    if (server) {
      await this.indexer?.stop();
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = null;
    }
  } 
}

export const useContextServer = () => {
  const contextServer = new ServerContext();
  return contextServer;
}