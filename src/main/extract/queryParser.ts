import { QueryPattern, MatchType } from './index.js';

export function parseQueryString(query: string): QueryPattern[] {
  const patterns: QueryPattern[] = [];
  let currentPattern = '';
  let inMarkdownLink = false;
  let i = 0;

  while (i < query.length) {
    // Handle markdown links with spaces
    if (query.slice(i, i + 2) === '[[') {
      inMarkdownLink = true;
      currentPattern = '[[';
      i += 2;
      continue;
    }

    if (inMarkdownLink && query.slice(i, i + 2) === ']]') {
      currentPattern += ']]';
      inMarkdownLink = false;
      i += 2;
      
      // Extract any modifier that immediately follows the link
      let modifier: string | undefined;
      const remainingQuery = query.slice(i);
      const modifierMatch = remainingQuery.match(/^[<>](?:\((.*?)\)|([^(\s]+(?:\s+[^<>\s]+)*)?)/);
      
      if (modifierMatch) {
        modifier = modifierMatch[0];
        i += modifierMatch[0].length;
      }
      
      patterns.push({
        type: MatchType.MarkdownLink,
        value: currentPattern.slice(2, -2), // Remove [[ and ]]
        modifier
      });
      
      currentPattern = '';
      continue;
    }

    if (inMarkdownLink) {
      currentPattern += query[i];
      i++;
      continue;
    }

    // Handle regular patterns
    if (query[i] === ' ' && currentPattern) {
      const pattern = parsePattern(currentPattern);
      if (pattern) patterns.push(pattern);
      currentPattern = '';
    } else if (query[i] !== ' ') {
      currentPattern += query[i];
    }
    i++;
  }

  // Handle last pattern
  if (currentPattern) {
    const pattern = parsePattern(currentPattern);
    if (pattern) patterns.push(pattern);
  }

  return patterns;
}

function parsePattern(pattern: string): QueryPattern | null {
  // Modifier can be any string after < or >, optionally in parentheses
  // Examples: <10, <(my modifier), >2024-01-01, >(last week)
  const getModifier = (pattern: string): string | undefined => {
    const modifierMatch = pattern.match(/[<>](?:\((.*?)\)|([^(\s]+))/);
    return modifierMatch ? modifierMatch[0] : undefined;
  };

  if (pattern.startsWith('#')) {
    const tag = pattern.slice(1).split(/[<>]/)[0];
    return {
      type: MatchType.Tag,
      value: tag,
      modifier: getModifier(pattern)
    };
  } 
  
  if (pattern.startsWith('[[')) {
    const link = pattern.slice(2, -2);
    return {
      type: MatchType.MarkdownLink,
      value: link,
      modifier: getModifier(pattern)
    };
  } 
  
  if (pattern.includes('/')) {
    const folder = pattern.split(/[<>]/)[0];
    return {
      type: MatchType.Folder, 
      value: folder.endsWith('/') ? folder : folder + '/',
      modifier: getModifier(pattern)
    };
  }
  
  return null;
}