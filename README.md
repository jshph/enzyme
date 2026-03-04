# Enzyme

A Claude Code plugin for exploring Obsidian vaults by concept, not keyword.

## Why not just point Claude at a vault?

An Obsidian vault is a pile of markdown files. Claude can grep through them, but it searches by keywords and has no sense of what matters to you *right now*.

Your vault already has a shape. The tags you chose, the links you drew, the folders you sorted things into — those aren't just organization. They're grips: evidence of how you've been thinking. Enzyme reads those signals, builds semantic clusters from them, and generates **catalysts** — thematic questions that reach content those tags alone would never surface.

A search for "feeling stuck on the project" finds notes about creative blocks, momentum, and resistance — even if none of those words appear in the query or the notes.

**Temporal awareness.** Recent ideas surface first. Enzyme uses a 30-day half-life decay so what you've been thinking about this week surfaces before notes from two years ago. Your vault has a pulse; Enzyme reads it.

**Runs on your machine.** The embedding model is a 52 MB quantized ONNX file. No data leaves your vault except for optional LLM-powered catalyst generation (a few cents per refresh).

## Install

```
claude plugin add jshph/enzyme
```

The `enzyme` CLI binary is installed automatically on first use.

## Usage

Inside Claude Code, invoke `/enzyme` to explore your vault. The plugin handles initialization, entity selection, and search.

### Core concepts

- **Entities** — the tags, links, and folders you've already been using. Each one becomes a semantic cluster — a gathering of content organized by how you think, not by a schema you maintain.
- **Catalysts** — compressed themes Enzyme discovers across your writing for each entity. They're the handles your vault has grown; searching through them connects you to content that keyword matching won't find.
- **Petri** — a live view of what's trending in your vault and the catalysts anchored to each entity

### What a session looks like

1. `/enzyme` opens with your petri — what's active, what's dormant, what catalysts have formed
2. You explore by concept ("tension between shipping fast and getting it right") or by concrete anchor (a tag, a person, a note title)
3. Enzyme returns excerpts with the catalysts that surfaced them, so you can see *why* something came up

## Requirements

- An Obsidian vault
- macOS (Apple Silicon or Intel via Rosetta)
- An OpenAI or OpenRouter API key for catalyst generation (`OPENAI_API_KEY` or `OPENROUTER_API_KEY`)

## Links

- [enzyme.garden](https://enzyme.garden)
- [enzyme-rust](https://github.com/jshph/enzyme-rust) — the CLI that powers this plugin
