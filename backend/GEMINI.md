# Gemini Code Assistant Configuration - Backend

This file provides context to the Gemini code assistant for the Eagle-Notifier backend application.

## Backend Technology Stack

- **Framework**: Node.js with Express
- **Language**: TypeScript
- **Database ORM**: Prisma
- **Database**: PostgreSQL
- **Authentication**: JWT (JSON Web Tokens)
- **Middleware**: `express-async-handler` for error handling, `cors` for Cross-Origin Resource Sharing, `helmet` for security headers, and `express-rate-limit` for rate limiting.
- **Scheduled Jobs**: `node-schedule` and `cron` are used for background tasks.
- **Linting**: ESLint
- **Build Tool**: `tsc` (TypeScript Compiler)

## Project Structure

- **Server Entry Point**: `server.ts`
- **Configuration**: Database and other configurations are in `src/config`.
- **Routes**: API routes are defined in `src/routes`.
- **Controllers**: Request/response logic is handled in `src/controllers`.
- **Services**: Business logic is encapsulated in `src/services`.
- **Middleware**: Custom middleware is located in `src/middleware`.
- **Database Schema**: The Prisma schema is at `prisma/schema.prisma`.
- **Migrations**: Database migrations are in `prisma/migrations`.

## Development Workflow

- **Run Development Server**: Use `npm run dev` to run the server with `nodemon`.
- **Build for Production**: Use `npm run build` to compile TypeScript to JavaScript.
- **Run in Production**: Use `npm start` to run the compiled server.
- **Database Migrations**: Use `prisma migrate dev` for development and `prisma migrate deploy` for production.
- **Prisma Client**: After changing the schema, run `prisma generate` to update the Prisma client.
- **Code Style**: Follow the existing code style. Use async/await for asynchronous operations.
- **Error Handling**: Use the `express-async-handler` to wrap async route handlers and the custom error handler in `src/middleware/errorHandler.ts`.
