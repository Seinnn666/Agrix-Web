# AgriX Auth API (MongoDB)

## Setup

1. Create a MongoDB database (recommended: MongoDB Atlas).
2. In Atlas:
   - Create a cluster
   - Create a database user
   - Network Access → allow your IP (or `0.0.0.0/0` for quick dev only)
   - Copy the connection string

## Environment

Create `server/.env` based on `server/.env.example`:

- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: random secret string
- `PORT`: API port (default `4000`)
- `CLIENT_ORIGIN`: your web app origin (default `http://localhost:8082`)

Optional (for quick local testing without Atlas):

- `USE_MEMORY_DB=true` to run with an in-memory MongoDB (data is not persisted)

## Install & Run

From `server/`:

```bash
npm install
npm run dev
```

Health check:

`GET http://localhost:4000/health`

## Endpoints

### Register

`POST /auth/register`

Body:

```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "phone": "1234567890",
  "email": "jane@example.com",
  "password": "password123"
}
```

### Login

`POST /auth/login`

Body:

```json
{
  "email": "jane@example.com",
  "password": "password123"
}
```

