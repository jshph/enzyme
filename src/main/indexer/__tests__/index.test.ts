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

    it('should extract single frontmatter tag correctly', async () => {
      const testFilePath = path.join(TEST_RESOURCES_DIR, 'single-frontmatter-tag.md');
      await fs.writeFile(
        testFilePath,
        `---
tags: single-tag
---
# Test Note
Regular content here without any inline tags`
      );

      await indexer.initialize(TEST_RESOURCES_DIR, ['**/*.md'], [], [], false);
      await indexer.indexFileByPath(testFilePath);

      const tags = Array.from(indexer.getTags());
      expect(tags).toContain('single-tag');
    });

    it('should extract frontmatter tag when specified as string instead of array', async () => {
      const testFilePath = path.join(TEST_RESOURCES_DIR, 'string-frontmatter-tag.md');
      await fs.writeFile(
        testFilePath,
        `---
tags: "test-tag"
---
# Test Note
Regular content here`
      );

      await indexer.initialize(TEST_RESOURCES_DIR, ['**/*.md'], [], [], false);
      await indexer.indexFileByPath(testFilePath);

      const tags = Array.from(indexer.getTags());
      expect(tags).toContain('test-tag');
    });
    
    it('should extract frontmatter tags with indented array format', async () => {
      const testFilePath = path.join(TEST_RESOURCES_DIR, 'indented-array-tag.md');
      await fs.writeFile(
        testFilePath,
        `---
tags:
  - enzyme/pmf
reflectionType: personal
people: 
created: "[[2025-02-13]]"
---
# Test Note
Regular content here`
      );

      await indexer.initialize(TEST_RESOURCES_DIR, ['**/*.md'], [], [], false);
      await indexer.indexFileByPath(testFilePath);

      const tags = Array.from(indexer.getTags());
      expect(tags).toContain('enzyme/pmf');
      expect(tags).toContain('enzyme'); // Should also extract parent tag
    });

    it('should handle frontmatter tags with # prefix', async () => {
      const testFilePath = path.join(TEST_RESOURCES_DIR, 'hash-prefix-tags.md');
      await fs.writeFile(
        testFilePath,
        `---
tags:
  - "#enzyme/pmf"
  - "#test-tag"
  - normal/tag
---
# Test Note
Regular content here`
      );

      await indexer.initialize(TEST_RESOURCES_DIR, ['**/*.md'], [], [], false);
      await indexer.indexFileByPath(testFilePath);

      const tags = Array.from(indexer.getTags());
      expect(tags).toContain('enzyme/pmf');
      expect(tags).toContain('enzyme'); // Should also extract parent tag
      expect(tags).toContain('test-tag');
      expect(tags).toContain('normal/tag');
      expect(tags).toContain('normal');
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

  describe('link extraction and retrieval', () => {
    beforeEach(async () => {
      // Create test directory
      await fs.mkdir(TEST_RESOURCES_DIR, { recursive: true });
      indexer = new FileIndexer();
      await indexer.initialize(TEST_RESOURCES_DIR, ['**/*.md'], [], [], false);
    });

    it('should extract markdown links correctly', async () => {
      const testFilePath = path.join(TEST_RESOURCES_DIR, 'links.md');
      await fs.writeFile(
        testFilePath,
        `# Test Note
Here are some [[basic-link]] and [[nested/link]] references.
Also testing [[multi word link]] and [[Special-Characters!]]`
      );

      await indexer.indexFileByPath(testFilePath);

      const links = Array.from(indexer.getLinks());
      expect(links).toContain('basic-link');
      expect(links).toContain('nested/link');
      expect(links).toContain('multi word link');
      expect(links).toContain('Special-Characters!');
    });

    it('should handle links with various formats', async () => {
      const testFilePath = path.join(TEST_RESOURCES_DIR, 'complex-links.md');
      await fs.writeFile(
        testFilePath,
        `# Test Note
[[link-with-alias|Displayed differently]]
[[folder/nested/deep-link]]
[[2023-12-25]] date link
[[link with spaces]]
Multiple links in one line: [[link1]] and [[link2]] here`
      );

      await indexer.indexFileByPath(testFilePath);

      const links = Array.from(indexer.getLinks());
      expect(links).toContain('link-with-alias');
      expect(links).toContain('folder/nested/deep-link');
      expect(links).toContain('2023-12-25');
      expect(links).toContain('link with spaces');
      expect(links).toContain('link1');
      expect(links).toContain('link2');
    });

    it('should retrieve files by link reference', async () => {
      // Create two files that reference each other
      const file1Path = path.join(TEST_RESOURCES_DIR, 'source.md');
      const file2Path = path.join(TEST_RESOURCES_DIR, 'target.md');

      await fs.writeFile(
        file1Path,
        `# Source Note
This links to [[target]]`
      );

      await fs.writeFile(
        file2Path,
        `# Target Note
This links back to [[source]]`
      );

      await indexer.indexFileByPath(file1Path);
      await indexer.indexFileByPath(file2Path);

      const filesLinkingToTarget = indexer.getFilesForLink('target');
      const filesLinkingToSource = indexer.getFilesForLink('source');

      expect(filesLinkingToTarget).toHaveLength(1);
      expect(filesLinkingToSource).toHaveLength(1);
      expect(filesLinkingToTarget[0].path).toBe(file1Path);
      expect(filesLinkingToSource[0].path).toBe(file2Path);
    });

    it('should handle multiple files linking to the same target', async () => {
      // Create multiple files that link to the same target
      const files = [
        ['file1.md', '# File 1\nLinks to [[common-target]]'],
        ['file2.md', '# File 2\nAlso links to [[common-target]]'],
        ['file3.md', '# File 3\nAnother [[common-target]] reference']
      ];

      for (const [filename, content] of files) {
        const filePath = path.join(TEST_RESOURCES_DIR, filename);
        await fs.writeFile(filePath, content);
        await indexer.indexFileByPath(filePath);
      }

      const filesWithLink = indexer.getFilesForLink('common-target');
      expect(filesWithLink).toHaveLength(3);
      expect(filesWithLink.map(f => path.basename(f.path))).toEqual(
        expect.arrayContaining(['file1.md', 'file2.md', 'file3.md'])
      );
    });

    it('should handle link removal when file is deleted', async () => {
      // Create two files, then delete one
      const file1Path = path.join(TEST_RESOURCES_DIR, 'staying.md');
      const file2Path = path.join(TEST_RESOURCES_DIR, 'leaving.md');

      await fs.writeFile(
        file1Path,
        `# Staying File
Links to [[shared-link]]`
      );

      await fs.writeFile(
        file2Path,
        `# Leaving File
Also links to [[shared-link]]`
      );

      await indexer.indexFileByPath(file1Path);
      await indexer.indexFileByPath(file2Path);

      // Verify both files are indexed
      let filesWithLink = indexer.getFilesForLink('shared-link');
      expect(filesWithLink).toHaveLength(2);

      // Remove one file
      indexer.removeFromIndex(file2Path);
      await fs.unlink(file2Path);

      // Verify only one file remains
      filesWithLink = indexer.getFilesForLink('shared-link');
      expect(filesWithLink).toHaveLength(1);
      expect(filesWithLink[0].path).toBe(file1Path);
    });

    it('should handle file updates that change links', async () => {
      const testFilePath = path.join(TEST_RESOURCES_DIR, 'updating.md');
      
      // Initial content
      await fs.writeFile(
        testFilePath,
        `# Test Note
Initial [[link1]] and [[link2]]`
      );

      await indexer.indexFileByPath(testFilePath);

      // Verify initial links
      expect(Array.from(indexer.getLinks())).toContain('link1');
      expect(Array.from(indexer.getLinks())).toContain('link2');

      // Update file content
      await fs.writeFile(
        testFilePath,
        `# Test Note
Changed to [[link3]] and [[link4]]`
      );

      await indexer.indexFileByPath(testFilePath);

      // Verify updated links
      const updatedLinks = Array.from(indexer.getLinks());
      expect(updatedLinks).not.toContain('link1');
      expect(updatedLinks).not.toContain('link2');
      expect(updatedLinks).toContain('link3');
      expect(updatedLinks).toContain('link4');
    });

    it('should not index links to excluded files', async () => {
      // Create test files including some that should be excluded
      const files = [
        {
          path: path.join(TEST_RESOURCES_DIR, 'source.md'),
          content: `# Source Note
Links to [[excluded/file]] and [[normal-file]] and [[another-excluded/file]]`
        },
        {
          path: path.join(TEST_RESOURCES_DIR, 'normal-file.md'),
          content: '# Normal File'
        },
        {
          path: path.join(TEST_RESOURCES_DIR, 'excluded/file.md'),
          content: '# Excluded File'
        },
        {
          path: path.join(TEST_RESOURCES_DIR, 'another-excluded/file.md'),
          content: '# Another Excluded File'
        }
      ];

      // Create the files
      for (const file of files) {
        await fs.mkdir(path.dirname(file.path), { recursive: true });
        await fs.writeFile(file.path, file.content);
      }

      // Initialize indexer with exclusion patterns
      await indexer.initialize(
        TEST_RESOURCES_DIR, 
        ['**/*.md'], 
        ['excluded/**', 'another-excluded/**'], 
        [], 
        false
      );

      // Index the source file
      await indexer.indexFileByPath(files[0].path);

      // Check that only links to non-excluded files are indexed
      const links = Array.from(indexer.getLinks());
      expect(links).not.toContain('excluded/file');
      expect(links).not.toContain('another-excluded/file');
      expect(links).toContain('normal-file');
    });

    it('should handle links with and without file extensions', async () => {
      // Create test files
      const files = [
        {
          path: path.join(TEST_RESOURCES_DIR, 'source.md'),
          content: `# Source Note
Links to [[excluded/file.md]] and [[normal-file.md]] and [[another/file]]`
        },
        {
          path: path.join(TEST_RESOURCES_DIR, 'normal-file.md'),
          content: '# Normal File'
        },
        {
          path: path.join(TEST_RESOURCES_DIR, 'another/file.md'),
          content: '# Another File'
        }
      ];

      // Create the files
      for (const file of files) {
        await fs.mkdir(path.dirname(file.path), { recursive: true });
        await fs.writeFile(file.path, file.content);
      }

      // Initialize indexer with exclusion patterns
      await indexer.initialize(
        TEST_RESOURCES_DIR, 
        ['**/*.md'], 
        ['excluded/**'], 
        [], 
        false
      );

      // Index the source file
      await indexer.indexFileByPath(files[0].path);

      // Check that links are normalized (without .md extension)
      const links = Array.from(indexer.getLinks());
      expect(links).toContain('normal-file');
      expect(links).toContain('another/file');
      expect(links).not.toContain('normal-file.md');
      expect(links).not.toContain('another/file.md');
    });

    it('should update link index when excluded patterns change', async () => {
      // Create test files
      const files = [
        {
          path: path.join(TEST_RESOURCES_DIR, 'source.md'),
          content: `# Source Note
Links to [[private/file]] and [[normal-file]] and [[secret/file]]`
        },
        {
          path: path.join(TEST_RESOURCES_DIR, 'normal-file.md'),
          content: '# Normal File'
        },
        {
          path: path.join(TEST_RESOURCES_DIR, 'private/file.md'),
          content: '# Private File'
        },
        {
          path: path.join(TEST_RESOURCES_DIR, 'secret/file.md'),
          content: '# Secret File'
        }
      ];

      // Create the files
      for (const file of files) {
        await fs.mkdir(path.dirname(file.path), { recursive: true });
        await fs.writeFile(file.path, file.content);
      }

      // Initialize indexer with no exclusions first
      await indexer.initialize(TEST_RESOURCES_DIR, ['**/*.md'], [], [], false);
      await indexer.indexFileByPath(files[0].path);

      // Initially all links should be indexed
      let links = Array.from(indexer.getLinks());
      expect(links).toContain('private/file');
      expect(links).toContain('normal-file');
      expect(links).toContain('secret/file');

      // Now reinitialize with exclusions
      await indexer.initialize(
        TEST_RESOURCES_DIR, 
        ['**/*.md'], 
        ['private/**', 'secret/**'], 
        [], 
        false
      );
      await indexer.indexFileByPath(files[0].path);

      // Check that excluded links are removed
      links = Array.from(indexer.getLinks());
      expect(links).not.toContain('private/file');
      expect(links).not.toContain('secret/file');
      expect(links).toContain('normal-file');
    });

    it('should handle links in any frontmatter field', async () => {
      // Create test files including some that should be excluded
      const files = [
        {
          path: path.join(TEST_RESOURCES_DIR, 'source.md'),
          content: `---
related: "[[excluded/file]]"
people: 
  - name: John
    notes: "[[private/notes]]"
references:
  main: "[[normal-file]]"
  others: 
    - "[[another-excluded/file]]"
    - "[[allowed/file]]"
created: "[[2024-01-01]]"
---
# Source Note
Regular content with [[inline-link]]`
        },
        {
          path: path.join(TEST_RESOURCES_DIR, 'normal-file.md'),
          content: '# Normal File'
        },
        {
          path: path.join(TEST_RESOURCES_DIR, 'allowed/file.md'),
          content: '# Allowed File'
        },
        {
          path: path.join(TEST_RESOURCES_DIR, 'excluded/file.md'),
          content: '# Excluded File'
        },
        {
          path: path.join(TEST_RESOURCES_DIR, 'private/notes.md'),
          content: '# Private Notes'
        },
        {
          path: path.join(TEST_RESOURCES_DIR, 'another-excluded/file.md'),
          content: '# Another Excluded File'
        }
      ];

      // Create the files
      for (const file of files) {
        await fs.mkdir(path.dirname(file.path), { recursive: true });
        await fs.writeFile(file.path, file.content);
      }

      // Initialize indexer with exclusion patterns
      await indexer.initialize(
        TEST_RESOURCES_DIR, 
        ['**/*.md'], 
        ['excluded/**', 'private/**', 'another-excluded/**'], 
        [], 
        false
      );

      // Index the source file
      await indexer.indexFileByPath(files[0].path);

      // Check that only links to non-excluded files are indexed
      const links = Array.from(indexer.getLinks());
      
      // Links to excluded files should not be present
      expect(links).not.toContain('excluded/file');
      expect(links).not.toContain('private/notes');
      expect(links).not.toContain('another-excluded/file');
      
      // Links to allowed files should be present
      expect(links).toContain('normal-file');
      expect(links).toContain('allowed/file');
      expect(links).toContain('inline-link');
      expect(links).toContain('2024-01-01'); // Date links should be included
    });

    describe('link exclusion with path resolution', () => {
      it('should exclude links that resolve to files in excluded patterns', async () => {
        // Create test directory structure with files in various locations
        const files = [
          {
            path: path.join(TEST_RESOURCES_DIR, 'source.md'),
            content: `# Source Note
Links:
[[note]] - exists in both regular/ and private/, should resolve to regular/
[[private-note]] - exists only in private/, should be excluded
[[archive/old-note]] - explicitly in excluded folder
[[2024-01-01]] - would resolve to daily notes folder
[[meeting]] - exists in both meetings/ and archive/, should resolve to meetings/`
          },
          // Regular files
          {
            path: path.join(TEST_RESOURCES_DIR, 'regular/note.md'),
            content: '# Regular Note'
          },
          {
            path: path.join(TEST_RESOURCES_DIR, 'meetings/meeting.md'),
            content: '# Meeting Note'
          },
          // Excluded files
          {
            path: path.join(TEST_RESOURCES_DIR, 'private/note.md'),
            content: '# Private Note'
          },
          {
            path: path.join(TEST_RESOURCES_DIR, 'private/private-note.md'),
            content: '# Private Note'
          },
          {
            path: path.join(TEST_RESOURCES_DIR, 'archive/old-note.md'),
            content: '# Archived Note'
          },
          {
            path: path.join(TEST_RESOURCES_DIR, 'archive/meeting.md'),
            content: '# Archived Meeting'
          },
          {
            path: path.join(TEST_RESOURCES_DIR, 'daily/2024-01-01.md'),
            content: '# Daily Note'
          }
        ];

        // Create the files
        for (const file of files) {
          await fs.mkdir(path.dirname(file.path), { recursive: true });
          await fs.writeFile(file.path, file.content);
        }

        // Initialize with exclusion patterns
        await indexer.initialize(
          TEST_RESOURCES_DIR, 
          ['**/*.md'], 
          ['private/**', 'archive/**', 'daily/**'], 
          [], 
          false
        );

        await indexer.indexFileByPath(files[0].path);

        const links = Array.from(indexer.getLinks());
        
        // Should be included (resolves to non-excluded locations)
        expect(links).toContain('note'); // Resolves to regular/note.md
        expect(links).toContain('meeting'); // Resolves to meetings/meeting.md
        
        // Should be excluded (resolves to excluded locations)
        expect(links).not.toContain('private-note'); // Only exists in private/
        expect(links).not.toContain('archive/old-note'); // Explicitly in excluded folder
        expect(links).not.toContain('2024-01-01'); // Would resolve to daily notes
      });

      it('should handle ambiguous link resolution with excluded patterns', async () => {
        const files = [
          {
            path: path.join(TEST_RESOURCES_DIR, 'source.md'),
            content: `# Source Note
[[ambiguous-note]] - exists in multiple locations
[[unique-note]] - exists only in excluded folder
[[nested/note]] - exists in both regular and private nested folders`
          },
          // Create multiple instances of the same filename
          {
            path: path.join(TEST_RESOURCES_DIR, 'regular/ambiguous-note.md'),
            content: '# Regular Version'
          },
          {
            path: path.join(TEST_RESOURCES_DIR, 'private/ambiguous-note.md'),
            content: '# Private Version'
          },
          {
            path: path.join(TEST_RESOURCES_DIR, 'private/unique-note.md'),
            content: '# Unique Private Note'
          },
          {
            path: path.join(TEST_RESOURCES_DIR, 'regular/nested/note.md'),
            content: '# Regular Nested Note'
          },
          {
            path: path.join(TEST_RESOURCES_DIR, 'private/nested/note.md'),
            content: '# Private Nested Note'
          }
        ];

        // Create the files
        for (const file of files) {
          await fs.mkdir(path.dirname(file.path), { recursive: true });
          await fs.writeFile(file.path, file.content);
        }

        await indexer.initialize(
          TEST_RESOURCES_DIR, 
          ['**/*.md'], 
          ['private/**'], 
          [], 
          false
        );

        await indexer.indexFileByPath(files[0].path);

        const links = Array.from(indexer.getLinks());
        
        // Should be included (has at least one valid resolution)
        expect(links).toContain('ambiguous-note'); // Can resolve to regular/
        expect(links).toContain('nested/note'); // Can resolve to regular/nested/
        
        // Should be excluded (only resolves to excluded location)
        expect(links).not.toContain('unique-note'); // Only exists in private/
      });

      it('should handle links that would resolve to excluded patterns in frontmatter', async () => {
        const files = [
          {
            path: path.join(TEST_RESOURCES_DIR, 'source.md'),
            content: `---
related: "[[private/note]]"
meeting: "[[2024-01-15]]"
references:
  - "[[archive/old]]"
  - "[[regular/note]]"
people:
  - name: "John"
    file: "[[private/people/john]]"
---
# Source Note
Regular content here`
          },
          // Create the referenced files
          {
            path: path.join(TEST_RESOURCES_DIR, 'private/note.md'),
            content: '# Private Note'
          },
          {
            path: path.join(TEST_RESOURCES_DIR, 'archive/old.md'),
            content: '# Archived Note'
          },
          {
            path: path.join(TEST_RESOURCES_DIR, 'regular/note.md'),
            content: '# Regular Note'
          },
          {
            path: path.join(TEST_RESOURCES_DIR, 'private/people/john.md'),
            content: '# John'
          },
          {
            path: path.join(TEST_RESOURCES_DIR, 'daily/2024-01-15.md'),
            content: '# Daily Note'
          }
        ];

        // Create the files
        for (const file of files) {
          await fs.mkdir(path.dirname(file.path), { recursive: true });
          await fs.writeFile(file.path, file.content);
        }

        await indexer.initialize(
          TEST_RESOURCES_DIR, 
          ['**/*.md'], 
          ['private/**', 'archive/**', 'daily/**'], 
          [], 
          false
        );

        await indexer.indexFileByPath(files[0].path);

        const links = Array.from(indexer.getLinks());
        
        // Should be excluded (resolve to excluded locations)
        expect(links).not.toContain('private/note');
        expect(links).not.toContain('archive/old');
        expect(links).not.toContain('private/people/john');
        expect(links).not.toContain('2024-01-15');
        
        // Should be included (resolves to non-excluded location)
        expect(links).toContain('regular/note');
      });
    });

    it('should handle basename links that could resolve to excluded folders', async () => {
      const files = [
        {
          path: path.join(TEST_RESOURCES_DIR, 'source.md'),
          content: `# Source Note
Links:
[[note1]] - should be excluded (exists in private/)
[[note2]] - should be excluded (exists in daily/)
[[note3]] - should be excluded (exists in archive/)
[[note4]] - should be included (exists in regular/)
[[2024-01-01]] - should be excluded (would be in daily/)
[[just-a-note]] - should be included (not in excluded folders)`
        },
        {
          path: path.join(TEST_RESOURCES_DIR, 'private/note1.md'),
          content: '# Private Note'
        },
        {
          path: path.join(TEST_RESOURCES_DIR, 'daily/note2.md'),
          content: '# Daily Note'
        },
        {
          path: path.join(TEST_RESOURCES_DIR, 'archive/note3.md'),
          content: '# Archived Note'
        },
        {
          path: path.join(TEST_RESOURCES_DIR, 'regular/note4.md'),
          content: '# Regular Note'
        },
        {
          path: path.join(TEST_RESOURCES_DIR, 'just-a-note.md'),
          content: '# Regular Note'
        }
      ];

      // Create the files
      for (const file of files) {
        await fs.mkdir(path.dirname(file.path), { recursive: true });
        await fs.writeFile(file.path, file.content);
      }

      // Initialize with multiple folder exclusions
      await indexer.initialize(
        TEST_RESOURCES_DIR, 
        ['**/*.md'], 
        ['private/**', 'daily/**', 'archive/**'], 
        [], 
        false
      );

      await indexer.indexFileByPath(files[0].path);

      const links = Array.from(indexer.getLinks());
      
      // These should be excluded (exist in or would resolve to excluded folders)
      expect(links).not.toContain('note1');
      expect(links).not.toContain('note2');
      expect(links).not.toContain('note3');
      expect(links).not.toContain('2024-01-01');
      
      // These should be included
      expect(links).toContain('note4');
      expect(links).toContain('just-a-note');
    });
  });

  describe('linkToFileMap', () => {
    it('should correctly map file basenames to full paths', async () => {
      // Create test files with nested paths
      const files = [
        {
          path: path.join(TEST_RESOURCES_DIR, 'folder1/note1.md'),
          content: '# Note 1\nSome content'
        },
        {
          path: path.join(TEST_RESOURCES_DIR, 'folder2/subfolder/note2.md'),
          content: '# Note 2\nOther content'
        },
        {
          path: path.join(TEST_RESOURCES_DIR, 'note3.md'),
          content: '# Note 3\nMore content'
        }
      ];

      // Create the directory structure and files
      for (const file of files) {
        await fs.mkdir(path.dirname(file.path), { recursive: true });
        await fs.writeFile(file.path, file.content);
      }

      await indexer.initialize(TEST_RESOURCES_DIR, ['**/*.md'], [], [], false);

      // Index each file
      for (const file of files) {
        await indexer.indexFileByPath(file.path);
      }

      // Test that basenames map to full paths
      expect(indexer.getFileFromLink('note1')).toBe(files[0].path);
      expect(indexer.getFileFromLink('note2')).toBe(files[1].path);
      expect(indexer.getFileFromLink('note3')).toBe(files[2].path);

      // Test that paths without .md extension also work
      expect(indexer.getFileFromLink('folder1/note1')).toBe(files[0].path);
      expect(indexer.getFileFromLink('folder2/subfolder/note2')).toBe(files[1].path);
    });

    it('should handle files with same basenames in different folders', async () => {
      // Create test files with same basenames in different folders
      const files = [
        {
          path: path.join(TEST_RESOURCES_DIR, 'folder1/note.md'),
          content: '# Note in folder1'
        },
        {
          path: path.join(TEST_RESOURCES_DIR, 'folder2/note.md'),
          content: '# Note in folder2'
        }
      ];

      // Create the directory structure and files
      for (const file of files) {
        await fs.mkdir(path.dirname(file.path), { recursive: true });
        await fs.writeFile(file.path, file.content);
      }

      await indexer.initialize(TEST_RESOURCES_DIR, ['**/*.md'], [], [], false);

      // Index each file
      for (const file of files) {
        await indexer.indexFileByPath(file.path);
      }

      // Test that full paths map correctly
      expect(indexer.getFileFromLink('folder1/note')).toBe(files[0].path);
      expect(indexer.getFileFromLink('folder2/note')).toBe(files[1].path);

      // Test that basename maps to one of the files (implementation dependent)
      const noteResult = indexer.getFileFromLink('note');
      expect([files[0].path, files[1].path]).toContain(noteResult);
    });

    it('should handle links with and without .md extension', async () => {
      const testFilePath = path.join(TEST_RESOURCES_DIR, 'test-note.md');
      await fs.writeFile(testFilePath, '# Test Note\nSome content');

      await indexer.initialize(TEST_RESOURCES_DIR, ['**/*.md'], [], [], false);
      await indexer.indexFileByPath(testFilePath);

      // Both with and without .md extension should work
      expect(indexer.getFileFromLink('test-note')).toBe(testFilePath);
      expect(indexer.getFileFromLink('test-note.md')).toBe(testFilePath);
    });

    it('should update linkToFileMap when files are removed', async () => {
      const testFilePath = path.join(TEST_RESOURCES_DIR, 'to-remove.md');
      await fs.writeFile(testFilePath, '# Test Note\nSome content');

      await indexer.initialize(TEST_RESOURCES_DIR, ['**/*.md'], [], [], false);
      await indexer.indexFileByPath(testFilePath);

      // Verify file is mapped
      expect(indexer.getFileFromLink('to-remove')).toBe(testFilePath);

      // Remove file from index
      indexer.removeFromIndex(testFilePath);

      // Verify mapping is removed
      expect(indexer.getFileFromLink('to-remove')).toBeNull();
    });
  });
}); 