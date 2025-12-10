# App Feedback Management System (AFMS) Development Rules

## 1. Introduction

This document defines the development rules for the **App Feedback Management System (AFMS)** in a monorepo structure. This system collects feedback from mobile apps via a dedicated API (Cloudflare Workers) and manages it via an Admin Dashboard (Next.js on Cloudflare Workers). The goal is to maintain consistency, scalability, and code quality across the entire repository while ensuring strict separation of concerns between data ingestion and management.

## 2. Technology Stack

### Common Stack

- Bun
- TypeScript
- Zod
- Biome

### Frontend (Next.js - `apps/web`)

- Next.js (App Router)
- Tailwind CSS
- shadcn/ui
- Drizzle ORM (consuming `packages/db`)
- Better Auth
- React Hook Form
- Cloudflare Workers (Deploy Target)

### Backend (Cloudflare Workers - `apps/server`)

- Hono
- Cloudflare Workers (Deploy Target)
- Drizzle ORM (consuming `packages/db`)
- OpenAPI
- Swagger UI

## 3. Monorepo Structure

We use a standard monorepo structure with `apps` and `packages`.

```
monorepo-root/
├── apps/
│   ├── web/              # Next.js admin dashboard (Cloudflare Workers)
│   └── server/           # Backend server for feedback ingestion and auth
├── packages/
│   ├── auth/             # Shared authentication helpers and types
│   ├── config/           # Shared configurations (tsconfig, tooling)
│   └── db/               # Drizzle schema and database utilities
├── turbo.json
└── package.json
```

## 4. Common Development Rules

These rules apply to all code within the monorepo, including all `apps` and `packages`.

### File Length and Structure

- **Maximum file size**: Never exceed 500 lines per file.
- **Split threshold**: If approaching 400 lines, break it up immediately.
- **Unacceptable size**: Treat 1000 lines as unacceptable, even temporarily.
- **Organization**: Use folders and naming conventions to keep small files logically grouped.

### OOP First

- Every functionality should be in a dedicated class, struct, or protocol, even if it's small.
- Favor composition over inheritance, but always use object-oriented thinking.
- Code must be built for reuse, not just to "make it work."

### Single Responsibility Principle

- Every file, class, and function should do one thing only.
- If it has multiple responsibilities, split it immediately.
- Each component, route, service, or utility should be laser-focused on one concern.

### Modular Design

- Code should connect like Lego - interchangeable, testable, and isolated.
- Ask: "Can I reuse this in a different app or project?" If not, refactor it.
- Reduce tight coupling between components.

### Function and Class Size

- Keep functions under 30-40 lines.
- If a class is over 200 lines, assess splitting into smaller helper classes.

### Naming and Readability

- All class, method, and variable names must be descriptive and intention-revealing.
- Avoid vague names like `data`, `info`, `helper`, or `temp`.

### Scalability Mindset

- Always code as if someone else will scale this.
- Include extension points (e.g., protocol conformance, dependency injection) from day one.

### Avoid God Classes

- Never let one file or class hold everything (e.g., a massive utility file or a component with too much logic).
- Split responsibilities into dedicated files and directories.

### Type Definitions

- **Single Source of Truth**:
  - Database types should be exported from `packages/db` (inferred from Drizzle schemas).
  - Authentication types and helpers should be imported from `packages/auth`.
  - Validation/API types should be colocated with their consumers (per app) and shared via packages only when reused across apps.
  - Avoid creating manual interface definitions in a separate `types` package unless absolutely necessary.

## 5. Frontend Development Rules (`apps/web`)

These rules are specific to the Next.js application.

### Responsibility Separation Patterns

- **Routing & Pages**: `app/` (Next.js App Router)
- **UI logic**: `hooks/`, `components/`
- **Business logic**: `utils/`
- **State management**: `providers/`
- **Server Actions**: `actions/`
- Never mix view logic and business logic directly in page components.

### Project Structure (`apps/web/src`)

```
src/
├── app/                # Next.js App Router: pages, layouts, route handlers
│   ├── (auth)/         # Route group for authentication pages
│   └── api/            # API routes
├── actions/            # Server Actions
├── components/         # Reusable UI components (shadcn/ui installed here)
├── constants/          # Constants and configuration
├── hooks/              # Custom React hooks
├── types/              # Frontend-specific type definitions
├── utils/              # Business logic, helpers
└── providers/          # React Context providers
```

### File Naming Conventions

- **App Router**: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`.
- **Components**: PascalCase (`UserProfile.tsx`). Suffix with `.client.tsx` or `.server.tsx` if needed.
- **Hooks**: camelCase, starting with `use` (`useAuth.ts`).
- **Providers**: PascalCase + `Provider` (`AuthProvider.tsx`).
- **Actions**: camelCase, suffix with `.actions.ts` (`user.actions.ts`).

### Server Action Rules

- Server Actions must only be used for data mutations (POST, PUT, DELETE operations).
- Do not use them for data fetching (GET requests). Their primary purpose is handling form submissions.
- Authentication checks (via Better Auth) are mandatory in every action.

## 6. Backend Development Rules (`apps/server`)

These rules are specific to the Cloudflare Workers application.

### Responsibility Separation Patterns

- **API Routes**: `routes/` (Hono API routes)
- **Business logic**: `services/`
- **Middleware**: `middleware/` (API Key Validation, Rate Limiting)
- **Database Access**: `db/` (Drizzle client instance)
- **Validation**: `zod/` (imports from `packages/zod-schemas`)
- **Types**: `types/` (Infer from Zod/Drizzle)
- **Utilities**: `utils/`
- **Configuration**: `constants/`
- Never mix API logic and business logic directly in route handlers.

### Project Structure (`apps/server/src`)

```
src/
├── constants/          # Constants and configuration
├── index.ts            # Main entry point (Hono app)
├── middleware/         # Middleware (auth, errorHandler, logger)
├── routes/             # API route handlers
│   └── api/
│       └── v1/         # API version 1 endpoints
├── services/           # Business logic and external integrations
├── types/              # Backend-specific types
├── utils/              # Helper functions
└── zod/                # Backend-specific Zod schemas
```

### File Naming Conventions

- **API Routes**: camelCase (`user.ts`, `product.ts`).
- **Services**: camelCase (`userService.ts`, `paymentService.ts`).
- **Middleware**: camelCase (`auth.ts`, `errorHandler.ts`).
- **Others**: camelCase.

### API Route Rules

- Follow RESTful conventions:
  - `GET`: Data retrieval.
  - `POST`: Data creation and processing (including AI operations).
  - `PUT`: Data updates.
  - `DELETE`: Data removal.
- All routes must include proper validation using Zod schemas.
- **Authentication**: Public API endpoints must be protected by API Key (Header: `X-App-Api-Key`).
- Implement proper rate limiting and logging.

## 7. Commit Message Rules

Please create commit messages according to the following example.
Also, write in Japanese.

```
ユーザー認証時のセッション管理バグを修正

- ログイン後のセッションが正しく保持されない問題を解決
- セキュリティトークンの有効期限チェックを追加
```
