# Technology Stack & Build System

## Core Technologies
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Remix (React-based full-stack framework)
- **Database**: PostgreSQL with Prisma ORM
- **Frontend**: React 18 + Shopify Polaris UI components
- **Build Tool**: Vite with TypeScript paths support
- **Package Manager**: npm with workspaces for extensions

## Shopify Integration
- **Shopify App**: Built with `@shopify/shopify-app-remix`
- **UI Components**: Shopify Polaris design system
- **App Bridge**: `@shopify/app-bridge-react` for embedded app experience
- **Webhooks**: Configured for orders, fulfillments, refunds, and GDPR compliance
- **API Version**: 2025-01

## Testing Infrastructure
- **Unit Tests**: Vitest with separate config (`vitest.config.unit.ts`)
- **Integration Tests**: Vitest with database setup (`vitest.config.integration.ts`)
- **E2E Tests**: Playwright for browser automation
- **Coverage**: Vitest coverage with v8 provider
- **Mocking**: MSW (Mock Service Worker) for API mocking

## Development Tools
- **Linting**: ESLint with TypeScript, React, and accessibility rules
- **Code Quality**: Prettier for formatting
- **Type Checking**: TypeScript with strict mode enabled
- **Database Tools**: Prisma Studio for database inspection

## Common Commands

### Development
```bash
npm run dev              # Start Shopify app development server
npm run build           # Build for production
npm run start           # Start production server
npm run typecheck       # Run TypeScript compiler check
```

### Database Operations
```bash
npm run db:generate     # Generate Prisma client
npm run db:push         # Push schema changes to database
npm run db:migrate      # Run database migrations
npm run db:reset        # Reset database (destructive)
npm run db:studio       # Open Prisma Studio
```

### Testing
```bash
npm run test            # Run all tests in watch mode
npm run test:unit       # Run unit tests only
npm run test:integration # Run integration tests only
npm run test:e2e        # Run end-to-end tests
npm run test:ci         # Run all tests for CI (no watch)
npm run test:coverage   # Run tests with coverage report
```

### Code Quality
```bash
npm run lint            # Run ESLint
npm run lint:fix        # Fix ESLint issues automatically
```

### Shopify CLI
```bash
npm run config:link     # Link to Shopify app
npm run deploy          # Deploy to Shopify
npm run generate        # Generate Shopify app components
```

## Environment Setup
- Requires `.env` file with `DATABASE_URL` and Shopify app credentials
- Uses `.env.example` as template
- PostgreSQL database required for development
- Shopify development store needed for testing