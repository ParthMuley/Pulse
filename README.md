<div align="center">
<img width="1200" height="475" alt="Pulse Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# ⚡ Pulse: Neural Stream DJ

**Dynamic, AI-driven soundtracks for the next generation of live streaming.**

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-orange.svg)](https://opensource.org/licenses/Apache-2.0)
[![Built with Gemini](https://img.shields.io/badge/Built%20with-Gemini%203%20Flash-blue)](https://ai.google.dev/)
[![Built with Lyria](https://img.shields.io/badge/Built%20with-Lyria%203-purple)](https://deepmind.google/technologies/lyria/)

</div>

---

## 🎯 Motive

Live streaming is a two-way conversation between the creator and the audience, yet the audio experience remains static. **Pulse** was born to bridge this gap. Most streamers rely on pre-set playlists that often mismatch the high-intensity moments of a game or the somber tone of a defeat. 

Pulse transforms the stream into a living, breathing experience by generating **real-time, mood-responsive soundtracks**. Whether it's a clutch 1v5 in *Counter-Strike* or a chill building session in *Minecraft*, Pulse analyzes the "vibe" of both the streamer and the chat to ensure the music always matches the moment.

---

## 🏗️ Architecture

Pulse is built on a modern, event-driven architecture that leverages the latest in Generative AI:

### 🧠 The Brain: Gemini 3 Flash
The core analysis engine. It monitors:
- **Twitch Chat:** Real-time audience sentiment and hype levels via IRC WebSockets.
- **Stream Context:** Uses Google Search to identify the game, region, and real-time tournament events.
- **Streamer Commentary:** Analyzes transcriptions to understand the immediate action on screen.

### 🎵 The Composer: Lyria 3 Clip
Once Gemini determines the "Pulse" (intensity, mood, and genre), it prompts **Lyria** to generate high-quality, instrumental music tracks on the fly. These tracks are custom-tailored to the specific game and region (e.g., Brazilian Phonk for a Brazilian CS tournament).

### 🎚️ The Engine: Crossfade Audio Bridge
To ensure a seamless listening experience, Pulse features a custom audio bridge that handles:
- **Audio Crossfading:** Smoothly transitioning between generated tracks as the mood shifts.
- **Audio Capturing:** Processing streamer audio for contextual analysis.
- **WebSocket Synchronization:** Keeping the UI and AI agents in perfect sync.

---

## 🚀 How It Works

1.  **Connection:** User inputs a Twitch URL. Pulse connects to the stream and joins the IRC chat as an observer.
2.  **Monitoring:** The system tracks chat velocity (messages per second) and keywords while analyzing the streamer's tone.
3.  **Analysis:** Every 15-30 seconds, Gemini processes this data to calculate the current **Intensity** (0-100%) and **Mood**.
4.  **Generation:** If a significant shift in the "Pulse" is detected, Lyria generates a new instrumental track.
5.  **Playback:** The new track is crossfaded in, creating a dynamic, evolving soundtrack that perfectly complements the live action.

---

## 📺 Demo

Check out the full demo video to see Pulse in action:

🎥 **[Watch the Demo on Google Drive](https://drive.google.com/drive/folders/1UmctGFd6nMWKEdfbKJCXQ-1WkXhJy6Jz?usp=sharing)**

*(A local preview is also available as `pulse_recording1.mp4` in this repository)*

---

## 🛠️ Getting Started

### Prerequisites
- **Node.js** (v18 or higher)
- **Gemini API Key** (with access to Gemini 3 Flash and Lyria 3)

### Run Locally
1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd Pulse
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Configure Environment:**
   Create a `.env.local` file and add your API key:
   ```env
   GEMINI_API_KEY="your_api_key_here"
   ```
4. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the app.

---

## 📜 License
Pulse is released under the **Apache 2.0 License**.

---

<div align="center">
Built for the Google AI Hackathon 🚀
</div>
