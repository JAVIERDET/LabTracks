FROM ghcr.io/astral-sh/uv:latest AS uv

FROM python:3.12-slim

WORKDIR /app

# Environment configuration
ENV UV_COMPILE_BYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"

# Copy uv binary from official uv image
COPY --from=uv /uv /uvx /bin/

# Copy dependency definitions
COPY pyproject.toml README.md /app/

# Install dependencies into virtualenv
RUN uv sync --no-install-project

# Copy application code
COPY . /app/

# Final sync to install project package
RUN uv sync

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

