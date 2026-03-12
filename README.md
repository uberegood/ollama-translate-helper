# Ollama translate helper (Chrome Extension)

A Chrome extension for quick AI-powered translation and paraphrasing of selected text.

This is a **self-hosted translator/paraphraser** focused on Russian ↔ English workflows and phrasing improvements, powered by your self-hosted Ollama stack.

It supports:
- Translate selected text to English
- Translate selected text to Russian (shown in a separate modal window)
- Paraphrase selected text in English
- Hotkeys, context menu actions, popup actions
- Ollama (`/api/generate`) and Open WebUI/OpenAI-style (`/chat/completions`)

## Features

- `Alt+Shift+E` — translate selected text to English
- `Alt+Shift+R` — translate selected text to Russian
- `Alt+Shift+Q` — paraphrase selected text in English
- Context menu actions for translate/paraphrase
- Optional auto-replace of selected text
- One-click API connectivity test from popup

## Project Files

- `manifest.json` — MV3 extension manifest
- `service-worker.js` — background logic, context menu, API calls
- `content-script.js` — selection reading, replacement, result modal
- `popup.html`, `popup.js` — quick actions and quick settings
- `options.html`, `options.js` — full configuration page
- `ui.css` — popup/options styles

## Installation

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder: `/home/levi/webui-chrome`
5. Click **Reload** after updates

## Plugin Setup

### Option 1: Direct Ollama
- Provider: `Ollama /api/generate`
- Endpoint: `http://10.20.30.3:11434/api/generate`
- Model: `translategemma:4b`

### Option 2: Open WebUI (local)
- Provider: `OpenAI-style /chat/completions`
- Endpoint: `http://localhost:3000/api/chat/completions`
- Model: your model name in Open WebUI

## Usage

1. Select text in your ticket system page
2. Use hotkeys, popup buttons, or right-click context menu
3. Result behavior:
   - English translate + paraphrase: replace selected text (if enabled) or copy to clipboard
   - Russian translate: always opens in a separate modal with a **Copy** button

## Troubleshooting

### “Could not establish connection. Receiving end does not exist.”
- Reload the extension in `chrome://extensions`
- Reload the target page
- The extension now auto-injects content script when possible, but `chrome://` pages are not supported

### Ollama returns `403 api forbidden`
Usually an Origin restriction for `chrome-extension://...` on direct Ollama calls.

Options:
1. Use Open WebUI provider (`http://localhost:3000/api/chat/completions`)
2. Configure `OLLAMA_ORIGINS` on the Ollama host
