# Project Structure & Organization

## Root Directory Layout
```
├── app/                    # Main application code (Remix convention)
├── extensions/             # Shopify app extensions (checkout UI, etc.)
├── prisma/                 # Database schema and migrations
├── tests/                  # Test files organized by type
├── public/                 # Static assets
├── build/                  # Production build output
├── docs/                   # Documentation files
└── node_modules/           # Dependencies
```

## App Directory Structure (`app/`)
Following Remix file-based routing conventions:

```
app/
├── routes/                 # Route handlers and pages
│   ├── _index/            # Landing page
│   ├── app.tsx            # Authenticated app layout
│   ├── app._index.tsx     # Dashboard home
│   ├── app.customers.tsx  # Customer management
│   ├── app.analytics.tsx  # Analytics dashboard
│   ├── app.settings.tsx   # Configuration
│   ├── api/               # API endpoints
│   └── webhooks/          # Webhook handlers
├── services/              # Business logic and external integrations
├── utils/                 # Shared utilities and helpers
├── middleware/            # Request/response middleware
├── root.tsx              # Root layout component
├── entry.server.tsx      # Server entry point
└── shopify.server.ts     # Shopify app configuration
```

## Database Structure (`prisma/`)
```
prisma/
├── schema.prisma         # Database schema definition
├── migrations/           # Database migration files
└── dev.sqlite           # Development database (if using SQLite)
```

## Testing Structure (`tests/`)
```
tests/
├── unit/                # Unit tests for individual functions
├── integration/         # Integration tests with database
├── e2e/                # End-to-end browser tests
└── setup/              # Test configuration and helpers
```

## Extensions Structure (`extensions/`)
Shopify app extensions using workspace pattern:
```
extensions/
├── order-status-risk-display/  # Checkout UI extension
└── .gitkeep                   # Placeholder for future extensions
```

## Key Configuration Files
- `package.json` - Dependencies and npm scripts
- `shopify.app.toml` - Shopify app configuration
- `tsconfig.json` - TypeScript configuration
- `vite.config.ts` - Build tool configuration
- `playwright.config.ts` - E2E test configuration
- `vitest.config.*.ts` - Test configurations for different test types

## Naming Conventions
- **Files**: kebab-case for routes (`app.customers.tsx`)
- **Components**: PascalCase for React components
- **Database**: snake_case for table and column names
- **API Routes**: RESTful naming (`/api/customer-profiles/:phone`)
- **Webhooks**: Shopify topic naming (`/webhooks/orders/created`)

## Import Patterns
- Use TypeScript path mapping for clean imports
- Prefer named exports over default exports
- Group imports: external libraries, internal modules, relative imports
- Use `~/` prefix for app-relative imports (configured in tsconfig)

## Code Organization Principles
- **Route-based**: Each route file contains its loader, action, and component
- **Service Layer**: Business logic separated from route handlers
- **Utility Functions**: Shared code in `app/utils/`
- **Type Safety**: Comprehensive TypeScript usage throughout
- **Privacy by Design**: Customer data hashing in service layer