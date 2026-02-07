# Backend Documentation

This folder contains documentation for the backend services, middleware, and API endpoints.

## Table of Contents

### Core

### Middleware
- [Signup Validation](api/middleware/signup_validation.md) - Documentation for the user signup validation logic.
- [Survey Validation](api/middleware/survey_validation.md) - Documentation for the survey submission validation logic.

### Models

### Routes

### Schemas

### Services

## Overview

The backend is built using FastAPI and follows a modular structure:

- `app/api`: Contains the API route handlers and endpoints.
- `app/middleware`: Contains custom middleware for authentication and validation.
- `app/models`: Contains database models.
- `app/schemas`: Contains Pydantic schemas for request/response validation.
- `app/services`: Contains business logic and service layers.

## Technology Requirements

The backend leverages a modern Python stack designed for performance and developer productivity:

- **[FastAPI](https://fastapi.tiangolo.com/)**: A modern, fast (high-performance) web framework for building APIs with Python.
- **[Uvicorn](https://www.uvicorn.org/)**: A lightning-fast ASGI server implementation handling network communication such as sending and receiving requests from clients.
- **[Pydantic](https://docs.pydantic.dev/)**: Data validation and settings management using Python type annotations. Used extensively for request/response schemas and configuration.
- **[Psycopg](https://www.psycopg.org/psycopg3/)**: The most popular PostgreSQL adapter for the Python programming language.
- **[Python-Jose](https://python-jose.readthedocs.io/)**: A JavaScript Object Signing and Encryption (JOSE) implementation in Python, used for handling JWTs (JSON Web Tokens).
- **[Bcrypt](https://github.com/pyca/bcrypt/)**: A library for hashing passwords securely.
- **[Python-Dotenv](https://saurabh-kumar.com/python-dotenv/)**: Reads key-value pairs from a `.env` file and can set them as environment variables.

## Getting Started

To run the backend using Docker Compose:

1. **Prerequisites**: Ensure you have Docker and Docker Compose installed on your machine.
2. **Build and Run**: From the root of the project (where `docker-compose.yml` is located), run:
   ```bash
   docker-compose up --build
   ```
   This command will:
   - Build the backend image using the `Dockerfile`.
   - Install all Python dependencies defined in `requirements.txt`.
   - Start the FastAPI server (and any other services defined in `docker-compose.yml`).

3. **Access the API**: Once running, the backend API will be accessible at `http://localhost:8000` (or the port configured in your docker-compose file).

For more details on specific components, please refer to the linked documentation files above.
