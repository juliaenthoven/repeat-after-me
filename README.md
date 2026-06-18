# 🦜 Repeat After Me

An iOS audio teleprompter app built with Expo. An AI voice reads your script line by line — you repeat each line on camera — and your clips are saved for review.

## Features

- **Script splitting** — paste any script and set a max segment length; it splits intelligently at sentence and clause boundaries
- **TTS playback** — the app reads each segment aloud in your chosen voice before you record
- **Auto-advance** — a progress bar fills based on estimated speaking time, then automatically moves to the next segment
- **Pause / Resume** — pause mid-session and pick up from where you left off with a countdown
- **Session overview** — review your recorded clips in a carousel with duration badges
- **Auto-Edit preview** — plays all clips back-to-back with leading/trailing silence trimmed
- **Save & Share** — share individual clips via the iOS share sheet (save to Photos, AirDrop, etc.)

## Running the app

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Expo Go](https://expo.dev/go) installed on your iPhone (SDK 54)

### Setup

```bash
git clone https://github.com/juliaenthoven/repeat-after-me.git
cd repeat-after-me
npm install
npx expo start
```

Scan the QR code with your iPhone camera (or from within Expo Go) to open the app.

> **Note:** This app targets **Expo SDK 54** to match Expo Go. If you see an SDK mismatch error, make sure your Expo Go app is up to date.

### If you're on a different network

If the QR code doesn't connect (e.g. on public WiFi), use tunnel mode:

```bash
npx expo start --tunnel
```

## Project structure

```
src/
  screens/
    HomeScreen.tsx          # Session list
    NewRecordingScreen.tsx  # Script input + settings
    RecordingScreen.tsx     # Live camera + TTS + auto-advance
    SessionOverviewScreen.tsx  # Clip review + auto-edit
  utils/
    storage.ts              # Session persistence + segment splitting
App.tsx                     # Navigation state machine + error handling
```

## Known limitations (Expo Go)

- **Saving to camera roll** — not supported in Expo Go; use the Share button instead and tap "Save Video" in the iOS share sheet
- **Auto-edit file export** — the auto-edit preview plays clips in sequence but cannot produce a downloadable combined file without a native build; coming in V2
- **Voice activity detection** — auto-advance uses a word-count estimate rather than true silence detection; coming in V2

## Building for production

To build a standalone app with full native capabilities (camera roll saving, file export):

```bash
npm install -g eas-cli
eas build --platform ios
```
