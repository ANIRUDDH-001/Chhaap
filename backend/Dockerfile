FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.lock /app/requirements.lock
RUN pip install --no-cache-dir -r requirements.lock
COPY backend /app/backend
RUN pip install --no-deps /app/backend
ENV DATA_DIR=/data/media
RUN useradd --uid 10001 --create-home chhaap && mkdir -p /data/media && chown -R chhaap:chhaap /data
USER chhaap
EXPOSE 8767
CMD ["uvicorn", "chhaap.api:app", "--host", "0.0.0.0", "--port", "8767"]
