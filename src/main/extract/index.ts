import { promises as fs } from 'fs';
import * as path from 'path';
const matter = require('gray-matter');
import { LRU } from 'tiny-lru';
import { getFileCreationDate } from '../utils.js';
import { getFileIndexer } from '../indexer/index.js';
import { getFileIndexer as getElectronFileIndexer } from '../indexer/electron.js';

let cacheInstance: LRU<{ frontmatter: any; contents: string }> | null = null;

function getCache(): LRU<{ frontmatter: any; contents: string }> {
  if (!cacheInstance) {
    cacheInstance = new LRU<{ frontmatter: any; contents: string }>(
      10000,
      1000 * 60 * 30 // 30 minutes
    );
  }
  return cacheInstance;
}

async function readFilesInBatch(files: string[]): Promise<Map<string, { frontmatter: any; contents: string }>> {
  const results = new Map();
  const uncachedFiles = [];
  const cache = getCache();

  // Check cache first
  for (const file of files) {
    const cached = cache.get(file);
    if (cached) {
      results.set(file, cached);
    } else {
      uncachedFiles.push(file);
    }
  }

  // Read uncached files in parallel
  if (uncachedFiles.length > 0) {
    const fileContents = await Promise.all(
      uncachedFiles.map(file => fs.readFile(file, 'utf-8'))
    );

    for (let i = 0; i < uncachedFiles.length; i++) {
      const file = uncachedFiles[i];
      const content = fileContents[i];
      try {
        const { data: frontmatter, content: fileContent } = matter(content);

        // Process tags to remove '#' prefix if present
        let tags = Array.isArray(frontmatter.tags) 
          ? frontmatter.tags 
          : frontmatter.tags?.split(',').map(tag => tag.trim()) || [];

        // Remove '#' prefix from tags if present
        tags = tags.map(tag => tag.startsWith('#') ? tag.slice(1) : tag);
        frontmatter.tags = tags;

        const result = { frontmatter, contents: fileContent };
        cache.set(file, result);
        results.set(file, result);
      } catch (error) {
        results.set(file, { frontmatter: {}, contents: content });
      }
    }
  }

  return results;
}

export enum MatchType {
  Tag = 'tag',
  MarkdownLink = 'markdownLink',
  Folder = 'folder',
}

export interface QueryPattern {
  type: MatchType;
  value: string;
  modifier?: string
}


export interface MatchResult {
  file: string;
  tags: string[];
  links: string[];
  extractedContents: string[];
  lastModified: number;
  createdAt: Date;
}


export interface Match {
  type: MatchType;
  value: string;
}

export type ExtractedContent = {
  title: string,
  contents: string
}

export async function getAllFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry: any) => {
    const res = path.join(directory, entry.name);
    return entry.isDirectory() ? getAllFiles(res) : res;
  }));
  return files.flat();
}

interface FileWithMatches {
  path: string;
  matches: Match[];
  createdAt: Promise<Date>;
}

interface FilteredFile {
  path: string;
  matches: Match[];
  createdAt: Date;
}

function collectFilesForPattern(pattern: QueryPattern, useElectronFileIndexer: boolean = true): FileWithMatches[] {
  let files: {path: string}[] = [];

  const fileIndexer = useElectronFileIndexer ? getElectronFileIndexer() : getFileIndexer();
  
  switch (pattern.type) {
    case MatchType.Tag:
      files = fileIndexer.getFilesForTag(pattern.value);
      break;
    case MatchType.MarkdownLink:
      files = fileIndexer.getFilesForLink(pattern.value);
      break;
    case MatchType.Folder:
      files = fileIndexer.getFilesInFolder(pattern.value);
      break;
  }

  return files.map(f => ({
    path: path.isAbsolute(f.path) ? f.path : path.join(fileIndexer.vaultPath || '', f.path),
    matches: [{ type: pattern.type, value: pattern.value }],
    createdAt: getFileCreationDate({}, f.path)
  }));
}

async function applyPatternModifiers(
  files: FileWithMatches[], 
  pattern: QueryPattern, 
  defaultPatternLimit: number
): Promise<FilteredFile[]> {
  const filesWithDates = await Promise.all(
    files.map(async f => ({
      ...f,
      createdAt: await f.createdAt
    }))
  );

  let filteredFiles = [...filesWithDates];
  
  if (pattern.modifier) {
    if (pattern.modifier.startsWith('<') || pattern.modifier.startsWith('>')) {
      const limit = parseInt(pattern.modifier.slice(1)) || 30;
      filteredFiles = filteredFiles
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit);
    } else if (pattern.modifier.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const date = new Date(pattern.modifier);
      filteredFiles = filteredFiles.filter(result => result.createdAt > date);
    } else if (pattern.modifier.endsWith('w') || pattern.modifier.endsWith('m')) {
      const value = parseInt(pattern.modifier.slice(0, -1));
      const unit = pattern.modifier.slice(-1);
      if (!isNaN(value)) {
        const cutoffDate = new Date();
        if (unit === 'w') {
          cutoffDate.setDate(cutoffDate.getDate() - value * 7);
        } else if (unit === 'm') {
          cutoffDate.setMonth(cutoffDate.getMonth() - value);
        }
        filteredFiles = filteredFiles.filter(result => result.createdAt > cutoffDate);
      }
    }
  } else {
    filteredFiles = filteredFiles.slice(0, defaultPatternLimit);
  }

  return filteredFiles;
}

