# YouTube to MP3 Converter

A full-stack app that converts YouTube videos to downloadable MP3 files.

## Overview

This repository contains:

- `frontend/`: React + Vite client app
- `backend/`: Express API that fetches metadata, downloads audio with `yt-dlp`, converts to MP3 with `ffmpeg`, and stores download history in MongoDB

## Features

- Accepts multiple YouTube URL formats (`watch`, `youtu.be`, `shorts`, `embed`)
- Fetches video metadata (title, thumbnail, duration)
- Converts and streams audio to MP3 download
- Selectable quality (`128`, `192`, `256`, `320` kbps)
- Rate-limited download endpoint (`15` requests/minute/IP)
- Download history persistence in MongoDB
- Metadata fallback using YouTube oEmbed when `yt-dlp` is blocked

## Tech Stack

### Frontend

- React 19
- Vite
- React Router
- Axios
- Sass

### Backend

- Node.js + Express
- yt-dlp (`yt-dlp-exec`)
- ffmpeg (`fluent-ffmpeg` + `ffmpeg-static`)
- MongoDB + Mongoose
- express-rate-limit

## Project Structure

```text
yt-to-mp3/
  backend/
    server.js
    src/
      app.js
      controllers/
      routes/
      models/
      config/
  frontend/
    src/
      features/
      App.jsx
```

## Prerequisites

- Node.js 18+
- npm
- MongoDB (local or cloud)
- Internet access from server to YouTube

## Environment Variables

Create `backend/.env`:

```env
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/yt_to_mp3
# Optional: YouTube cookies content (raw text)
YOUTUBE_COOKIES=
```

Notes:

- If `YOUTUBE_COOKIES` is set, backend writes it to `backend/cookies.txt` on startup.
- Frontend API base URL can be configured with `VITE_API_BASE_URL` (defaults to `/api`).

## Installation

Install dependencies in both apps:

```bash
cd backend
npm install

cd ../frontend
npm install
```

## Run Locally

Open two terminals:

1. Start backend

```bash
cd backend
npm run dev
```

2. Start frontend

```bash
cd frontend
npm run dev
```

Default URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`

## API Endpoints

Base path: `/api`

### `GET /info`

Query params:

- `url` (required): YouTube URL

Success response:

```json
{
  "title": "Video title",
  "thumbnail": "https://...",
  "duration": 123
}
```

### `GET /download`

Query params:

- `url` (required): YouTube URL
- `quality` (optional): `128 | 192 | 256 | 320` (default `320`)

Response:

- Streams `audio/mpeg` with `Content-Disposition: attachment`

### `GET /history`

Query params:

- `page` (optional, default `1`)
- `limit` (optional, default `20`, max `50`)

Response:

- Array of history documents sorted by latest first

## Build Frontend

```bash
cd frontend
npm run build
npm run preview
```

## Notes and Limitations

- Some videos may fail due to YouTube anti-bot protections, region restrictions, or private/deleted state.
- Download timeout is set to 3 minutes in backend.
- Ensure your MongoDB instance is reachable before starting backend.

## License

ISC
