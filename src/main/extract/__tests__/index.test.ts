// @ts-nocheck

import { MatchType } from '../index';
import { extractContentForMatch } from '../index';
import {  describe, expect, it } from '@jest/globals';

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
jest.mock('../../indexer/electron', () => ({
  ElectronFileIndexer: class MockElectronFileIndexer {}
}));

// Mock extract/index but preserve the MatchType enum and extractContentForMatch function
jest.mock('../../extract/index', () => {
  const originalModule = jest.requireActual('../../extract/index');
  return {
    ...originalModule,
    // Add any specific mocks here if needed
  };
});

jest.mock('../../server', () => ({
  ServerContext: class MockServerContext {}
}));

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



describe('extractContentForMatch', () => {
  it('should return full contents when tag is in frontmatter', () => {
    const contents = `This is the full content of the file
that should be returned completely when
the tag is found in frontmatter.`;

    const frontmatter = {
      tags: ['test-tag']
    };

    const match = {
      type: MatchType.Tag,
      value: '#test-tag'
    };

    const result = extractContentForMatch(contents, match, frontmatter);

    // Should return array with single element containing full contents
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(contents);
  });

  it('should return lasso context when tag is only in content', () => {
    const contents = `This is some content before the tag.
Here is a paragraph with #test-tag in the middle.
This is content after the tag.`;

    const frontmatter = {
      tags: ['other-tag']
    };

    const match = {
      type: MatchType.Tag,
      value: '#test-tag'
    };

    const result = extractContentForMatch(contents, match, frontmatter);

    // Should return array with lasso extracted context
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('test-tag');
    // Should not return full contents
    expect(result[0].length).toBeLessThanOrEqual(contents.length);
  });

  it('should handle frontmatter tags with and without # prefix', () => {
    const contents = `This is the full content that should be returned.`;

    const frontmatter = {
      tags: ['test-tag'] // No # prefix in frontmatter
    };

    const match = {
      type: MatchType.Tag,
      value: '#test-tag' // With # prefix in match
    };

    const result = extractContentForMatch(contents, match, frontmatter);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(contents);
  });

  it('should handle multiple occurrences of tag in content', () => {
    const contents = `Here is #test-tag in one place.
Some content in between.
Here is #test-tag in another place.`;

    const frontmatter = {
      tags: ['other-tag']
    };

    const match = {
      type: MatchType.Tag,
      value: '#test-tag'
    };

    const result = extractContentForMatch(contents, match, frontmatter);

    // Should return multiple lasso contexts
    expect(result.length).toBeGreaterThan(1);
    result.forEach(context => {
      expect(context).toContain('test-tag');
    });
  });
}); 