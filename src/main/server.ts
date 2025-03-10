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

interface TagSummary {
  tag: string;
  summary: string;
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

// Create a singleton instance of ServerContext
let serverContextInstance: ServerContext | null = null;
let instanceCounter = 0;


export function getServerUrl() {
  // return "http://localhost:3129";
  return "https://enzyme-server-production.up.railway.app";
}

const SERVER_URL = getServerUrl();

export class ServerContext {
  indexer: ElectronFileIndexer | null = null;
  private logger: winston.Logger;
  private config: ServerConfig | null = null;
  private instanceId: string;
  private running: boolean = false;
  
  constructor() {
    this.logger = initializeLogger('server');
    this.instanceId = `server-${++instanceCounter}-${Date.now()}`;
    this.logger.info(`ServerContext instance created with ID: ${this.instanceId}`);
  }

  // Add method to get the instance ID
  public getInstanceId(): string {
    return this.instanceId;
  }
  
  // Add method to check if server is running
  public isRunning(): boolean {
    return this.running && server !== null;
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

  async getTrendingEntities({limitPerType = 25, type = 'all'}: {limitPerType?: number, type?: 'all' | 'tags' | 'links'}): Promise<string[]> {
    const indexer = getFileIndexer();
    const trendingData = await indexer.getTrendingData();
    const items = trendingData?.items;
    if (type === 'all') {
      const tags = items?.tags.map(item => item.name).slice(0, limitPerType) ?? [];
      const links = items?.links.map(item => item.name).slice(0, limitPerType) ?? [];
      return [...tags, ...links];
    } else if (type === 'tags') {
      return items?.tags.map(item => item.name).slice(0, limitPerType) ?? [];
    } else if (type === 'links') {
      return items?.links.map(item => item.name).slice(0, limitPerType) ?? [];
    } else {
      return [];
    }
  }

  /**
   * Get summaries for the top trending tags.
   * This method retrieves the top tags, gets context for each tag,
   * and then uses the server-side tag summary API to generate summaries.
   * These summaries can be used to help determine what tags to assign to new notes.
   * 
   * @param limit The maximum number of tag summaries to retrieve
   * @returns An array of TagSummary objects
   */
  async getTagSummaries(limit: number = 10): Promise<TagSummary[]> {
    try {
      // Get the top tags
      const topTags = await this.getTrendingEntities({ limitPerType: limit, type: 'tags' });
      
      if (!topTags || topTags.length === 0) {
        this.logger.warn('No tags found for generating summaries');
        return [];
      }

      this.logger.info(`Selected ${topTags.length} trending tags: ${topTags.join(', ')}`);
      
      // Get context for each tag
      this.logger.debug('Fetching contexts for each tag...');
      const tagsContexts: {tag: string, contexts: string[]}[] = [];
      
      for (const tag of topTags) {
        try {
          this.logger.debug(`Fetching context for tag: #${tag}`);
          const context = await this.getContext(`#${tag}`, 'json') as MatchResult[];
          this.logger.debug(`Retrieved ${context.length} context items for tag #${tag}`);
          
          // Extract the contents from each context item
          const contextContents = context.map(c => c.extractedContents.join('\n'));
          tagsContexts.push({ tag, contexts: contextContents });
        } catch (error) {
          this.logger.error(`Error getting context for tag #${tag}:`, error);
          tagsContexts.push({ tag, contexts: [] }); // Push empty context if error
        }
      }
      
      // Send request to server to generate summaries
      this.logger.info(`Sending request to server to generate summaries for ${topTags.length} tags`);
      
      try {
        // Use the correct server URL - this should match what's used in the IPC implementation
        const response = await axios.post(`${SERVER_URL}/tag-summary/generate-batch`, {
          tagsContexts
        });
        
        if (response.data && response.data.success && response.data.summaries) {
          this.logger.info(`Successfully generated ${response.data.summaries.length} tag summaries`);
          return response.data.summaries;
        } else {
          this.logger.error('Invalid response from tag summary API');
          throw new Error('Invalid response from tag summary API');
        }
      } catch (error) {
        this.logger.error(`Error calling tag summary API: ${error}`);
        throw error;
      }
    } catch (error) {
      this.logger.error(`Error getting tag summaries: ${error}`);
      throw error;
    }
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
      const limitPerType = req.query.limitPerType ? parseInt(req.query.limitPerType as string) : 25;
      const type = req.query.type as 'all' | 'tags' | 'links' || 'all';
      const trendingEntities = await this.getTrendingEntities({ limitPerType, type });
      res.json({
        entities: trendingEntities
      });
    }) as express.RequestHandler);
    
    // Endpoint to get tag summaries
    app.get('/tag-summaries', (async (req: express.Request, res: express.Response) => {
      try {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
        const summaries = await this.getTagSummaries(limit);
        
        res.json({
          success: true,
          summaries
        });
      } catch (error) {
        this.logger.error(`Error retrieving tag summaries: ${error}`);
        res.status(500).json({ 
          success: false, 
          error: 'Failed to retrieve tag summaries' 
        });
      }
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
    }) as express.RequestHandler;
    
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
      this.running = true;
      
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
      this.running = false;
      this.logger.info(`Server with ID ${this.instanceId} stopped`);
    }
  } 
}

/**
 * Returns a singleton instance of ServerContext
 * This ensures we only have one server running throughout the application
 */
export const useContextServer = (): ServerContext => {
  if (!serverContextInstance) {
    serverContextInstance = new ServerContext();
    console.log('Created new ServerContext singleton instance');
  } else {
    console.log('Reusing existing ServerContext singleton instance');
  }
  return serverContextInstance;
}