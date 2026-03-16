<div align="center">

<img src="media/hero.png" alt="NoteScribe AI Hero" width="100%" />

# 🎙️ NoteScribe AI
### *Turn Every Meeting into Structured Knowledge*

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg?style=for-the-badge)](https://github.com/MayankkChaurasia/NoteScribe-ai)
[![License](https://img.shields.io/badge/license-MIT-green.svg?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Chrome-orange.svg?style=for-the-badge)](https://chrome.google.com/webstore)

---

**NoteScribe AI** is a professional Chrome extension designed to automate the heavy lifting of meeting and lecture documentation. Capture high-quality audio, witness real-time transcription, and let AI distill hours of talk into actionable insights in seconds.

[**Features**](#-key-features) • [**Setup**](#-quick-start) • [**Usage**](#-how-it-works) • [**Tech Stack**](#-built-with)

</div>

## ✨ Key Features

<div align="center">
<img src="media/features.png" alt="Features Visualization" width="80%" />
</div>

- 🎙️ **Multi-Source Capture** — Record high-fidelity audio from your microphone or directly from the active browser tab.
- 📝 **Live Transcription** — Real-time speech-to-text powered by the Web Speech API or high-accuracy Whisper.
- 🤖 **AI-Driven Notes** — Automatically generate summaries, key points, and action items using GPT-4o-mini.
- 🔍 **Deep Insights** — Extract decisions, deadlines, and concepts from complex discussions.
- 📂 **Session History** — Effortlessly manage and search through your last 30 recordings stored locally.
- 📤 **Versatile Export** — Save your work as Markdown, PDF, or Plain Text with one click.

---

## 📸 Interface Preview

<div align="center">
<img src="media/mockup.png" alt="NoteScribe UI Mockup" width="90%" />
<p><i>Modern glassmorphism interface with real-time waveform and structured AI insights.</i></p>
</div>

---

## 🚀 Quick Start

### 1. Installation
1. Download or clone this repository.
2. Navigate to `chrome://extensions` in your browser.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the `notescribe-ai` folder.

### 2. Configuration (Optional)
Click the extension icon and open **Settings** ⚙️ to add your **OpenAI API Key**. 
> **Note:** Without a key, the extension uses browser-native speech recognition. With a key, it unlocks the full power of Whisper and GPT-4o-mini.

---

## 🛠️ Built With

NoteScribe AI leverages a modern tech stack to provide a seamless, secure experience:

| Component | Technology |
| :--- | :--- |
| **Framework** | Chrome Extension Manifest V3 |
| **Frontend** | Pure HTML5, CSS3 (Glassmorphism), Vanilla JS |
| **Audio Processing** | MediaRecorder & Web Audio API |
| **AI Engine** | OpenAI GPT-4o-mini & Whisper |
| **Transcription** | Web Speech API |
| **Storage** | Chrome Local Storage API |

---

## 🔒 Privacy & Security

- **Local Processing**: Your audio recordings are processed locally on your device.
- **Direct AI Connection**: Data for transcription/notes is sent directly to OpenAI's API; no middle-man servers are involved.
- **Zero Tracking**: We do not track your usage or collect personal data. Everything stays in your browser's local storage.

---

<div align="center">
<p>Built with ❤️ by the NoteScribe AI Team</p>
<b>Turn every word into a win.</b>
</div>
