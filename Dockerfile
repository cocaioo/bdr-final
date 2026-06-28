# syntax=docker/dockerfile:1

# Build the React/Vite frontend with the Node version used by the project.
FROM node:24-slim AS frontend-builder

WORKDIR /build/frontend

COPY dashboard/frontend/ ./

ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

RUN npm ci && npm run build

# Run FastAPI and serve the generated frontend from the same process.
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt ./requirements.txt
COPY dashboard/backend/requirements.txt ./dashboard-backend-requirements.txt
RUN pip install --no-cache-dir -r requirements.txt -r dashboard-backend-requirements.txt

COPY dashboard/backend/ ./dashboard/backend/
COPY --from=frontend-builder /build/frontend/dist/ ./dashboard/frontend/dist/

# Versioned response files and the small runtime catalogs used by the API.
COPY Caio/ ./Caio/
COPY JF/ ./JF/
COPY catalogos/ ./catalogos/
COPY dados_padronizados/deputados.csv ./dados_padronizados/deputados.csv

RUN useradd -m -u 1000 appuser

USER appuser

EXPOSE 7860

CMD ["python", "-m", "uvicorn", "app.main:app", "--app-dir", "/app/dashboard/backend", "--host", "0.0.0.0", "--port", "7860"]
