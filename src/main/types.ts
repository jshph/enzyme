import { MatchType } from './extract/index.js';

export interface Match {
  type: MatchType;
  value: string;
}

export interface ExtractedContent {
  title: string;
  contents: string;
} 