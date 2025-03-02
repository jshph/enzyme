# Enzyme MCP (Model Context Protocol) Server

A context provider that connects your personal knowledge base with AI tools. This Model Context Protocol server allows Enzyme to be a context provider for other applications, enabling them to access and utilize your personal knowledge base in a structured way.

## Core Functionality

- Retrieve notes from your Obsidian vault using:
  - Tags (e.g., `#writing`, `#enzyme/pmf`)
  - Links (e.g., `[[ecology of technology]]`)
  - Folders (e.g., `Readwise/Books/`)
- Specify limits on retrieved notes (e.g., 50 most recent notes with a specific tag)
- Maintain privacy by keeping your notes local while still making them accessible to AI tools

## Example Prompts

> Retrieve 25 notes tagged with #writing

> Fetch 15 notes from my Readwise/Books folder

## How It Differs From Standard Search

Unlike traditional search that just finds mentions, Enzyme MCP:
- Retrieves complete note contexts
- Understands the relationships between notes (tags, links, folders)
- Provides structured data that AI tools can effectively use

## Connection to Enzyme App

This MCP server is a companion to the main [Enzyme](https://github.com/jshph/enzyme) application, which is designed as a knowledge management tool that helps users develop deeper convictions through their notes by:

- Connecting scattered thoughts into cohesive narratives
- Visualizing relationships between recurring themes and ideas
- Generating personalized digests from your knowledge base
- Serving as an intelligent context server for AI tools

## Future Development

Plans for more sophisticated understanding of content to help AI tools:
- Adaptive context windows that understand content structure
- Enhanced visualization of connections between ideas
- Auto-summarization of tag clusters
- Improved integration with existing workflows

For more details on the full Enzyme application, see the [main README](https://github.com/jshph/enzyme/blob/main/README.md).