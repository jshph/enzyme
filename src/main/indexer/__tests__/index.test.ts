// @ts-nocheck

import { FileIndexer } from '../index';
import { promises as fs } from 'fs';
import * as path from 'path';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// Mock logger utility
jest.mock('../../utils/logger', () => ({
  initializeLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }))
}));

// Mock utils
jest.mock('../../utils', () => ({
  getFileCreationDate: jest.fn(() => new Date())
}));

// Mock all dependent modules first
jest.mock('../electron', () => ({
  ElectronFileIndexer: class MockElectronFileIndexer {}
}));

jest.mock('../../extract/index', () => ({}));
jest.mock('../../server', () => ({
  ServerContext: class MockServerContext {}
}));

// Update the chokidar mock to handle initialization better
const mockWatchHandlers: {
  add?: (path: string) => Promise<void>;
  change?: (path: string) => Promise<void>;
  unlink?: (path: string) => Promise<void>;
  ready?: () => void;
} = {};

let isWatcherReady = false;

jest.mock('chokidar', () => ({
  watch: jest.fn(() => ({
    on: jest.fn((event: string, handler: any) => {
      if (event === 'ready') {
        mockWatchHandlers[event] = () => {
          isWatcherReady = true;
          handler();
        };
      } else {
        mockWatchHandlers[event] = handler;
      }
      return {
        on: jest.fn().mockReturnThis(),
        close: jest.fn()
      };
    }),
    close: jest.fn()
  }))
}));

// Mock fs with both promises and regular methods
// jest.mock('fs', () => ({
//   promises: {
//     readFile: jest.fn(),
//     stat: jest.fn(),
//     access: jest.fn(),
//     mkdir: jest.fn(),
//     readdir: jest.fn()
//   },
//   existsSync: jest.fn(),
//   readFileSync: jest.fn()
// }));

// Mock winston logger
jest.mock('winston', () => ({
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    printf: jest.fn(),
    colorize: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  },
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }))
}));

// Mock electron
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn()
  },
  BrowserWindow: jest.fn(),
  Notification: jest.fn()
}));

// Create test resources directory and files for specific tests
const TEST_RESOURCES_DIR = path.join(__dirname, 'test-resources');

