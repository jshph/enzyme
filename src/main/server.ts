import express, { Express } from 'express';
import { Server } from 'http';
import { extractPatterns, QueryPattern } from './extract/index';
import { parseQueryString } from './extract/queryParser';
import { getFileIndexer, ElectronFileIndexer } from './indexer/electron';
import * as winston from 'winston';
import path from 'path';
import { app as electronApp, Notification } from 'electron';

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
  indexer: ElectronFileIndexer;
  private logger: winston.Logger;

  constructor() {
    const logPath = path.join(electronApp.getPath('userData'), 'logs');

    this.indexer = getFileIndexer();
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



  async startServer(config: ServerConfig) {
  
    this.logger.debug(`Starting server with config: ${JSON.stringify(config)}`);

    await this.indexer.initialize(
      config.vaultPath,
      config.includedPatterns,
      config.excludedPatterns,
      config.excludedTags,
      config.doCache
    );
  
    app.get('/context', (async (req: express.Request, res: express.Response) => {
      const { query } = req.query;
  
      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: `Query parameter is required and must be a string but was: ${JSON.stringify(req.query)}` });
      }

      const decodedQuery = decodeURIComponent(query as string);
  
      try {
        const queryPatterns: QueryPattern[] = parseQueryString(decodedQuery);
        const results = await extractPatterns(queryPatterns, config.defaultPatternLimit);
        
        const combinedResults = [
          ...results
        ];

        const formattedResults = combinedResults.map(result => {
          const folder = result.file.split(path.sep).slice(0, -1).join(path.sep);
          return TEMPLATE_RESULT.replace('{file}', result.file)
            .replace('{folder}', folder)
            .replace('{tags}', result.tags.join(', '))
            .replace('{lastModified}', result.lastModified.toString())
            .replace('{createdAt}', result.createdAt.toString())
            .replace('{contents}', result.extractedContents.join('\n'))
        });
        
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
  
    server = app.listen(config.port, () => {
      this.logger.info(`Context server listening at http://localhost:${config.port}`);
      this.logger.info(`Indexer initialized with directory ${config.vaultPath}`);
      new Notification({
        title: 'Enzyme MCP Server',
        body: `Model Context Protocol server available at http://localhost:${config.port}`
      }).show();
    });
  
    return server;
  }
  
  async stopServer(): Promise<void> {
    if (server) {
      await this.indexer.stop();
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = null;
    }
  } 
}
