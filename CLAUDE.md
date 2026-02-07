# CLAUDE.md

This file provides guidance for AI coding agents (Claude Code and OpenCode-compatible workflows) when working in this repository.

## Essential Commands

```bash
# Development
npm run dev          # Start development server with turbopack
npm run build        # Create production build
npm run start        # Start production server
npm run lint         # Run ESLint checks
npm run test         # Run Vitest unit tests
```

## Validation Workflow

- Run `npm run test` after logic changes (especially OCR parsing/extraction)
- Run `npm run lint` before finishing a task
- Run `npm run build` before finishing a task (also validates TypeScript)
- There is no standalone `typecheck` script yet; `npm run build` is the canonical typecheck gate

## Agent Compatibility Notes

- OpenCode can consume `CLAUDE.md` directly as compatibility guidance.
- If `AGENTS.md` is added later, keep this file and `AGENTS.md` aligned to avoid conflicting instructions.

## Project Architecture

This is a **Next.js 15** tip calculator app with **App Router** architecture. The application features:

### Core Structure
- **App Router**: Uses Next.js App Router (`app/` directory) instead of Pages Router
- **TypeScript**: Fully typed codebase with strict TypeScript configuration
- **Component Architecture**: Two main functional components with clear separation of concerns

### Key Components
- `components/tip-calculator.tsx` - Main calculator UI with state management
- `components/receipt-scanner.tsx` - OCR-powered receipt scanning using Tesseract.js

### OCR Utility Layer
- `lib/number-utils.ts` - Shared receipt parsing helpers for OCR amount extraction, locale-aware currency parsing, amount categorization, and total relationship validation

### Technology Stack
- **UI Framework**: Next.js 15 with React 19
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **Animations**: Framer Motion for micro-interactions
- **Icons**: Lucide React icon library
- **OCR**: Tesseract.js for client-side receipt text extraction
- **Design System**: shadcn/ui components (configured in `components.json`)

### State Management Patterns
- Uses React hooks (`useState`, `useEffect`) for local state
- localStorage persistence for user preferences (dark mode, rounding settings)
- No global state management - all state is component-local

### Styling Approach
- **Tailwind CSS**: Utility-first styling with custom design tokens
- **CSS Variables**: Theme colors defined as HSL CSS variables
- **Dark Mode**: Class-based dark mode toggle (`"darkMode": ["class"]`)
- **Responsive Design**: Mobile-first responsive layouts

### Path Aliases
- `@/*` maps to project root (configured in `tsconfig.json`)
- Import components as `@/components/component-name`
- Utilities available at `@/lib/utils`

### Development Notes
- Uses Turbopack for faster development builds (`--turbopack` flag)
- Geist font family loaded via `next/font/google`
- PWA-ready with `manifest.json` configured
- Client-side image processing (no server uploads for OCR)

### Code Conventions
- Use `"use client"` directive for components needing browser APIs
- Prefer `const` for component definitions
- Use TypeScript interfaces for props and complex data structures
- Follow Next.js App Router conventions for file naming and structure
- Remember at the end of each request run test, lint, and build to make sure there is no error

## Testing

- Unit tests live in `tests/`
- Current OCR-focused tests are in `tests/number-utils.test.ts`
- Prefer table-driven tests for receipt parsing edge cases (number formats, subtotal/tax/total relationships, payment-line false positives)
