# WhatsApp Broadcasting Platform

## Overview

This is an enterprise-grade WhatsApp broadcasting web application built for managing message templates, campaigns, and real-time message delivery tracking via the Meta WhatsApp Business API. The platform features a dashboard with analytics, template management with approval workflows, campaign scheduling and execution, message tracking with delivery status updates, and API settings configuration.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is a React single-page application using TypeScript with the following key decisions:

- **Routing**: Uses `wouter` for lightweight client-side routing instead of React Router
- **State Management**: TanStack React Query for server state, with optimistic updates and caching
- **UI Framework**: shadcn/ui component library built on Radix UI primitives, following Carbon Design System principles for data-dense enterprise interfaces
- **Styling**: Tailwind CSS with CSS custom properties for theming (light/dark mode support)
- **Forms**: React Hook Form with Zod validation via @hookform/resolvers
- **Charts**: Recharts library for data visualization (area charts, bar charts, pie charts)

### Backend Architecture

The backend is an Express.js server running on Node.js with TypeScript:

- **API Design**: RESTful endpoints under `/api/*` prefix for all data operations
- **WebSocket**: Real-time updates via WebSocket server at `/ws` path using the `ws` package
- **Server Structure**: Single entry point (`server/index.ts`) with routes registered in `server/routes.ts`
- **Storage Layer**: Abstract `IStorage` interface in `server/storage.ts` allowing swappable storage implementations
- **Static Serving**: Production builds served from `dist/public`, with Vite dev server middleware in development
- **Build Process**: Custom build script using esbuild for server bundling and Vite for client bundling
- **Validation**: Zod schemas for all PATCH/PUT endpoints ensuring type-safe updates

### Real-Time Architecture

The platform uses WebSocket for real-time updates:

- **Server**: WebSocket server attached to HTTP server at `/ws` path
- **Client**: `useWebSocket` hook in `client/src/hooks/use-websocket.ts` with auto-reconnect
- **Events**: 
  - `message-status-update`: Message delivery status changes
  - `template-updated`: Template status changes
  - `campaign-updated`: Campaign progress updates
  - `activity-added`: New activity feed entries
  - `settings-updated`: API configuration changes
- **Cache Invalidation**: WebSocket events automatically invalidate TanStack Query caches

### Data Layer

- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema**: Defined in `shared/schema.ts` with Zod validation schemas generated via `drizzle-zod`
- **Migrations**: Drizzle Kit configured to output migrations to `./migrations` directory
- **Key Entities**: Users, Templates (with approval statuses), Campaigns (with execution states), Messages (with delivery tracking), CampaignMetrics, ApiSettings, WhatsAppAccounts, Contacts, ContactLists, ContactTags, Conversations, ConversationMessages, Notifications

### Multi-Account Support

The platform supports multiple WhatsApp Business numbers with account switching:
- **Account Switcher**: Dropdown in sidebar header to switch between connected WhatsApp numbers
- **Data Scoping**: Contacts, lists, tags, conversations, and notifications are scoped to the active account
- **Account Verification**: All update/delete operations verify accountId before allowing mutations
- **Account Creation**: Facebook OAuth flow for connecting new WhatsApp Business accounts (UI stub - backend OAuth not yet implemented)

### Known Limitations (MVP)
- Active account selection is stored in memory only (resets on server restart)
- Facebook OAuth for adding new WhatsApp numbers is a UI stub only
- Dashboard analytics are global, not yet filtered by active account

### Recent Changes (January 2026)

- Added multi-account support with account switcher in sidebar
- Created Inbox page for 2-way messaging with conversation list and message threads
- Created Contacts page with contacts table, lists management, and tags
- Created Notifications page for broadcast scheduling and delivery tracking
- All contact-related data is now scoped per WhatsApp account

### Development vs Production

- **Development**: Vite dev server with HMR, runtime error overlay, and Replit-specific plugins
- **Production**: Pre-built static assets served by Express, server code bundled with esbuild

## External Dependencies

### Meta WhatsApp Business API

Primary external integration for:
- Template submission and status synchronization (PENDING, APPROVED, REJECTED, DISABLED, PAUSED)
- Message sending and delivery status webhooks (queued, sent, delivered, read, failed)
- Quality score tracking for templates

### Database

- **PostgreSQL**: Primary database accessed via `DATABASE_URL` environment variable
- **Sessions**: `connect-pg-simple` for session storage in PostgreSQL

### Third-Party Libraries

- **UI Components**: Full shadcn/ui component set with Radix primitives
- **Date Handling**: date-fns for date formatting and manipulation
- **Validation**: Zod for runtime type validation across client and server
- **HTTP Client**: Native fetch API wrapped in custom `apiRequest` utility