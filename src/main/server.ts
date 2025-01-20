import express, { Express } from 'express';
import { Server } from 'http';
import { extractPatterns, MatchResult, QueryPattern } from './extract/index';
import { parseQueryString } from './extract/queryParser';
import { ElectronFileIndexer } from './indexer/electron';
import * as winston from 'winston';
import path from 'path';
import { app as electronApp, Notification } from 'electron';
import cors from 'cors';

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
    const logPath = path.join(electronApp.getPath('userData'), 'logs');
    this.logger = winston.createLogger({
      level: 'debug',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: path.join(logPath, 'error_server.log'), level: 'error' }),
        new winston.transports.File({ filename: path.join(logPath, 'combined_server.log') })
      ]
    });
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

  async startServer(indexer: ElectronFileIndexer, port: number) {
    if (server) {
      await this.stopServer();
    }
    
    this.indexer = indexer;

    app.use(cors());
    app.use(express.json());
  
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
          content: formattedResults.map((result: string) => ({
            type: "text",
            text: result
          }))
        });
      } catch (error) {
        this.logger.error(`Error retrieving notes: ${error}`);
        res.status(500).json({ error: "An error occurred while retrieving notes" });
      }
    }) as express.RequestHandler);
  
    server = app.listen(port, () => {
      this.logger.info(`Context server listening at http://localhost:${port}`);
      new Notification({
        title: 'Enzyme MCP Server',
        body: `Model Context Protocol server available at http://localhost:${port}`
      }).show();
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