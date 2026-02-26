# ScrapeFlow - Enterprise Data Scraping CRM

## Overview

ScrapeFlow is a full-stack web application for managing data scraping workflows. Users upload Excel/CSV files containing property data records, which are parsed and stored as individual "scrape items" that can be tracked through processing statuses (pending, processing, completed, failed). The app provides a dashboard with metrics, a file upload interface, and a task management view.

The project follows a monorepo structure with three main directories:
- `client/` — React single-page application
- `server/` — Express.js API server
- `shared/` — Shared types, schemas, and route definitions used by both client and server

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (client/)
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side router)
- **State Management**: TanStack React Query for server state (fetching, caching, mutations)
- **UI Components**: shadcn/ui component library (new-york style) built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming, custom design tokens in `index.css`
- **Fonts**: Inter (body) and Outfit (display/headings) via Google Fonts
- **Icons**: Lucide React
- **Build Tool**: Vite with React plugin
- **Path Aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

**Key Pages**:
- Dashboard (`/`) — Overview with stats cards and recent activity
- Upload (`/upload`) — Drag-and-drop Excel/CSV file upload
- Tasks (`/tasks`) — Table view of scrape items with filtering, search, and status management

**Custom Hooks** (`client/src/hooks/use-scraping.ts`):
- All API interactions are centralized here using React Query hooks
- Mutations automatically invalidate related queries for consistency

### Backend (server/)
- **Framework**: Express.js with TypeScript, running on Node.js
- **File Uploads**: Multer with memory storage for handling multipart form data
- **Excel Parsing**: `xlsx` library for parsing uploaded spreadsheet files server-side
- **API Pattern**: RESTful JSON API under `/api/` prefix
- **Dev Server**: Vite dev server middleware for HMR during development
- **Production**: Static file serving from `dist/public/` with SPA fallback
- **Build**: esbuild bundles server code to `dist/index.cjs`, Vite builds client to `dist/public/`

### Shared Layer (shared/)
- **Schema** (`schema.ts`): Drizzle ORM table definitions and Zod validation schemas
- **Routes** (`routes.ts`): Centralized API route definitions with path constants and response schemas, used by both client and server for type safety

### Database
- **Database**: PostgreSQL (required via `DATABASE_URL` environment variable)
- **ORM**: Drizzle ORM with `drizzle-zod` for schema-to-validation integration
- **Schema Push**: `npm run db:push` uses drizzle-kit to push schema changes
- **Tables**:
  - `uploads` — Tracks uploaded files (id, filename, createdAt)
  - `scrape_items` — Individual data rows from uploads (id, uploadId FK, data as JSONB, status, result, timestamps)
- **Data Model**: Excel row data is stored as flexible JSONB but has an expected schema with columns like "File Number", "State", "County", "Party Name 1-4", "Property Address", "Lot", "Block", "Townsnhip" (note: typo is intentional in schema), "Prior Effective Date"

### Storage Layer (server/storage.ts)
- Implements `IStorage` interface with `DatabaseStorage` class
- CRUD operations for uploads and scrape items
- Status management for individual items and bulk operations

### Build System
- **Development**: `npm run dev` runs tsx to execute the server with Vite middleware for HMR
- **Production Build**: `npm run build` runs `script/build.ts` which uses Vite for client and esbuild for server, with a curated allowlist of dependencies to bundle for faster cold starts
- **Type Checking**: `npm run check` runs TypeScript compiler in noEmit mode

## External Dependencies

### Required Services
- **PostgreSQL Database**: Required. Connection string via `DATABASE_URL` environment variable. Uses `connect-pg-simple` for session storage and `pg` Pool for connections.

### Key NPM Packages
- **drizzle-orm** + **drizzle-kit**: Database ORM and migration tooling
- **xlsx**: Server-side Excel file parsing
- **multer**: Multipart file upload handling
- **zod**: Runtime validation for API inputs/outputs
- **@tanstack/react-query**: Client-side data fetching and caching
- **wouter**: Lightweight client-side routing
- **shadcn/ui** (Radix UI + Tailwind): Component library
- **date-fns**: Date formatting utilities
- **framer-motion**: Animation library (referenced in requirements)

### Replit-Specific Plugins
- `@replit/vite-plugin-runtime-error-modal`: Error overlay in development
- `@replit/vite-plugin-cartographer`: Development tooling (dev only)
- `@replit/vite-plugin-dev-banner`: Development banner (dev only)