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

## Deployment

The app deploys automatically to GitHub Pages on push to `main`.

**Default URL:** `https://uicnz.github.io/aria-mark/`

### Custom Domain Setup (yoyo.io)

When ready to switch to the custom domain:

1. Create `public/CNAME` with content:

   ```
   yoyo.io
   ```

2. Configure DNS at Cloudflare with A records pointing to GitHub Pages:

   ```
   185.199.108.153
   185.199.109.153
   185.199.110.153
   185.199.111.153
   ```

3. In GitHub repo settings, go to Pages and add `yoyo.io` as the custom domain

4. Enable "Enforce HTTPS" once the certificate is provisioned

5. Push the CNAME file - the next deployment will serve from yoyo.io
