# Beautiful Tips Calculator

A modern tip calculator built with Next.js 15 and React 19. Features OCR-powered receipt scanning, bill splitting, and customizable rounding options.

## Features

### Core Functionality
- Calculate tips with preset percentages (10%, 15%, 18%, 20%, 25%) or custom amounts
- Split bills among multiple people with per-person calculations
- Three rounding modes: none, round up, or round down
- Copy calculation summary to clipboard

### Receipt Scanner
- Extract bill amounts from receipt photos using OCR
- Upload from gallery or capture with device camera
- Intelligent amount detection prioritizing totals over subtotals
- Supports multiple currency formats (USD, EUR, GBP, and others)
- Handles both US (1,234.56) and European (1.234,56) number formats
- Shows all detected amounts with context for manual selection

### User Interface
- Dark mode with persistent preference storage
- Smooth animations powered by Framer Motion
- Responsive design for mobile, tablet, and desktop
- Progressive Web App support for installation on mobile devices

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **React**: React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom design tokens
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **OCR**: Tesseract.js
- **UI Architecture**: shadcn/ui component patterns

## Getting Started

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd beautiful-tips-calculator

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Available Commands

```bash
npm run dev      # Start development server with Turbopack
npm run build    # Create production build
npm run start    # Start production server
npm run lint     # Run ESLint checks
```

## Project Structure

```
beautiful-tips-calculator/
├── app/
│   ├── layout.tsx           # Root layout with fonts and metadata
│   └── page.tsx             # Home page
├── components/
│   ├── tip-calculator.tsx   # Main calculator component
│   └── receipt-scanner.tsx  # OCR receipt scanning
├── lib/
│   └── utils.ts             # Utility functions
├── public/
│   ├── manifest.json        # PWA manifest
│   └── *.svg                # Static assets
├── tailwind.config.ts       # Tailwind configuration
├── tsconfig.json            # TypeScript configuration
└── next.config.ts           # Next.js configuration
```

## Technical Details

### Architecture
- Uses Next.js App Router for routing
- Client-side components marked with `"use client"` directive
- State management via React hooks (useState, useEffect)
- Persistent preferences stored in localStorage
- Full TypeScript coverage with strict mode

### Styling System
- Tailwind CSS with utility-first approach
- HSL-based CSS variables for theming
- Class-based dark mode (`"darkMode": ["class"]`)
- Custom design tokens configured in `tailwind.config.ts`

### Receipt Scanner Implementation
The scanner uses Tesseract.js for OCR with the following features:
- Adaptive image preprocessing for better accuracy
- Pattern matching for common receipt formats
- Excludes subtotals and focuses on final totals
- Supports multiple currency symbols and formats
- Configurable confidence thresholds

### Rounding Modes
- **None**: Displays exact calculated amounts
- **Round Up**: Rounds each person's share up to nearest dollar
- **Round Down**: Rounds each person's share down to nearest dollar

Note: When rounding is applied, the tip amount is recalculated based on the rounded total.

## Deployment

### Vercel (Recommended)
Deploy directly to Vercel:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Or use the [Vercel dashboard](https://vercel.com/new) to import the repository.

### Other Platforms
This is a standard Next.js application compatible with:
- Netlify
- AWS Amplify
- Cloudflare Pages
- Docker containers
- Self-hosted Node.js servers

Refer to [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for platform-specific instructions.

## Progressive Web App

The application includes a `manifest.json` for PWA functionality. Users can install it on mobile devices for offline access and a native app experience.

## Development Guidelines

Before committing:
1. Run `npm run lint` to check for code quality issues
2. Run `npm run build` to verify the production build succeeds
3. Ensure TypeScript compilation passes without errors

## License

MIT

## Credits

Built with Next.js, React, TypeScript, Tailwind CSS, Framer Motion, and Tesseract.js.
