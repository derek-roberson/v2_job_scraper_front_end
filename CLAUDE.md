# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15 frontend application for a job scraper system. The project appears to be in early development with basic scaffolding in place. Based on the requirements document, this will be a comprehensive job search platform integrated with Supabase for backend services.

## Development Commands

```bash
# Development server (with Turbopack)
npm run dev

# Build for production  
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

The development server runs on http://localhost:3000

## Architecture

### Tech Stack
- **Framework**: Next.js 15 (App Router)
- **UI**: React 19 + Tailwind CSS 4 
- **Components**: shadcn/ui (configured for "new-york" style)
- **Icons**: Lucide React
- **Backend**: Supabase (based on requirements document)
- **State Management**: TanStack Query (React Query) - referenced in requirements
- **Authentication**: Supabase Auth - referenced in requirements

### Project Structure
- `app/` - Next.js App Router pages and layouts
- `lib/` - Utility functions and shared logic
- `components/` - Reusable React components (shadcn/ui components will be added here)
- `public/` - Static assets

### Key Configuration
- **TypeScript**: Strict mode enabled, paths configured with `@/*` aliases
- **Tailwind**: Version 4 with CSS variables, base color slate
- **ESLint**: Next.js recommended config with TypeScript support
- **shadcn/ui**: Configured with New York style, RSC enabled, CSS variables

### Planned Features (from requirements document)
The application will include:
- User authentication and profile management
- Job query creation and management with location/keyword filters
- Real-time job scraping and notifications
- Dashboard with job listings and analytics
- Export functionality for job data
- Integration with multiple job boards

## Development Guidelines

### Critical Rules - Reference These With Every Request

1. **Thorough Analysis First**: Do not start making any changes until you are 95% sure about the implementation. Ask as many clarifying questions as needed to gain the necessary context required.

2. **System Coherence**: Prioritize creating a coherent system. The way components work together is important - consider how each piece fits into the overall architecture.

3. **Avoid Code Duplication**: Try not to duplicate code unnecessarily. Look for opportunities to create reusable components, hooks, and utilities.

4. **Incremental Development**: Stop periodically so that the developer can verify that changes work as expected before moving on to the next portion.

5. **README Maintenance**: Keep the README.md file up to date to show how to build, test and deploy the project. As the project changes, update the README.md to reflect those changes.

## Development Notes

- Uses Turbopack for faster development builds
- Font optimization with Geist Sans and Geist Mono
- Path aliases configured for clean imports (`@/components`, `@/lib`, etc.)
- Currently has default Next.js starter content that will be replaced
- The `frontend_requirements_doc.md` contains detailed specifications for the planned implementation
- Don't ever add the SERVICE_ROLE_KEY for supabase to the front end. that is too unsecure.