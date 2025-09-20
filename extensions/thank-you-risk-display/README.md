# ReturnsX Thank You Page Extension

A Shopify checkout UI extension that displays customer risk assessment information on the order confirmation page.

## Overview

This extension integrates with ReturnsX's risk scoring API to provide real-time customer risk information on the Thank You page after checkout completion. It helps merchants understand customer reliability and provides customers with transparency about their delivery success profile.

## Features

- Real-time risk assessment display
- Mobile-responsive design
- WhatsApp integration for high-risk customers
- Configurable through Shopify theme customizer
- Comprehensive error handling and fallback states
- Privacy-first design with data hashing

## Extension Point

- **Target**: `purchase.thank-you.block.render`
- **Compatibility**: All payment methods including COD

## Configuration

The extension can be configured through Shopify's theme customizer with the following settings:

- API endpoint configuration
- Debug mode toggle
- Custom messages for different risk tiers
- WhatsApp integration settings
- Display preferences (colors, compact mode, etc.)

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Type checking
npm run typecheck
```

## Requirements

- Node.js 18+
- Shopify CLI
- ReturnsX API access
- Shopify development store

## File Structure

```
src/
├── Checkout.tsx          # Main extension entry point
├── types/               # TypeScript type definitions
├── components/          # React components (to be implemented)
├── services/           # API client and utilities (to be implemented)
└── utils/              # Helper functions (to be implemented)
```

## Implementation Status

- [x] Project structure and configuration
- [ ] Core extension components
- [ ] API client integration
- [ ] UI components
- [ ] Error handling
- [ ] Testing suite

## Privacy & Security

- Customer data is hashed before API transmission
- No raw PII is stored or transmitted
- HTTPS encryption for all API calls
- Secure token-based authentication