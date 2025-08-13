# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RightsGuard is a desktop application for automated copyright infringement appeals on Bilibili. Built with Next.js + Tauri architecture, it provides a modern desktop experience for managing copyright protection workflows.

## Development Commands

### Frontend (Next.js)
- `npm run dev` - Start Next.js development server
- `npm run build` - Build frontend static files (outputs to `out/` directory)
- `npm run lint` - Run ESLint for code quality checks

### Backend (Tauri)
- `npm run dev:tauri` - Run Tauri development mode (Rust backend + Next.js frontend)
- `npm run build:tauri` - Build complete desktop application (runs `npm run build` first, then builds Rust backend)

### Database
- `npm run db:push` - Push Prisma schema changes to database
- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Run database migrations
- `npm run db:reset` - Reset database

### Testing
Check the project for test scripts - none are currently defined in package.json.

## Architecture

### Technology Stack
- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS + shadcn/ui components
- **Backend**: Rust + Tauri framework for desktop functionality
- **Database**: SQLite with SQLx for async operations
- **Automation**: Playwright for browser automation
- **UI Library**: Extensive use of Radix UI components via shadcn/ui

### Key Directories
- `src/` - Next.js frontend source code
  - `app/` - Next.js 15 App Router pages
  - `components/` - React components (pages/ and ui/ subdirectories)
  - `hooks/` - Custom React hooks including Tauri integration
  - `lib/` - Utility libraries and Tauri API client
- `src-tauri/` - Rust backend source code
  - `src/main.rs` - Application entry point with system tray setup
  - `src/commands.rs` - Tauri command handlers for frontend-backend communication
  - `src/automation.rs` - Playwright-based browser automation logic
  - `src/database.rs` - SQLite database operations using SQLx
  - `src/models.rs` - Data models and type definitions

### Core Architecture Patterns

**Frontend-Backend Communication**: Uses Tauri's invoke system through a centralized API client (`src/lib/tauri-api.ts`). This client provides environment detection - full Tauri functionality in desktop mode, mock data for web development.

**Database Layer**: SQLite database with async operations via SQLx. All database operations are centralized in `src-tauri/src/database.rs`.

**Browser Automation**: Playwright integration for automating copyright appeal workflows. Automation state is managed globally using Arc<Mutex<AutomationStatus>>.

**System Integration**: 
- System tray functionality with show/hide/quit options
- File system access for document management (identity cards, copyright proofs)
- Cross-platform desktop application with window management

### Data Models
- **Profile**: Personal information for copyright appeals (name, phone, email, ID documents)
- **IpAsset**: Intellectual property assets (work name, type, ownership, rights period)
- **Case**: Copyright infringement cases (URLs, associated IP assets, status)
- **AutomationStatus**: Real-time status of automated appeal processes

## Development Workflow

### Environment Detection
The application automatically detects its running environment:
- **Desktop mode**: Full Tauri functionality with real database operations
- **Web mode**: Mock data and alerts for development/demo purposes

### Building for Production
1. Build frontend: `npm run build` (generates `out/` static files)
2. Build desktop app: `npm run build:tauri` (creates platform-specific executables)

### Key Integration Points
- Frontend communicates with backend exclusively through `tauriAPI` singleton
- All file operations go through Tauri's secure file system APIs
- Database operations are async and use proper error handling
- Automation processes run in background tasks with status monitoring

## Security Considerations
- Content Security Policy configured in `tauri.conf.json`
- File system access is controlled through Tauri's allowlist system
- Local SQLite database for privacy (no external data transmission)
- Secure file handling for sensitive documents (ID cards, copyright proofs)