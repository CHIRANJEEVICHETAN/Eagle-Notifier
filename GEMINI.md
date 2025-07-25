# Gemini Code Assistant Configuration

This file provides context to the Gemini code assistant for the Eagle-Notifier project.

## Project Overview

Eagle-Notifier is a full-stack application designed for monitoring and sending notifications. It consists of a React Native (Expo) mobile frontend and a Node.js (Express) backend.

## High-Level Architecture

- **Frontend**: A mobile application built with React Native and Expo. It's located in the `/app` directory.
- **Backend**: A Node.js API server built with Express. It's located in the `/backend` directory.
- **Database**: PostgreSQL with Prisma as the ORM.

## Development Environment

- The project is a monorepo with two main parts: `app` and `backend`.
- Each part has its own `package.json` and dependencies.
- The root directory contains shared configuration files like ESLint and Prettier.

## General Instructions

- **Code Style**: Follow the existing code style. Use the ESLint and Prettier configurations in the root directory.
- **Commits**: Write clear and concise commit messages.
- **Dependencies**: Before adding a new dependency, check if a similar one already exists.
- **Testing**: Add tests for new features and bug fixes.
