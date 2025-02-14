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

// Mock chokidar
jest.mock('chokidar', () => ({
  watch: jest.fn(() => ({
    on: jest.fn().mockReturnThis(),
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

// Create test resources directory and files before tests
const TEST_RESOURCES_DIR = path.join(__dirname, 'test-resources');

async function setupTestFiles() {
  // Ensure test resources directory exists
  await fs.mkdir(TEST_RESOURCES_DIR, { recursive: true });

  // Create test files with different tag scenarios
  await fs.writeFile(
    path.join(TEST_RESOURCES_DIR, 'inline-tags.md'),
    `# Test Note
This is a test note with #tag1 and #tag2/subtag and #tag3-with-dash`
  );

  await fs.writeFile(
    path.join(TEST_RESOURCES_DIR, 'frontmatter-tags.md'),
    `---
tags:
  - frontmatter-tag1
  - frontmatter-tag2
  - nested/tag
---
# Test Note
Regular content here`
  );

  await fs.writeFile(
    path.join(TEST_RESOURCES_DIR, 'mixed-tags.md'),
    `---
tags:
  - frontmatter-tag1
  - nested/tag
---
# Test Note
Content with #inline-tag1 and #parent/child`
  );

  await fs.writeFile(
    path.join(TEST_RESOURCES_DIR, 'excluded-tags.md'),
    `---
tags:
  - excluded-tag
  - private/secret
  - normal-tag
---
# Test Note
Content with #excluded-inline and #private/hidden and #regular-tag`
  );

  await fs.writeFile(
    path.join(TEST_RESOURCES_DIR, 'malformed-frontmatter.md'),
    `---
tags:
  - valid-tag
  malformed: {
---
# Test Note
Content with #inline-tag`
  );
}

describe('FileIndexer', () => {
  let indexer: FileIndexer;

  beforeAll(async () => {
    await setupTestFiles();
  });

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create new indexer instance
    indexer = new FileIndexer();
    await indexer.initialize(
      TEST_RESOURCES_DIR,  // Use test resources directory instead of mock path
      ['**/*.md'],
      [],
      [],
      false
    );
  });

  afterEach(() => {
    // Clear the indexer after each test
    indexer.clearIndex();
  });

  afterAll(async () => {
    // Clean up test files
    await fs.rm(TEST_RESOURCES_DIR, { recursive: true, force: true });
  });

  describe('indexFileByPath', () => {
    it('should extract inline tags correctly', async () => {
      const testFilePath = path.join(TEST_RESOURCES_DIR, 'inline-tags.md');
      await indexer.indexFileByPath(testFilePath);

      const tags = Array.from(indexer.getTags());
      expect(tags).toContain('tag1');
      expect(tags).toContain('tag2');
      expect(tags).toContain('tag2/subtag');
      expect(tags).toContain('tag3-with-dash');
    });

    it('should extract frontmatter tags correctly', async () => {
      const testFilePath = path.join(TEST_RESOURCES_DIR, 'frontmatter-tags.md');
      await indexer.indexFileByPath(testFilePath);

      const tags = Array.from(indexer.getTags());
      expect(tags).toContain('frontmatter-tag1');
      expect(tags).toContain('frontmatter-tag2');
      expect(tags).toContain('nested/tag');
    });

    it('should handle mixed frontmatter and inline tags', async () => {
      const testFilePath = path.join(TEST_RESOURCES_DIR, 'mixed-tags.md');
      await indexer.indexFileByPath(testFilePath);

      const tags = Array.from(indexer.getTags());
      expect(tags).toContain('frontmatter-tag1');
      expect(tags).toContain('nested/tag');
      expect(tags).toContain('inline-tag1');
      expect(tags).toContain('parent');
      expect(tags).toContain('parent/child');
    });

    it('should handle excluded tags', async () => {
      // Create new indexer with excluded tags
      indexer.setExcludedTags(['excluded*', 'private/**', 'private']);

      const testFilePath = path.join(TEST_RESOURCES_DIR, 'excluded-tags.md');
      await indexer.indexFileByPath(testFilePath);

      const tags = Array.from(indexer.getTags());
      expect(tags).not.toContain('excluded-tag');
      expect(tags).not.toContain('excluded-inline');
      expect(tags).not.toContain('private/secret');
      expect(tags).not.toContain('private/hidden');
      expect(tags).toContain('normal-tag');
      expect(tags).toContain('regular-tag');

      indexer.setExcludedTags([]);
    });

    it('should handle malformed frontmatter gracefully', async () => {
      const testFilePath = path.join(TEST_RESOURCES_DIR, 'malformed-frontmatter.md');
      await expect(indexer.indexFileByPath(testFilePath)).resolves.not.toThrow();

      const tags = Array.from(indexer.getTags());
      expect(tags).toContain('inline-tag');
    });
  });
}); 