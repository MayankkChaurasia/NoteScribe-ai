# NoteScribe AI — Chrome Extension

> Record meetings & lectures, transcribe audio, and generate structured AI notes automatically.

---

## Features

- 🎙️ **Audio Recording** — Microphone or tab audio capture with waveform visualization
- 📝 **Live Transcription** — Real-time speech-to-text using browser Web Speech API
- 🤖 **AI Notes** — GPT-4o-mini generates summary, key points, action items, concepts
- 🔍 **Meeting Insights** — Extracts tasks, decisions, deadlines, and follow-ups
- 👥 **Speaker Segmentation** — Basic turn-based speaker detection
- 💾 **History** — Saves last 30 sessions locally, searchable
- 📤 **Export** — Markdown, PDF, plain text, or clipboard

---

## Setup

### 1. Load the extension

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select this `notescribe-ai` folder

### 2. Add your OpenAI API key (optional but recommended)

1. Click the NoteScribe AI extension icon
2. Click the ⚙️ Settings icon
3. Paste your OpenAI API key (`sk-...`)
4. Click **Save**

> Without an API key: Uses browser's built-in Speech Recognition for transcription and generates demo notes.
> With an API key: Uses Whisper for high-quality transcription + GPT-4o-mini for real AI notes.

Get your API key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

---

## Usage

1. Click the extension icon in the Chrome toolbar
2. Choose audio source (Microphone or Tab Audio) in Settings
3. Click **Start Recording**
4. Speak, present, or let the meeting run
5. Click **Stop Recording** when done
6. Review your transcript in the **Transcript** tab
7. Click **Generate AI Notes** for structured notes
8. Check **Insights** for tasks, decisions, and deadlines
9. Export using the buttons in the footer

---

## File Structure

```
notescribe-ai/
├── manifest.json      — Extension manifest (MV3)
├── popup.html         — Main popup UI
├── popup.css          — Dark theme styles
├── popup.js           — UI controller / orchestration
├── recorder.js        — Audio recording + waveform visualization
├── ai.js              — Whisper transcription + GPT notes generation
├── utils.js           — Storage, export (MD/PDF/TXT), helpers
├── background.js      — Service worker (tab capture, keep-alive)
├── content.js         — Page integration + platform detection
└── icons/             — Extension icons (16, 48, 128px)
```

---

## Keyboard Shortcut

**Alt + Shift + R** — Toggle recording from any tab

---

## Privacy

- All recordings are processed locally or sent directly to OpenAI's API
- No data is sent to any third-party servers
- Sessions are stored in Chrome's local storage (only on your device)

---

## Tech Stack

- **Chrome Extension**: Manifest V3
- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Audio**: MediaRecorder API + Web Audio API (waveform)
- **Transcription**: Web Speech API (browser) or OpenAI Whisper API
- **AI Notes**: OpenAI GPT-4o-mini
- **Storage**: Chrome Storage API (local)
- **Export**: Blob + File API (MD/TXT), Print API (PDF)

---

*Built with NoteScribe AI — turn every meeting into structured knowledge.*
