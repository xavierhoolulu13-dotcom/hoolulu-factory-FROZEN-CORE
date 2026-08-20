FROM node:22-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FACTORY_ENVIRONMENT=production \
    FACTORY_PORT=8000
WORKDIR /app
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt
COPY backend/ /app/backend/
COPY core/ /app/core/
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist
RUN useradd --create-home --uid 10001 factory \
    && mkdir -p /app/.data /app/.factory/runs \
    && chown -R factory:factory /app/.data /app/.factory \
    && chmod a-w /app/core/FROZEN_CORE.json /app/core/FROZEN_CORE.sha256
USER factory
EXPOSE 8000
HEALTHCHECK --interval=20s --timeout=3s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health')" || exit 1
CMD ["uvicorn", "app.main:app", "--app-dir", "backend", "--host", "0.0.0.0", "--port", "8000"]
