import { promises as fs } from 'fs';
import * as path from 'path';
import * as matter from 'gray-matter';
import * as chokidar from 'chokidar';
import { getFileCreationDate } from '../utils.js';
import * as winston from 'winston';
import { ServerContext } from '../server.js';
import { app } from 'electron';
import minimatch from 'minimatch';

export interface FileMetadata {
  path: string;
  createdAt: Date;
  tags: string[];
  links: string[];
  lastModified: number;
}

export interface SpaceSubmission {
  title: string;
  text: string;
  tags?: string[];
  timestamp: number;
}
interface IndexEntry {
  files: FileMetadata[];
}

interface TrendingItem {
  name: string;
  count: number;
}

interface TrendingItems {
  tags: TrendingItem[];
  links: TrendingItem[];
}

interface QueryResult {
  tags: string[];
  links: string[];
}

interface CachedSearchTerm {
  term: string;
  results: QueryResult;
  timestamp: number;
}

interface TimelineItem {
  date: Date;
  type: 'tag' | 'link';
  name: string;
  file?: string;
  extractedContents?: string[];
}

interface TrendingDataCache {
  items: TrendingItems;
  timeline: {
    tags: Map<string, TimelineItem[]>;
    links: Map<string, TimelineItem[]>;
  };
  lastUpdated: number;
}

