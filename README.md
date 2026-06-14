# PaperVest

PaperVest is a full-stack paper trading platform for US stocks.

It lets users search market data, manage a watchlist, place simulated trades with virtual funds, create conditional target-price orders, and track portfolio performance across web and mobile clients.

## What Is Implemented

### Authentication and account access

- user registration
- user login
- session refresh
- logout
- web cookie-based authenticated sessions
- mobile bearer-token authentication
- CSRF bootstrap for browser-based auth flows

### Market data

- market overview on the dashboard
- stock search
- stock detail pages
- quote display with market-session awareness
- historical price charts
- selectable history ranges

### Portfolio and trading

- portfolio summary
- holdings view
- simulated buy orders
- simulated sell orders
- trade history
- backend-managed balance and holdings updates
- market-closed trade protection
- idempotency-protected trade execution

### Watchlist

- add symbols to a watchlist
- remove symbols from a watchlist
- watchlist quote enrichment

### Conditional orders

- create conditional target-price orders
- list active and historical orders
- view order details
- cancel active orders
- backend polling for trigger conditions
- RabbitMQ-backed asynchronous execution
- structured failure reasons and status events

### Dashboard and post-login experience

- authenticated dashboard
- portfolio summary cards
- holdings preview
- watchlist preview
- recent activity preview
- market board
- stock search entry point

## Repository Structure

- `apps/web` - Next.js web client
- `apps/mobile` - Expo React Native mobile client
- `backend` - Spring Boot API, trading logic, auth, market data, portfolio, watchlist, and conditional-order services
- `packages/api-client` - shared typed API client
- `packages/shared-types` - shared DTO and response types
- `packages/validation` - shared validation schemas
- `packages/design-tokens` - shared design tokens

## Architecture Summary

PaperVest is built as a monorepo with one backend and two clients.

- the backend is the source of truth for authentication, market data integration, portfolio calculations, trade execution rules, holdings, and conditional orders
- the web and mobile apps share API contracts and validation rules, but keep separate UI implementations
- PostgreSQL stores users, accounts, holdings, trades, watchlist items, refresh tokens, and conditional-order data
- RabbitMQ is used to decouple conditional-order trigger detection from execution

## Tech Stack

- Next.js
- React
- TypeScript
- Expo React Native
- Java
- Spring Boot
- Spring Security
- PostgreSQL
- Flyway
- RabbitMQ
- Finnhub API
- pnpm workspaces
- Turborepo
- GitHub Actions

## Current Focus

This repository currently represents a production-minded paper trading system with working end-to-end flows across authentication, market data, watchlists, simulated trading, portfolio tracking, and conditional orders.
