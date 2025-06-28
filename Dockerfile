# ---- Builder Stage ----
# Use an official Python runtime as a parent image
FROM python:3.13-slim AS builder

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set the working directory in the container for the build stage
WORKDIR /app

# Install Poetry
# We install system-wide for this build stage
RUN pip install --no-cache-dir poetry==1.7.1

# Copy only the files necessary for installing dependencies from your backend folder
COPY backend/pyproject.toml backend/poetry.lock* ./

# Configure Poetry to not create a virtual environment within the project
# And install dependencies without dev dependencies.
RUN poetry config virtualenvs.create false && \
    poetry install --no-dev --no-interaction --no-ansi --no-root

# ---- Final Stage ----
# Use a slim Python image for the final application
FROM python:3.13-slim AS final

# Set environment variables for the final image
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
# APP_MODULE is now relative to the WORKDIR /app/backend
ENV APP_MODULE="app.main:app"
ENV HOST="0.0.0.0"
ENV PORT="8080"

# Create a non-root user and group
RUN groupadd -r appuser && useradd --no-log-init -r -g appuser appuser

# Set an initial working directory for copying files
WORKDIR /app

# Copy the installed dependencies from the builder stage
COPY --from=builder /usr/local/lib/python3.13/site-packages /usr/local/lib/python3.13/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy the entire application code from your host's backend folder
# into /app/backend in the container
COPY ./backend /app/backend

# Change ownership of the /app directory (and its contents like /app/backend)
# to the non-root user
RUN chown -R appuser:appuser /app

# Set the final working directory TO your backend code's root
# This means the CMD will execute as if run from /app/backend
WORKDIR /app/backend

# Switch to the non-root user
USER appuser

# Expose the port the app runs on
EXPOSE 8080

# Command to run the application using Uvicorn
# Since WORKDIR is /app/backend, 'app.main:app' correctly resolves to
# /app/backend/app/main.py and the 'app' instance within it.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]