export class FileIndexer {
  private tagIndex: Map<string, IndexEntry> = new Map();
  private tagSet: Set<string> = new Set();
  private linkIndex: Map<string, IndexEntry> = new Map();
  private linkSet: Set<string> = new Set();
  private folderIndex: Map<string, IndexEntry> = new Map();
  private folderSet: Set<string> = new Set();
  private watcher: chokidar.FSWatcher | null = null;
  public vaultPath: string | null = null;
  private spacesPath: string = "enzyme-spaces";
  public isIndexing: boolean = false;
  private indexQueue: Array<() => Promise<void>> = [];
  public totalFiles: number = 0;
  public processedFiles: number = 0;
  private excludedTags: string[] = [];
  private excludedPatterns: string[] = [];
  private includedPatterns: string[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private pendingChanges: Set<string> = new Set();
  private readonly BATCH_DELAY = 1000; // 1 second
  private batchProcessedFiles: number = 0;
  private batchTotalFiles: number = 0;
  private linkToFileMap: Map<string, string> = new Map();
  private logger: winston.Logger;
  private logPath: string = '.';
  private searchCache: Map<string, CachedSearchTerm> = new Map();
  private readonly CACHE_TTL = 5000; // Cache results for 5 seconds
  private readonly MIN_SEARCH_LENGTH = 2; // Only search for terms 2+ chars
  private serverContext: ServerContext = new ServerContext();
  private trendingCache: TrendingDataCache | null = null;
  public hasVaultInitialized: boolean = false;

  constructor() {
    // Initialize logger
    this.logPath = path.join(app.getPath('userData'), 'logs');
    this.logger = winston.createLogger({
      level: 'debug',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ 
          filename: path.join(this.logPath, 'error.log'), 
          level: 'error' 
        }),
        new winston.transports.File({ 
          filename: path.join(this.logPath, 'combined.log')
        })
      ]
    });
  }

  async initialize(vaultPath: string, includedPatterns: string[], excludedPatterns: string[], excludedTags: string[], doCache: boolean = false, spacesPath: string | null = null, port: number = 3779, defaultPatternLimit: number = 10): Promise<boolean> {
    this.hasVaultInitialized = false;
    this.isIndexing = true;
    
    try {
      if (!vaultPath || vaultPath.length === 0) {
        this.notify('Indexing Error', 'No vault path provided');
        this.logger.error('No vault path provided');
        return false;
      }

      // Verify the path exists and is accessible
      try {
        await fs.access(vaultPath, fs.constants.R_OK);
      } catch (error) {
        this.logger.error(`Cannot access vault path: ${error instanceof Error ? error.message : 'Unknown error'}`);
        this.notify('Indexing Error', `Cannot access vault path: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return false;
      }

      // Quick check for at least one markdown file
      try {
        const files = await this.getAllFiles(vaultPath);
        if (files.length === 0) {
          this.notify('Indexing Error', 'No markdown files found in the selected directory');
        }
        if (files.length > 100000) {
          this.notify('Indexing Error', 'Too many files (>100000) - please select a more specific directory');
        }
      } catch (error) {
        throw new Error(`Error scanning directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      this.logger.debug(`Initializing file indexer...`);
      this.logger.debug(`Excluded patterns: ${this.excludedPatterns}`);

      this.clearIndex();
      
      this.vaultPath = vaultPath;
      if (spacesPath) {
        this.spacesPath = spacesPath;
      }
      this.excludedTags = excludedTags.map(tag => tag.toLowerCase());
      this.excludedPatterns = excludedPatterns.map(pattern => pattern.toLowerCase());
      this.includedPatterns = includedPatterns.map(pattern => pattern.toLowerCase());

      const success = await this.indexDirectory(vaultPath);
      this.hasVaultInitialized = success;
      this.isIndexing = false;
      
      // Compute trending data cache after indexing is complete
      await this.computeTrendingDataCache();
      
      await this.serverContext.startServer(port);

      return true; // Return success
    } catch (error) {
      this.hasVaultInitialized = false;
      this.isIndexing = false;
      this.clearIndex();
      this.notify('Indexing Error', error instanceof Error ? error.message : 'Unknown error');
      return false; // Return failure
    }
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }

  private async performValidationChecksOnIndex(): Promise<void> {
    let filesWithoutCreationDate: string[] = [];
    let linksWithoutCreationDate: string[] = [];
    let foldersWithoutCreationDate: string[] = [];
    // Check that all files have a creation date
    for (const entry of this.tagIndex.values()) {
      for (const file of entry.files) {
        if (!file.createdAt) {
          filesWithoutCreationDate.push(file.path);
        }
      }
    }

    // Check that all links have a creation date
    for (const entry of this.linkIndex.values()) {
      for (const file of entry.files) {
        if (!file.createdAt) {
          linksWithoutCreationDate.push(file.path);
        }
      }
    }

    // Check that all folders have a creation date
    for (const entry of this.folderIndex.values()) {
      for (const file of entry.files) {
        if (!file.createdAt) {
          foldersWithoutCreationDate.push(file.path);
        }
      }
    }

    if (filesWithoutCreationDate.length > 0 || linksWithoutCreationDate.length > 0 || foldersWithoutCreationDate.length > 0) {
      this.logger.warn(`\n=== Validation Check Warnings ===\n` +
                   `Files without creation date: ${filesWithoutCreationDate.length}\n` +
                   `Links without creation date: ${linksWithoutCreationDate.length}\n` +
                   `Folders without creation date: ${foldersWithoutCreationDate.length}\n`);

      // Print just the first 10 files, links, and folders
      if (filesWithoutCreationDate.length > 0) {
          this.logger.warn(`\tFiles (first 10): ${filesWithoutCreationDate.slice(0, 10).join(', ')}`);
      }
      if (linksWithoutCreationDate.length > 0) {
          this.logger.warn(`\tLinks (first 10): ${linksWithoutCreationDate.slice(0, 10).join(', ')}`);
      }
      if (foldersWithoutCreationDate.length > 0) {
          this.logger.warn(`\tFolders (first 10): ${foldersWithoutCreationDate.slice(0, 10).join(', ')}`);
      }
    }
  }
  
  private async indexDirectory(vaultPath: string): Promise<boolean> {
    this.logger.info(`Starting to index directory: ${vaultPath}`);

    if (!vaultPath || vaultPath.length === 0) {
      return false;
    }

    try {
      const files = await this.getAllFiles(vaultPath);
      const totalFilesFound = files.length;
      
      this.logger.info(`Found ${totalFilesFound} markdown files in directory: ${vaultPath}`);

      // Log first 5 files that will be indexed
      if (totalFilesFound > 0) {
        const firstFiveFiles = files.slice(0, 5);
        this.logger.info('First 5 markdown files to be indexed:');
        firstFiveFiles.forEach((file, index) => {
          this.logger.info(`${index + 1}. ${path.relative(vaultPath, file)}`);
        });
      } else {
        this.logger.warn('No markdown files found in the directory');
        return false;
      }

      this.processedFiles = 0;
      this.totalFiles = totalFilesFound;
      this.batchTotalFiles = 0;  // Reset batch counters
      this.batchProcessedFiles = 0;

      // Disable the watcher temporarily during initial indexing
      if (this.watcher) {
        this.logger.info('Closing the file watcher temporarily');
        await this.watcher.close();
        this.watcher = null;
      }

      this.logger.info('Starting to process files...');
      let indexedFiles = 0;
      let skippedFiles = 0;

      if (!this.vaultPath) {
        this.logger.error('Vault path is not set');
        return false;
      }

      await Promise.all(files.map(async (file) => {
        try {
          const relativePath = path.relative(this.vaultPath!, file);

          const { content, stats, frontmatter, tags, links } = await this.getFileData(file);
          
          this.linkToFileMap.set(path.basename(file), file);
          
          const isIncluded = await this.shouldIncludeFile(file);

          if (isIncluded) {
            await this.indexFile(content, stats, frontmatter, tags, links, file);
            // Log details of first 5 successfully indexed files
            if (indexedFiles < 5) {
              this.logger.info(`Successfully indexed file ${indexedFiles + 1}: ${relativePath}
                Tags: ${tags.length > 0 ? tags.join(', ') : 'none'}
                Links: ${links.length > 0 ? links.join(', ') : 'none'}`);
              indexedFiles++;
            }
          } else {
            skippedFiles++;
          }
          this.processedFiles++;
        } catch (error) {
          this.logger.error(`Error processing file ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          skippedFiles++;
        }
      }));

      if (skippedFiles > 0) {
        this.logger.info(`Skipped ${skippedFiles} files during indexing`);
      }

      return true;
    } catch (error) {
      this.logger.error(`Error during indexing: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    } finally {
      
      // Perform validation checks on the index
      this.logger.info('Performing validation checks on the index');
      await this.performValidationChecksOnIndex();
      
      // Reinitialize the watcher
      if (this.vaultPath) {
        this.logger.info('Reinitializing the file watcher');
        this.watcher = chokidar.watch(this.includedPatterns.map(pattern => path.join(this.vaultPath!, pattern)), {
          ignored: [
            ...this.excludedPatterns
          ],
          persistent: true
        });

        let isInitialScan = true;

        this.watcher
          .on('ready', () => {
            isInitialScan = false;
            this.logger.info('Initial scan complete');
          })
          .on('add', path => {
            if (!isInitialScan) {
              this.logger.debug(`New file created: ${path}`);
            }
            this.handleFileChange(path);
          })
          .on('change', path => {
            this.handleFileChange(path);
          })
          .on('unlink', path => {
            this.handleFileRemoval(path);
          });
        
        this.logger.info('File watcher reinitialized successfully');
      }
    }
  }

  public clearIndex(): void {
    this.tagIndex = new Map();
    this.linkIndex = new Map();
    this.folderIndex = new Map();
  }

  public getFileFromLink(link: string): string | null {
    const cleanLink = link.replace(/\[\[|\]\]/g, '');
    return this.linkToFileMap.get(cleanLink) || null;
  }

  private async getFileData(filePath: string): Promise<{content: string, stats: any, frontmatter: any, tags: string[], links: string[]}> {
    return fs.readFile(filePath, 'utf-8').then(async content => {
      const stats = await fs.stat(filePath);
      let frontmatter: any = {};
      let tags: string[] = [];
      let links: string[] = [];

      try {
        const parsedMatter = matter.default(content);
        frontmatter = parsedMatter.data;
        tags = this.extractTags(frontmatter, content);
        links = this.extractMarkdownLinks(content);
      } catch (error) {
        // console.error(`Error parsing frontmatter for file ${filePath}:`, error);
      }

      frontmatter = {
        ...frontmatter,
        createdAt: await getFileCreationDate(frontmatter, filePath)
      };

      return { content, stats, frontmatter, tags, links };
    });
  }

  private matchPattern(str: string, pattern: string): boolean {
    return minimatch(str, pattern, { dot: true });
  };

  private async getAllFiles(dir: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const files = await Promise.all(entries.map(async (entry) => {
        // Skip .obsidian folder and other excluded patterns
        if (this.shouldSkipEntry(entry.name, dir)) {
          this.logger.debug(`Skipping excluded entry: ${entry.name}`);
          return [];
        }
        
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          return this.getAllFiles(fullPath);
        }
        
        // Only include markdown files that match our inclusion/exclusion criteria
        if (await this.shouldIncludeFile(fullPath)) {
          return [fullPath];
        }
        
        return [];
      }));

      const allFiles = files.flat();
      
      if (allFiles.length === 0) {
        this.logger.debug(`No includable files found in directory: ${dir}`);
      } else {
        this.logger.debug(`Found ${allFiles.length} includable files in directory: ${dir}`);
      }
      
      return allFiles;
    } catch (error) {
      this.logger.error(`Error reading directory ${dir}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }

  private shouldSkipEntry(entryName: string, dir: string): boolean {
    // Always skip .obsidian folder
    if (entryName === '.obsidian') {
      return true;
    }

    // Skip any paths that match excluded patterns
    const relativePath = this.vaultPath ? path.relative(this.vaultPath, path.join(dir, entryName)) : entryName;
    return this.excludedPatterns.some(pattern => this.matchPattern(relativePath, pattern));
  }

  private async shouldIncludeFile(filePath: string): Promise<boolean> {
    // Only include markdown files
    if (!filePath.toLowerCase().endsWith('.md')) {
      this.logger.debug(`Skipped non-markdown file: ${filePath}`);
      return false;
    }

    // Check file content and tags
    try {
      const { tags } = await this.getFileData(filePath);
      
      // Check for excluded tags
      const hasExcludedTag = tags.some(tag => {
        const normalizedTag = tag.toLowerCase();
        return this.excludedTags.includes(normalizedTag) || 
               this.excludedTags.some(pattern => this.matchPattern(normalizedTag, pattern));
      });

      if (hasExcludedTag) {
        this.logger.debug(`Excluded file by tags: ${filePath}`);
        return false;
      }

      // Check path patterns
      
      const isExcluded = this.excludedPatterns.some(pattern => 
        this.matchPattern(filePath, pattern)
      );
      
      if (isExcluded) {
        this.logger.debug(`Excluded file ${filePath} using pattern ${JSON.stringify(this.excludedPatterns)}`);
        return false;
      }

      const isIncluded = this.includedPatterns.some(pattern => 
        this.matchPattern(filePath, pattern)
      );
      
      if (!isIncluded) {
        this.logger.debug(`File does not match any include patterns: ${filePath}, using pattern ${JSON.stringify(this.includedPatterns)}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`Error checking file inclusion for ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  private async indexFileByPath(filePath: string): Promise<void> {
    try {
      const { content, stats, frontmatter, tags, links } = await this.getFileData(filePath);
      
      if (await this.shouldIncludeFile(filePath)) {
        await this.indexFile(content, stats, frontmatter, tags, links, filePath);
      }
    } catch (error) {
      this.logger.error(`Error indexing file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async indexFile(content: string, stats: any, frontmatter: any, tags: string[], links: string[], filePath: string): Promise<void> {
    try {
      // Create variations of the file path for links
      const basePath = filePath.replace(/\.md$/, '');

      // Only index links that are .md files
      if (filePath.toLowerCase().endsWith('.md')) {
        const linkVariations = [
          basePath, // The whole file path
          path.basename(basePath), // The file name by itself
        ];

        linkVariations.forEach(variation => {
          this.linkToFileMap.set(variation, filePath);
        });
      }

      // Extract metadata
      const metadata: FileMetadata = {  
        path: filePath,
        createdAt: frontmatter.createdAt,  
        tags: tags, 
        links: links,
        lastModified: stats.mtimeMs
      };

      this.updateTagIndex(metadata);
      this.updateLinkIndex(metadata);
      this.updateFolderIndex(metadata);

      this.processedFiles++;

    } catch (error) {
      // console.error(`Error indexing file ${filePath}:`, error);
    }
  }

  private removeFromIndex(filePath: string): void {
    const removeFromMap = (map: Map<string, IndexEntry>) => {
      for (const [key, entry] of map.entries()) {
        entry.files = entry.files.filter(f => f.path !== filePath);
        if (entry.files.length === 0) {
          map.delete(key);
        }
      }
    };

    removeFromMap(this.tagIndex);
    removeFromMap(this.linkIndex);
    removeFromMap(this.folderIndex);
  }

  private extractTags(frontMatter: any, content: string): string[] {
    const frontMatterTags = frontMatter.tags || [];  
    const contentTags = (content.match(/#[\w-\/]+/g) || [])
      .map(tag => tag.substring(1));
    
    const allTags = [...new Set([...frontMatterTags, ...contentTags])];
    return allTags;
  }

  // Extracts links from the content using regex and returns the link without the brackets
  private extractMarkdownLinks(content: string): string[] {
    const links = content.match(/\[\[(.*?)\]\]/g) || [];
    return [...new Set(links.map(link => link.slice(2, -2)))];
  }

  private updateTagIndex(metadata: FileMetadata): void {
    metadata.tags.forEach(tag => {
      const normalizedTag = tag.toLowerCase();
      const entry = this.tagIndex.get(normalizedTag) || { files: [] };
      entry.files = entry.files.filter(f => f.path !== metadata.path);
      entry.files.push(metadata);
      entry.files.sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
      this.tagIndex.set(normalizedTag, entry);
      this.tagSet.add(normalizedTag);
    });
  }

  private updateLinkIndex(metadata: FileMetadata): void {
    metadata.links.forEach(link => {
      const path = this.getFileFromLink(link);
      if (!path) return;
      if (this.excludedPatterns.some(regex => this.matchPattern(path, regex))) {
        return;
      }
      const entry = this.linkIndex.get(link) || { files: [] };
      entry.files = entry.files.filter(f => f.path !== metadata.path);
      entry.files.push(metadata);
      entry.files.sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
      this.linkIndex.set(link, entry);
      this.linkSet.add(link);
    });
  }

  private updateFolderIndex(metadata: FileMetadata): void {
    const folder = path.dirname(metadata.path);
    const folderSuffix = folder.replace(this.vaultPath || '', '').replace(/^\/+/, '');
    const entry = this.folderIndex.get(folderSuffix) || { files: [] };
    entry.files = entry.files.filter(f => f.path !== metadata.path);
    entry.files.push(metadata);
    entry.files.sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    this.folderIndex.set(folderSuffix, entry);
    this.folderSet.add(folderSuffix);
  }

  getFilesForTag(tag: string): FileMetadata[] {
    if (this.isIndexing) {
      throw new Error('Indexing in progress');
    }
    return this.tagIndex.get(tag.toLowerCase())?.files || [];
  }

  getFilesForLink(link: string): FileMetadata[] {
    if (this.isIndexing) {
      throw new Error('Indexing in progress');
    }
    return this.linkIndex.get(link)?.files || [];
  }

  getFilesInFolder(folderPath: string): FileMetadata[] {
    if (this.isIndexing) {
      throw new Error('Indexing in progress');
    }
    // Normalize the path to remove trailing slashes but keep the full path
    const normalizedPath = path.normalize(folderPath).replace(/\/$/, '');
    return this.folderIndex.get(normalizedPath)?.files || [];
  }

  private async handleFileChange(filePath: string): Promise<void> {
    this.pendingChanges.add(filePath);

    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    this.batchTimeout = setTimeout(async () => {
      const filesToProcess = Array.from(this.pendingChanges);
      this.pendingChanges.clear();
      
      if (filesToProcess.length === 0) return;

      try {
        this.isIndexing = true;
        this.batchTotalFiles = filesToProcess.length;
        this.batchProcessedFiles = 0;

        // Process all files in batch
        await Promise.all(filesToProcess.map(async (file) => {
          await this.indexFileByPath(file);
          this.batchProcessedFiles++;
        }));

        this.processedFiles += this.batchProcessedFiles;

        // Compute new trending data and emit via IPC
        await this.computeTrendingDataCache();
        const { items: trendingItems, timeline } = this.getTrendingData();
        
        // Format the data for the frontend
        const enrichedData = {
          tags: trendingItems.tags.map(tag => ({
            ...tag,
            timeline: timeline.tags.get(tag.name) || []
          })),
          links: trendingItems.links.map(link => ({
            ...link,
            timeline: timeline.links.get(link.name) || []
          }))
        };

        // ipcRenderer.send('trending-data-updated', enrichedData);

      } finally {
        this.isIndexing = false;
        this.processQueue();
      }
    }, this.BATCH_DELAY);
  }

  private async handleFileRemoval(filePath: string): Promise<void> {
    this.removeFromIndex(filePath);
  }

  private async processQueue(): Promise<void> {
    if (this.indexQueue.length === 0 || this.isIndexing) {
      return;
    }

    const nextTask = this.indexQueue.shift();
    if (nextTask) {
      try {
        this.isIndexing = true;
        await nextTask();
      } finally {
        this.isIndexing = false;
        // Use setImmediate to prevent stack overflow with large queues
        setImmediate(() => this.processQueue());
      }
    }
  }

  async emit(event: string, data: any) {
    // Import electron at the top if not already present
    this.logger.info(`Event: ${event} (${JSON.stringify(data)})`);
  }

  private computeTrendingItems(): TrendingItems {
    const now = new Date();
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    
    // First check files from last 3 months
    const recentUniqueFiles = new Set<string>();
    
    // Count recent files first
    this.tagIndex.forEach(entry => {
        entry.files
            .filter(f => f.createdAt >= threeMonthsAgo)
            .forEach(f => recentUniqueFiles.add(f.path));
    });
    this.linkIndex.forEach(entry => {
        entry.files
            .filter(f => f.createdAt >= threeMonthsAgo)
            .forEach(f => recentUniqueFiles.add(f.path));
    });

    // If we have fewer than 200 recent files, use all files without time filter
    const useTimeFilter = recentUniqueFiles.size >= 200;
    const tagCounts = new Map<string, number>();
    const linkCounts = new Map<string, number>();

    // Process tag index
    this.tagIndex.forEach((entry, tag) => {
        const relevantFiles = useTimeFilter ? 
            entry.files.filter(f => f.createdAt >= threeMonthsAgo) :
            entry.files;
        if (relevantFiles.length > 0) {
            tagCounts.set(tag, relevantFiles.length);
        }
    });

    // Process link index
    this.linkIndex.forEach((entry, link) => {
        const relevantFiles = useTimeFilter ? 
            entry.files.filter(f => f.createdAt >= threeMonthsAgo) :
            entry.files;
        if (relevantFiles.length > 0) {
            linkCounts.set(link, relevantFiles.length);
        }
    });

    const sortByCount = (a: [string, number], b: [string, number]) => b[1] - a[1];
    
    // Get all items sorted by count
    const sortedTags = Array.from(tagCounts.entries()).sort(sortByCount);
    const sortedLinks = Array.from(linkCounts.entries()).sort(sortByCount);

    // Always limit to 40 of each type
    const topTags = sortedTags
        .slice(0, 40)
        .map(([name, count]) => ({ name, count }));

    const topLinks = sortedLinks
        .slice(0, 40)
        .map(([name, count]) => ({ name, count }));

    return { tags: topTags, links: topLinks };
  }

  async notify(title: string, body: string) {
    this.logger.info(`Notification: ${title} (${body})`);
  }

  getFileMetadata(filePath: string): FileMetadata | undefined {
    // Check all indices for the file
    for (const index of [this.tagIndex, this.linkIndex, this.folderIndex]) {
      for (const entry of index.values()) {
        const metadata = entry.files.find(f => f.path === filePath);
        if (metadata) {
          return metadata;
        }
      }
    }
    return undefined;
  }

  private async createMarkdownFile(folderPath: string, submission: SpaceSubmission): Promise<void> {
    try {
      // Ensure the folder exists
      await fs.mkdir(folderPath, { recursive: true });

      // Create filename from title (sanitize and add timestamp)
      const timestamp = new Date(submission.timestamp).toISOString().split('T')[0];
      const sanitizedTitle = submission.title.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
      const filename = `${timestamp}-${sanitizedTitle}.md`;
      const filePath = path.join(folderPath, filename);

      // Build markdown content with frontmatter
      let content = '---\n';
      content += `date: [[${timestamp}]]\n`;
      if (submission.tags && submission.tags.length > 0) {
        content += `tags:\n${submission.tags.map(tag => `  - ${tag}`).join('\n')}\n`;
      }
      content += '---\n\n';
      content += submission.text;

      // Write the file
      await fs.writeFile(filePath, content, 'utf-8');

      // Index the new file
      const stats = await fs.stat(filePath);
      const { frontmatter, tags } = await this.getFileData(filePath);
      await this.indexFile(content, stats, frontmatter, tags, [], filePath);

      this.logger.info(`Created and indexed new submission file: ${filePath}`);
    } catch (error) {
      this.logger.error(`Error creating markdown file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  public async createSpaceSubmission(destinationFolder: string, submission: SpaceSubmission): Promise<void> {
    if (!this.vaultPath) {
      throw new Error('No vault path configured');
    }

    const fullPath = path.join(this.vaultPath, this.spacesPath, destinationFolder);
    await this.createMarkdownFile(fullPath, submission);
  }

  public getTags(): Set<string> {
    return this.tagSet;
  }

  public getLinks(): Set<string> {
    return this.linkSet;
  }

  private fuzzyMatch(pattern: string, str: string, fileCount: number): number | null {
    if (pattern.length > str.length) return null;
    
    pattern = pattern.toLowerCase();
    str = str.toLowerCase();
    
    let score = 0;
    let patternIdx = 0;
    let prevMatchIdx = -1;
    
    for (let strIdx = 0; strIdx < str.length && patternIdx < pattern.length; strIdx++) {
      if (pattern[patternIdx] === str[strIdx]) {
        // Consecutive matches score higher
        score += prevMatchIdx === strIdx - 1 ? 2 : 1;
        // Matches at start or after separators score higher
        if (strIdx === 0 || str[strIdx - 1] === ' ' || str[strIdx - 1] === '-' || str[strIdx - 1] === '_') {
          score += 3;
        }
        prevMatchIdx = strIdx;
        patternIdx++;
      }
    }
    
    // Only return score if we matched the full pattern
    if (patternIdx === pattern.length) {
      // Add file count to the score, but normalize it to prevent overwhelming the match quality
      // Log scale helps prevent very popular items from completely dominating
      const fileCountBonus = Math.log10(fileCount + 1) * 2;
      return score + fileCountBonus;
    }
    
    return null;
  }

  public queryForTagsAndLinks(searchTerm: string): QueryResult {
    // Return empty results for empty or short searches
    if (!searchTerm || searchTerm.length < this.MIN_SEARCH_LENGTH) {
      return { tags: [], links: [] };
    }

    // Check cache first
    const cached = this.searchCache.get(searchTerm);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.results;
    }

    const maxResults = 10;
    const results: QueryResult = { tags: [], links: [] };
    
    // Helper function to collect and sort matches
    const collectMatches = (items: Set<string>, getFileCount: (item: string) => number): string[] => {
      const matches: Array<{ item: string; score: number }> = [];
      
      for (const item of items) {
        const fileCount = getFileCount(item);
        const score = this.fuzzyMatch(searchTerm, item, fileCount);
        if (score !== null) {
          matches.push({ item, score });
          if (matches.length > maxResults * 2) { // Collect a few extra for better sorting
            matches.sort((a, b) => b.score - a.score);
            matches.length = maxResults * 2;
          }
        }
      }
      
      return matches
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults)
        .map(m => m.item);
    };

    // Get file counts for tags and links
    const getTagFileCount = (tag: string) => this.tagIndex.get(tag)?.files.length ?? 0;
    const getLinkFileCount = (link: string) => this.linkIndex.get(link)?.files.length ?? 0;

    // Collect matches for tags and links with their respective file counts
    results.tags = collectMatches(this.tagSet, getTagFileCount);
    results.links = collectMatches(this.linkSet, getLinkFileCount);

    // Cache the results
    this.searchCache.set(searchTerm, {
      term: searchTerm,
      results,
      timestamp: Date.now()
    });

    // Clean up old cache entries periodically
    if (this.searchCache.size > 100) { // Prevent cache from growing too large
      const now = Date.now();
      for (const [key, value] of this.searchCache.entries()) {
        if (now - value.timestamp > this.CACHE_TTL) {
          this.searchCache.delete(key);
        }
      }
    }

    return results;
  }

  public getEntityTimeline(entities: Array<[string, { type: 'tag' | 'link'; count: number }]>): TimelineItem[] {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3); // Changed to 3 months
    
    const timeline: TimelineItem[] = [];
    
    entities.forEach(([name, { type, count }]) => {
        const index = type === 'tag' ? this.tagIndex : this.linkIndex;
        
        const cleanName = type === 'tag' ? 
            name.replace(/^#/, '') : 
            name.replace(/^\[\[|\]\]$/g, '');
        
        const entry = index.get(cleanName);
        
        if (entry) {
            const filteredFiles = entry.files
                .filter(file => file.createdAt >= threeMonthsAgo);
            
            // If we have fewer than 50 total items, include all files
            const fileLimit = filteredFiles.length < 50 ? filteredFiles.length : count;
            
            filteredFiles
                .slice(0, fileLimit)
                .forEach(file => {
                    timeline.push({
                        date: file.createdAt,
                        type,
                        name,
                        file: file.path
                    });
                });
        }
    });
    
    return timeline.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private async computeTrendingDataCache(): Promise<void> {
    this.logger.info('Starting to compute trending data cache...');
    this.isIndexing = true;

    // Log the current state
    this.logger.info(`Current index state: ${this.tagIndex.size} tags, ${this.linkIndex.size} links`);

    const trendingItems = this.computeTrendingItems();

    // Log trending items stats
    this.logger.info(`Computed trending items: ${trendingItems.tags.length} tags, ${trendingItems.links.length} links`);

    const timeline = {
      tags: new Map<string, TimelineItem[]>(),
      links: new Map<string, TimelineItem[]>()
    };

    // Pre-compute timeline for trending tags
    this.logger.info('Computing timeline for trending tags...');
    for (const tag of trendingItems.tags) {
      const timelineItems = this.getEntityTimeline([[tag.name, { type: 'tag', count: tag.count }]]);
      timeline.tags.set(tag.name, timelineItems);
      this.logger.debug(`Tag "${tag.name}": ${timelineItems.length} timeline items, ${tag.count} total occurrences`);
    }

    // Pre-compute timeline for trending links
    this.logger.info('Computing timeline for trending links...');
    for (const link of trendingItems.links) {
      const timelineItems = this.getEntityTimeline([[link.name, { type: 'link', count: link.count }]]);
      timeline.links.set(link.name, timelineItems);
      this.logger.debug(`Link "${link.name}": ${timelineItems.length} timeline items, ${link.count} total occurrences`);
    }

    this.trendingCache = {
      items: trendingItems,
      timeline,
      lastUpdated: Date.now()
    };

    // Log final stats
    this.logger.info(`Trending cache update complete. Cache contains:
      - ${trendingItems.tags.length} trending tags
      - ${trendingItems.links.length} trending links
      - ${Array.from(timeline.tags.values()).reduce((sum, items) => sum + items.length, 0)} total tag timeline items
      - ${Array.from(timeline.links.values()).reduce((sum, items) => sum + items.length, 0)} total link timeline items
      - Last updated: ${new Date(this.trendingCache.lastUpdated).toISOString()}`);

    this.isIndexing = false;
  }

  public getTrendingData(): { items: TrendingItems; timeline: { tags: Map<string, TimelineItem[]>; links: Map<string, TimelineItem[]>; } } {
    if (!this.trendingCache) {
      throw new Error('Trending data cache not initialized');
    }
    return {
      items: this.trendingCache.items,
      timeline: this.trendingCache.timeline
    };
  }
}

let instance: FileIndexer | null = null;

export function getFileIndexer(): FileIndexer {
  if (!instance) {
    console.log("Creating new FileIndexer");
    instance = new FileIndexer();
  }
  return instance;
}