export function extractContentForMatch(
  contents: string,
  match: Match,
  frontmatter: any
): string[] {
  const extractedContents: string[] = [];

  if (match.type === MatchType.Tag) {
    const frontMatterTags = frontmatter.tags || [];
    if (frontMatterTags.some((tag: string) => tag.toLowerCase() === match.value.toLowerCase())) {
      extractedContents.push(contents);
    } else {
      extractedContents.push(...getLassoContext(contents, match.value, 250));
    }
  } else {
    getLassoContext(contents, match.value, 250).forEach(context => {
      extractedContents.push(context);
    });
  }

  return extractedContents;
}

export async function extractPatterns(
  patterns: QueryPattern[], 
  defaultPatternLimit: number = 10
): Promise<MatchResult[]> {
  // Collect and filter files for each pattern
  const fileMatches = new Map<string, Match[]>();
  const finalFileList = new Set<string>();
  
  await Promise.all(patterns.map(async pattern => {
    const files = collectFilesForPattern(pattern);
    const filteredFiles = await applyPatternModifiers(files, pattern, defaultPatternLimit);

    // Accumulate matches and build final file list
    filteredFiles.forEach(f => {
      finalFileList.add(f.path);
      const existingMatches = fileMatches.get(f.path) || [];
      fileMatches.set(f.path, [...existingMatches, ...f.matches]);
    });
  }));

  // Read contents of filtered files
  const fileContents = await readFilesInBatch([...finalFileList]);

  // Process contents and create final results
  const results = await Promise.all([...finalFileList].map(async file => {
    const matches = fileMatches.get(file) || [];
    const fileContent = fileContents.get(file);
    if (!fileContent) return undefined;

    const { frontmatter, contents } = fileContent;

    // Extract tags from file contents and normalize them (remove # prefix)
    const fileTags = (contents.match(/#[\w-\/]+/g) || [])
      .map(tag => tag.slice(1)); // Remove # prefix

    // Get frontmatter tags (already normalized in readFilesInBatch)
    const frontmatterTags = frontmatter.tags || [];

    // Combine all tags
    const augmentedTags = [...new Set([...frontmatterTags, ...fileTags])];

    const fileLinks = [...new Set(contents.match(/\[\[([^\]]+)\]\]/g) || [])];

    // Skip empty files or files with only whitespace
    if (!contents || contents.trim().length === 0) {
      return undefined;
    }

    // Preprocess by replacing embeds
    const processedContents = await replaceEmbeds(contents);
    
    // Skip if processed contents are empty after embed replacement
    if (!processedContents || processedContents.trim().length === 0) {
      return undefined;
    }
    
    // Extract all unique contexts across all matches
    const extractedContexts = matches.flatMap(match => {
      if (match.type === MatchType.Tag || match.type === MatchType.MarkdownLink) {
        return extractContentForMatch(processedContents, match, frontmatter);
      } else {
        // Lasso extraction doesn't apply to folders
        return [processedContents];
      }
    });

    // Get unique contexts and skip if none found
    const uniqueContexts = [...new Set(extractedContexts)].filter(context => 
      context && context.trim().length > 0
    );

    if (uniqueContexts.length === 0) return undefined;

    // Get the file metadata from indexer to access lastModified
    const fileMetadata = getElectronFileIndexer().getFileMetadata(file);
    if (!fileMetadata) return undefined;

    return {
      file,
      tags: augmentedTags,
      links: fileLinks,
      extractedContents: uniqueContexts,
      lastModified: fileMetadata.lastModified,
      createdAt: await getFileCreationDate(frontmatter, file)
    };
  }));

  return results.filter((result): result is MatchResult => result !== undefined);
}

export async function replaceEmbeds(contents: string): Promise<string> {
  const embedRegex = /!\[\[([^\]]+)\]\]/g;
  let modifiedContents = contents;
  const matches = [...contents.matchAll(embedRegex)];

  if (matches.length === 0) {
    // Base case: no embeds found, return the contents as is
    return modifiedContents;
  }

  await Promise.all(matches.map(async match => {
    const [fullMatch, reference] = match;
    const [baseLink, suffix] = reference.split('#');
    const file = getElectronFileIndexer().getFileFromLink(baseLink) || '';
    
    let replacement = '';
    let failed = false;

    if (file) {
      
      if (suffix) {
        try {
          if (suffix.startsWith('^')) {
            // Block reference case: ![[link#^blockref]]
            replacement = await extractBlockReference(file, suffix.slice(1));
            if (!replacement) {
              failed = true;
            }
          } else {
            // Heading case: ![[link#heading]]
            replacement = await extractHeadingSection(file, suffix);
            if (!replacement) {
              failed = true;
            }
          }
        } catch (error) {
          console.warn(`Failed to process embed ${file}: ${error}`);
          failed = true;
        }
      } else {
        // Full file embed
        try {
          const fileContents = await fs.readFile(file, 'utf-8');
          replacement = fileContents;
        } catch {
          failed = true;
        }
      }

      const embedReplacementPrefix = `[Excerpt from ${file}]`;

      if (failed) {
        // In case the heading or block reference is not found
        replacement = await fs.readFile(file, 'utf-8');
      }

      const formattedReplacement = replacement ? 
        `\n${embedReplacementPrefix}:\n${replacement.replace(/\n/g, '\n>')}` :
        embedReplacementPrefix;
      modifiedContents = modifiedContents.replace(fullMatch, formattedReplacement);
    } else {
      if (file.endsWith('.md')) {
        modifiedContents = modifiedContents.replace(fullMatch, "[Failed to load excerpt from: " + baseLink + "]");
      } else {
        modifiedContents = modifiedContents.replace(fullMatch, "");
      }
    }
  }));

  // Recursively call replaceEmbeds on the modified contents
  return replaceEmbeds(modifiedContents);
}

