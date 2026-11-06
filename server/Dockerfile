# ==============================================================================
# Codebase Intelligence - Backend API & Worker Dockerfile
# ==============================================================================
FROM python:3.11-slim

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

WORKDIR /app

# Install system dependencies (git is strictly required for repository cloning)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend source code and migrations
COPY . /app/

EXPOSE 8000

# Default command runs the FastAPI web API
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