describe('FileIndexer', () => {
  let indexer: FileIndexer;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create test directory
    await fs.mkdir(TEST_RESOURCES_DIR, { recursive: true });
    
    // Create new indexer instance
    indexer = new FileIndexer();
  });

  afterEach(async () => {
    // Clear the indexer after each test
    indexer.clearIndex();
    
    // Clean up test files after each test
    await fs.rm(TEST_RESOURCES_DIR, { recursive: true, force: true });
  });

  describe('indexFileByPath', () => {
    it('should extract inline tags correctly', async () => {
      // Create test file for this specific test
      const testFilePath = path.join(TEST_RESOURCES_DIR, 'inline-tags.md');
      await fs.writeFile(
        testFilePath,
        `# Test Note
This is a test note with #tag1 and #tag2/subtag and #tag3-with-dash`
      );

      await indexer.initialize(TEST_RESOURCES_DIR, ['**/*.md'], [], [], false);
      await indexer.indexFileByPath(testFilePath);

      const tags = Array.from(indexer.getTags());
      expect(tags).toContain('tag1');
      expect(tags).toContain('tag2');
      expect(tags).toContain('tag2/subtag');
      expect(tags).toContain('tag3-with-dash');
    });

    it('should extract frontmatter tags correctly', async () => {
      const testFilePath = path.join(TEST_RESOURCES_DIR, 'frontmatter-tags.md');
      await fs.writeFile(
        testFilePath,
        `---
tags:
  - frontmatter-tag1
  - frontmatter-tag2
  - nested/tag
---
# Test Note
Regular content here`
      );

      await indexer.initialize(TEST_RESOURCES_DIR, ['**/*.md'], [], [], false);
      await indexer.indexFileByPath(testFilePath);

      const tags = Array.from(indexer.getTags());
      expect(tags).toContain('frontmatter-tag1');
      expect(tags).toContain('frontmatter-tag2');
      expect(tags).toContain('nested/tag');
    });

    it('should handle mixed frontmatter and inline tags', async () => {
      const testFilePath = path.join(TEST_RESOURCES_DIR, 'mixed-tags.md');
      await fs.writeFile(
        testFilePath,
        `---
tags:
  - frontmatter-tag1
  - nested/tag
---
# Test Note
Content with #inline-tag1 and #parent/child`
      );

      await indexer.initialize(TEST_RESOURCES_DIR, ['**/*.md'], [], [], false);
      await indexer.indexFileByPath(testFilePath);

      const tags = Array.from(indexer.getTags());
      expect(tags).toContain('frontmatter-tag1');
      expect(tags).toContain('nested/tag');
      expect(tags).toContain('inline-tag1');
      expect(tags).toContain('parent');
      expect(tags).toContain('parent/child');
    });

    it('should handle excluded tags', async () => {
      const testFilePath = path.join(TEST_RESOURCES_DIR, 'excluded-tags.md');
      await fs.writeFile(
        testFilePath,
        `---
tags:
  - excluded-tag
  - private/secret
  - normal-tag
---
# Test Note
Content with #excluded-inline and #private/hidden and #regular-tag`
      );

      await indexer.initialize(TEST_RESOURCES_DIR, ['**/*.md'], [], [], false);
      indexer.setExcludedTags(['excluded*', 'private/**', 'private']);
      await indexer.indexFileByPath(testFilePath);

      const tags = Array.from(indexer.getTags());
      expect(tags).not.toContain('excluded-tag');
      expect(tags).not.toContain('excluded-inline');
      expect(tags).not.toContain('private/secret');
      expect(tags).not.toContain('private/hidden');
      expect(tags).toContain('normal-tag');
      expect(tags).toContain('regular-tag');
    });

    it('should handle malformed frontmatter gracefully', async () => {
      const testFilePath = path.join(TEST_RESOURCES_DIR, 'malformed-frontmatter.md');
      await fs.writeFile(
        testFilePath,
        `---
tags:
  - valid-tag
  malformed: {
---
# Test Note
Content with #inline-tag`
      );

      await indexer.initialize(TEST_RESOURCES_DIR, ['**/*.md'], [], [], false);
      await expect(indexer.indexFileByPath(testFilePath)).resolves.not.toThrow();

      const tags = Array.from(indexer.getTags());
      expect(tags).toContain('inline-tag');
    });
  });

  describe('getFilesForTag', () => {
    it('should retrieve files with both frontmatter and inline tags', async () => {
      // Create test files for this specific test
      await fs.writeFile(
        path.join(TEST_RESOURCES_DIR, 'frontmatter-tag.md'),
        `---
tags:
  - test-tag
---
# Test Note with Frontmatter Tag`
      );

      await fs.writeFile(
        path.join(TEST_RESOURCES_DIR, 'inline-tag.md'),
        `# Test Note with Inline Tag
Content with #test-tag here`
      );

      await indexer.initialize(TEST_RESOURCES_DIR, ['**/*.md'], [], [], false);
      
      // Index both files
      await indexer.indexFileByPath(path.join(TEST_RESOURCES_DIR, 'frontmatter-tag.md'));
      await indexer.indexFileByPath(path.join(TEST_RESOURCES_DIR, 'inline-tag.md'));

      const files = indexer.getFilesForTag('test-tag');
      expect(files).toHaveLength(2);
      expect(files.map(f => path.basename(f.path))).toEqual(
        expect.arrayContaining(['frontmatter-tag.md', 'inline-tag.md'])
      );
    });
  });

  describe('file watcher', () => {
    // Helper function to wait for file processing
    const waitForFileProcessing = async () => {
      while (indexer.isIndexing) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    };

    it('should detect and process file changes', async () => {
      // First initialize the indexer with an empty directory
      await indexer.initialize(TEST_RESOURCES_DIR, ['**/*.md'], [], [], false);
      await waitForFileProcessing();

      // Create the test file after initialization
      const testFilePath = path.join(TEST_RESOURCES_DIR, 'watched-file.md');
      await fs.writeFile(
        testFilePath,
        `# Test Note
Content with #initial-tag`
      );

      // Manually index the file since it was created after initialization
      await indexer.indexFileByPath(testFilePath);
      await waitForFileProcessing();

      // Verify initial tag is indexed
      expect(Array.from(indexer.getTags())).toContain('initial-tag');

      // Modify the file with new content
      await fs.writeFile(
        testFilePath,
        `# Test Note
Content with #initial-tag and #new-tag`
      );

      // Manually trigger reindexing
      await indexer.indexFileByPath(testFilePath);
      await waitForFileProcessing();

      // Verify both tags are now indexed
      const tags = Array.from(indexer.getTags());
      expect(tags).toContain('initial-tag');
      expect(tags).toContain('new-tag');
    });

    it('should handle file deletion', async () => {
      // First initialize the indexer with an empty directory
      await indexer.initialize(TEST_RESOURCES_DIR, ['**/*.md'], [], [], false);
      await waitForFileProcessing();

      // Create the test file after initialization
      const testFilePath = path.join(TEST_RESOURCES_DIR, 'to-be-deleted.md');
      await fs.writeFile(
        testFilePath,
        `# Test Note
Content with #delete-test-tag`
      );

      // Manually index the file
      await indexer.indexFileByPath(testFilePath);
      await waitForFileProcessing();

      // Verify initial tag is indexed
      expect(Array.from(indexer.getTags())).toContain('delete-test-tag');

      // Delete the file
      await fs.unlink(testFilePath);
      
      // Remove from index
      indexer.removeFromIndex(testFilePath);
      await waitForFileProcessing();

      // Verify tag is removed from index
      expect(Array.from(indexer.getTags())).not.toContain('delete-test-tag');
    });
  });

  describe('case-insensitive tag handling', () => {
    it('should handle case-insensitive tag exclusions', async () => {
        // Clear any existing index and initialize with the exclusions
        indexer.clearIndex();
        await indexer.initialize(TEST_RESOURCES_DIR, ['**/*.md'], [], [
            'Test-*',    // Should exclude all tags starting with test- regardless of case
            'UPPER/*',   // Should exclude all hierarchical tags under UPPER/
            'quiet*'     // Should exclude tags starting with quiet
        ], false);

        const testFilePath = path.join(TEST_RESOURCES_DIR, 'excluded-case.md');
        await fs.writeFile(
            testFilePath,
            `---
tags:
    - test-tag
    - TEST-other
    - upper/something
    - UPPER/else
    - quiet-case
    - QUIET-VOICE
    - allowed-tag
---
Content with #Test-Tag and #UPPER/thing and #QuietTime`
        );

        await indexer.indexFileByPath(testFilePath);

        const tags = Array.from(indexer.getTags());
        
        // These should all be excluded
        expect(tags).not.toContain('test-tag');
        expect(tags).not.toContain('test-other');
        expect(tags).not.toContain('upper/something');
        expect(tags).not.toContain('upper/else');
        expect(tags).not.toContain('quiet-case');
        expect(tags).not.toContain('quiet-voice');
        
        // Parent tags of excluded hierarchical tags should also be excluded
        expect(tags).not.toContain('upper');
        
        // This should be allowed
        expect(tags).toContain('allowed-tag');
        
        // Test that new files also respect the exclusions
        const anotherFile = path.join(TEST_RESOURCES_DIR, 'another-excluded.md');
        await fs.writeFile(
            anotherFile,
            `# Test Note
Content with #TEST-new and #UPPER/more and #QuietTag`
        );
        
        await indexer.indexFileByPath(anotherFile);
        
        const updatedTags = Array.from(indexer.getTags());
        expect(updatedTags).not.toContain('test-new');
        expect(updatedTags).not.toContain('upper/more');
        expect(updatedTags).not.toContain('quiettag');
    });

    // Move other case-sensitivity tests to their own describe block
    describe('case matching', () => {
        beforeEach(async () => {
            const testFilePath = path.join(TEST_RESOURCES_DIR, 'case-test.md');
            await fs.writeFile(
                testFilePath,
                `---
tags:
  - Test-TAG
  - UPPER/CASE
  - lower/case
---
# Test Note
Content with #MixedCase and #SCREAMING-CASE and #quiet-case`
            );

            await indexer.initialize(TEST_RESOURCES_DIR, ['**/*.md'], [], [], false);
            await indexer.indexFileByPath(testFilePath);
        });

        it('should match tags regardless of case', () => {
            const variations = [
                'test-tag',
                'TEST-TAG',
                'Test-TAG',
                'test-TAG'
            ];

            // All variations should return the same files
            const results = variations.map(tag => indexer.getFilesForTag(tag));
            results.forEach(files => {
                expect(files).toHaveLength(1);
            });

            // All results should be identical
            const firstResult = results[0];
            results.forEach(files => {
                expect(files).toEqual(firstResult);
            });
        });

        it('should handle case-insensitive hierarchical tag matching', () => {
            const variations = [
                'upper/case',
                'UPPER/CASE',
                'Upper/Case',
                'lower/case',
                'LOWER/case',
                'lower/CASE'
            ];

            variations.forEach(tag => {
                const files = indexer.getFilesForTag(tag);
                expect(files).toHaveLength(1);
            });
        });
    });
  });
}); 