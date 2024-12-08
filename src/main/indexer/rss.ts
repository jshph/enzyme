import type { FileMetadata } from './index.js';
import Parser from 'rss-parser';

export interface RSSSource {
  url: string;
  title: string;
}

export interface RSSItem extends FileMetadata {
  title: string;
  content: string;
  url: string;
  source: string;
  pubDate: Date;
}

export class RSSIndexer {
  private parser: any;
  private sources: Map<string, RSSSource> = new Map();
  private items: Map<string, RSSItem> = new Map();
  private tagIndex: Map<string, RSSItem[]> = new Map();
  
  constructor() {
    this.parser = new Parser();
  }

  async addSource(url: string): Promise<RSSSource> {
    try {
      // Validate URL and fetch initial feed
      const feed = await this.parser.parseURL(url);
      feed.feedUrl = url;
      if (!feed.title) throw new Error('Invalid RSS feed');
      this.sources.set(url, { url, title: feed.title });
      await this.indexSource(feed);
      return this.sources.get(url)!;
    } catch (error) {
      console.error(`Failed to add RSS source ${url}:`, error);
      throw error;
    }
  }

  // Add multiple sources by URL; refreshes the contents of the source by URL
  async addSources(urls: string[]): Promise<void> {
    for (const url of urls) {
      await this.addSource(url);
    }
  }

  async removeSource(url: string): Promise<void> {
    this.sources.delete(url);
    // Remove items from this source
    for (const [itemUrl, item] of this.items.entries()) {
      if (item.source === url) {
        this.items.delete(itemUrl);
        // Remove from tag index
        for (const tag of item.tags) {
          const items = this.tagIndex.get(tag) || [];
          this.tagIndex.set(tag, items.filter(i => i.url !== itemUrl));
        }
      }
    }
  }

  recentItems(count: number = 10): RSSItem[] {
    return Array.from(this.items.values()).sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime()).slice(0, count);
  }

  private async indexSource(feed: any): Promise<void> {
    try {
      if (!feed.feedUrl) return;
      const source = this.sources.get(feed.feedUrl);
      
      if (!source) return;

      for (const entry of feed.items) {
        if (!entry.link) continue;

        const item: RSSItem = {
          path: entry.link, // Use URL as path
          title: entry.title || '',
          content: entry.content || entry.description || '',
          url: entry.link,
          source: feed.feedUrl,
          pubDate: new Date(entry.pubDate || Date.now()),
          createdAt: new Date(entry.pubDate || Date.now()),
          tags: [...(entry.tags || []), ...(entry.categories || [])],
          markdownLinks: [], // RSS items don't have markdown links
          lastModified: Date.now()
        };

        this.items.set(entry.link, item);
        
        // Update tag index
        for (const tag of item.tags) {
          const items = this.tagIndex.get(tag) || [];
          items.push(item);
          this.tagIndex.set(tag, items);
        }
      }
    } catch (error) {
      console.error(`Failed to index RSS source ${feed.feedUrl}:`, error);
    }
  }

  getFilesForTag(tag: string): RSSItem[] {
    return this.tagIndex.get(tag) || [];
  }

  getSources(): RSSSource[] {
    return Array.from(this.sources.values());
  }

  getItems(): RSSItem[] {
    return Array.from(this.items.values());
  }
}

// Singleton pattern
let instance: RSSIndexer | null = null;

export function getRSSIndexer(): RSSIndexer {
  if (!instance) {
    instance = new RSSIndexer();
  }
  return instance;
}
