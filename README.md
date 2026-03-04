# Enzyme

Local-first knowledge indexing for Obsidian — explore your vault by concept, not keyword.

## Install

```
/plugin marketplace add jshph/enzyme
```

Then open the plugin browser with `/plugin` and install **enzyme**.

## What it does

Enzyme indexes your Obsidian vault locally and surfaces connections between ideas using semantic search and catalyst generation. Everything runs on your machine — no data leaves your vault except for optional LLM-powered catalyst generation.

### Core concepts

- **Entities** — tags, notes, or folders you care about (e.g. `#creativity`, `[[Design]]`)
- **Catalysts** — compressed themes Enzyme discovers across your writing for each entity
- **Petri** — a live view of trending entities and their catalysts

### Usage

Invoke with `/enzyme` inside Claude Code to explore your vault. The skill handles vault initialization, entity selection, and search workflows.

## Requirements

- An Obsidian vault
- The `enzyme` CLI binary is installed automatically on first use via the plugin's SessionStart hook
- An OpenAI or OpenRouter API key for catalyst generation (set `OPENAI_API_KEY` or `OPENROUTER_API_KEY`)

## Links

- [enzyme.garden](https://enzyme.garden)
