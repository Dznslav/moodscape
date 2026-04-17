# Moodscape

Moodscape is a full-stack application for tracking mood, energy, and sleep, with analytics and next-day prediction features.

Live website: `https://moodscape.website`

The project consists of:

- `frontend` - a Vue 3 + Vite client application
- `backend` - a FastAPI API with PostgreSQL, Redis, and ML-related services
- `docker-compose.yml` - a local environment for running the full stack

## What the app does

- allows users to register, sign in, and manage their profile
- stores daily mood and energy records
- stores sleep logs with duration and quality
- provides statistics, streaks, trends, and a calendar view of entries
- builds next-day predictions using historical and weather data
- supports multiple locales: `ru`, `en`, `by`, `sk`
- includes optional location, weather, and haptic feedback features

## Tech stack

### Frontend

- Vue 3
- Vite
- Vue Router
- Pinia
- Axios
- Chart.js
- Three.js
- Vue I18n

### Backend

- FastAPI
- SQLAlchemy
- PostgreSQL
- Redis
- XGBoost
- scikit-learn
- pandas / numpy

## Project structure

```text
Moodscape_Project/
|- backend/
|  |- app/
|  |  |- api/
|  |  |- core/
|  |  |- db/
|  |  |- ml/
|  |  |- models/
|  |  |- schemas/
|  |  `- services/
|  |- tests/
|  |- main.py
|  `- requirements.txt
|- frontend/
|  |- public/
|  |- src/
|  |  |- api/
|  |  |- assets/
|  |  |- components/
|  |  |- composables/
|  |  |- locales/
|  |  |- router/
|  |  |- stores/
|  |  |- utils/
|  |  `- views/
|  |- package.json
|  `- vite.config.js
|- docker-compose.yml
|- TEXT.md
`- TEXT_OLD.md
```

## Quick start with Docker

If you just want to open the app, use the production website:

- `https://moodscape.website`

### Requirements

- Docker
- Docker Compose

### Run the full project

```sh
docker compose up --build
```

After startup, the services will be available at:

- frontend: `http://localhost:5173`
- backend API: `http://localhost:8000`
- Swagger UI: `http://localhost:8000/docs`
- pgAdmin: `http://localhost:5050`

### Docker services

- `db` - PostgreSQL 15
- `redis` - Redis for cache and background tasks
- `pgadmin` - UI for PostgreSQL administration
- `backend` - FastAPI application
- `frontend` - Vite dev server

## Local development

### 1. Start the infrastructure

If you do not want to run the whole stack with Docker, start at least PostgreSQL and Redis separately.

Default local values:

- PostgreSQL: `postgresql://postgres:admin@localhost:5432/moodscape`
- Redis: `redis://localhost:6379/0`

### 2. Backend

Requirements:

- Python 3.12+

Setup:

```sh
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at `http://localhost:8000`.

### 3. Frontend

Requirements:

- Node.js `^20.19.0 || >=22.12.0`

Setup:

```sh
cd frontend
npm install
copy .env.example .env
npm run dev
```

The frontend will be available at `http://localhost:5173`.

## Environment variables

### Backend

Example: [`backend/.env.example`](/d:/Moodscape_Project/backend/.env.example)

| Variable | Description | Default |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:admin@localhost:5432/moodscape` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379/0` |
| `OPENWEATHER_API_KEY` | OpenWeather API key for weather features | empty |
| `FRONTEND_URL` | frontend URL | `http://localhost:5173` |
| `ALLOWED_ORIGINS` | CORS origins | `http://localhost:5173` |
| `SECRET_KEY` | secret used for JWT/auth | generated or provided manually |
| `ACCESS_TOKEN_EXPIRE_DAYS` | token lifetime | `30` |

### Frontend

Example: [`frontend/.env.example`](/d:/Moodscape_Project/frontend/.env.example)

| Variable | Description | Default |
| --- | --- | --- |
| `VITE_API_URL` | backend base URL | `http://localhost:8000` |

## Main frontend routes

- `/` - welcome / onboarding
- `/login` - sign in
- `/register` - sign up
- `/records` - daily mood and energy entries
- `/sleep` - sleep tracking
- `/statistics` - charts, streaks, and insights
- `/calendar` - calendar overview of entries
- `/prediction` - next-day forecast
- `/settings` - profile and app settings

## Main backend API areas

- `/auth` - registration, login, logout
- `/users` - current user profile management
- `/records` - mood/energy records and import
- `/sleep-logs` - sleep entries and import
- `/predictions` - next-day prediction endpoint
- `/weather` - access to weather data
- `/logs` - service logging endpoints

## Testing

The backend contains tests in [`backend/tests`] covering, for example:

- lifecycle / warm start / cold start scenarios
- weather selection logic
- cache-related behavior

Basic run:

```sh
cd backend
pytest
```

## Notes

- The backend creates database tables on startup via the FastAPI lifespan hook.
- In Docker, the backend listens on container port `10000`, which is mapped to `8000` on the host.