async function extractBlockReference(file: string, blockRef: string): Promise<string> {
  const fileContents = await fs.readFile(file, 'utf-8');
  const lines = fileContents.split('\n');
  
  // Find the line with the block reference
  let blockLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`^${blockRef}`)) {
      blockLine = i;
      break;
    }
  }

  if (blockLine === -1) {
    return ''
  }

  // Get the content before the block reference on the same line
  const content = lines[blockLine].split(`^${blockRef}`)[0].trim();
  return content;
}

async function extractHeadingSection(file: string, heading: string): Promise<string> {
  const fileContents = await fs.readFile(file, 'utf-8');
  const lines = fileContents.split('\n');
  let content: string[] = [];
  let isCapturing = false;
  let currentLevel = 0;

  const getHeadingLevel = (line: string) => {
    const match = line.match(/^(#{1,6})\s/);
    return match ? match[1].length : 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.startsWith('#')) {
      const level = getHeadingLevel(line);
      const headingText = line.replace(/^#+\s/, '').trim();

      if (headingText.toLowerCase() === heading.toLowerCase()) {
        isCapturing = true;
        currentLevel = level;
        continue;
      }

      if (isCapturing && level <= currentLevel) {
        break;
      }
    }

    if (isCapturing) {
      content.push(line);
    }
  }

  if (content.length === 0) {
    return '';
  }

  return content.join('\n').trim();
}

function getLassoContext(content: string, match: string, wordCount: number): string[] {
  // Handle case where match contains whitespace
  if (match.includes(' ')) {
    const matchIndices: number[] = [];
    // Look for full match in content (case insensitive)
    let startIndex = 0;
    const contentLower = content.toLowerCase();
    const matchLower = match.toLowerCase();
    
    while (true) {
      const index = contentLower.indexOf(matchLower, startIndex);
      if (index === -1) break;
      // Convert character index to word index
      const beforeMatch = content.slice(0, index);
      const wordIndex = beforeMatch.split(/\s+/).length - 1;
      matchIndices.push(wordIndex);
      startIndex = index + 1;
    }
    if (matchIndices.length === 0) return [];
    
    const words = content.split(/\s+/);
    // Get context around each match
    return matchIndices.map(matchIndex => {
      const start = Math.max(0, matchIndex - wordCount);
      const end = Math.min(words.length, matchIndex + wordCount + 1);
      return words.slice(start, end).join(' ');
    });
  }

  // Handle single word matches
  const words = content.split(/\s+/);
  const matchIndices = words.reduce((indices: number[], word, index) => {
    if (word.toLowerCase().includes(match.toLowerCase())) indices.push(index);
    return indices;
  }, []);

  if (matchIndices.length === 0) return [];

  return matchIndices.map(matchIndex => {
    const start = Math.max(0, matchIndex - wordCount);
    const end = Math.min(words.length, matchIndex + wordCount + 1);
    return words.slice(start, end).join(' ');
  });
}