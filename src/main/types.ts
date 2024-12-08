import { MatchType } from './extract/index';

export interface Match {
  type: MatchType;
  value: string;
}

export interface ExtractedContent {
  title: string;
  contents: string;
} 