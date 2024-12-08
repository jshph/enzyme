import { promises as fs } from 'fs';

// Returns the creation date of the file, preferring the frontmatter's created date if available
export async function getFileCreationDate(frontmatter: any, file: string): Promise<Date> {
  try {
    // if it is a valid date string, return that, otherwise remove the brackets and try again
    if (frontmatter.created) {
      // Try casting to a date
      const date = new Date(frontmatter.created);
      if (!isNaN(date.getTime())) {
        return date;
      }
      // Otherwise, assume it's either [[yyyy-mm-dd]] or yyyy-mm-dd
      const cleaned = frontmatter.created.replace(/[[\]]/g, '');
      return new Date(cleaned);
    } else {
      return new Date((await fs.stat(file)).ctime);
    }
  } catch (error) {
    console.error('Error getting file creation date:', error);
    throw error; // Re-throw the error after logging
  }
}