# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Build for production
npm run lint     # Run ESLint

# Prisma
npx prisma migrate dev   # Apply migrations and regenerate client
npx prisma generate      # Regenerate Prisma client after schema changes
npx prisma studio        # Open Prisma Studio GUI for the database
```

## Architecture

This is a **Next.js 16 App Router** project called "pocket-recipe" — a recipe management app. It uses the **dual-client pattern**: Supabase for authentication and Prisma for all database operations.

### Authentication (Supabase)

Authentication is handled via Supabase with three context-specific clients:

- `app/utils/supabase/client.ts` — Browser/Client Components (`createBrowserClient`)
- `app/utils/supabase/server.ts` — Server Components (`createServerClient` with Next.js cookies)
- `app/utils/supabase/middleware.ts` — Session refresh in middleware (`updateSession`)

`middleware.ts` at the root runs `updateSession` on every request (excluding static assets) to keep Supabase sessions alive via cookie refresh.

### Database (Prisma + Supabase PostgreSQL)

Prisma 7 connects via the `@prisma/adapter-pg` driver adapter (`PrismaPg`) rather than Prisma's native connection. The singleton client is in `lib/prisma.ts` (prevents connection exhaustion in dev with hot reload).

`prisma.config.ts` at the root is a Prisma 7 config file — it loads `.env.local` via `dotenv` and points to `prisma/schema.prisma`. This means `DATABASE_URL` must be in `.env.local`, not `.env`.

Schema models (`prisma/schema.prisma`):
- `User` — linked to Supabase Auth user by UUID, owns recipes
- `Recipe` — has `sourceType` ('url' | 'photo' | 'manual'), belongs to a User
- `Ingredient` — ordered list items on a Recipe
- `Step` — ordered steps on a Recipe
- `Category` / `RecipeCategory` — many-to-many category tagging

### Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=           # Supabase PostgreSQL connection string for Prisma
```

### Styling

Tailwind CSS v4 via `@tailwindcss/postcss`. No separate `tailwind.config.js` — configuration is handled through PostCSS.

### Dev Utilities

`app/test/page.tsx` is a connection test page (`/test`) that verifies Supabase Auth and Prisma DB connectivity — useful during setup.
