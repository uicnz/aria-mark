# Aria Mark

A markdown editor with voice transcription that stores content entirely in the URL hash. No backend, no accounts, no data collection.

## Features

- Markdown editing with live preview
- Voice-to-text transcription (OpenAI Whisper, Google Cloud Speech)
- URL-based storage (up to 16K characters with gzip compression)
- Light/dark theme
- Share via link

## Usage

```bash
bun install
bun run dev
```

Open `http://localhost:5173` in your browser.

## How it works

Content is compressed with gzip, base64 encoded, and stored in the URL hash. Share the URL to share your document. No server required.

## Keyboard shortcuts

- `Cmd/Ctrl + E` - Cycle preview modes (edit / split / preview)
- `Cmd/Ctrl + Enter` - Start/stop voice recording

## Build

```bash
bun run build
```

Output goes to `dist/`.
