# AgriX

This project is an Expo (React Native Web) app with a Node/Express auth API backed by MongoDB.

## Backend (MongoDB Auth API)

The API lives in `server/`.

- Setup steps: see `server/README.md`
- Default URL: `http://localhost:4000`

## Frontend (Expo Web)

Start the web app:

```bash
npm install
npm run web
```

## Connecting Frontend → Backend

The frontend calls the API base URL defined in `src/lib/authApi.js`.

You can override it via the Expo public env var `EXPO_PUBLIC_API_BASE_URL`.

For local development:

- Run the API on `http://localhost:4000`
- Run the web app on `http://localhost:8082`

Create a root `.env` (copy from `.env.example`) if you want to be explicit:

- `EXPO_PUBLIC_API_BASE_URL=http://localhost:4000`

If you run the app on a phone/emulator, you must replace `localhost` with your machine IP (and update `CLIENT_ORIGIN` in `server/.env`).

