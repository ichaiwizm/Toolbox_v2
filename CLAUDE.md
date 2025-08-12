# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Toolbox is a fullstack application with a React frontend and Node.js Express backend that provides file operation tools, particularly useful for preparing data for LLMs like ChatGPT or Claude. Currently, only the advanced copy tool is fully implemented.

## Tech Stack

- **Frontend**: React 19 with TypeScript, Vite, TailwindCSS, shadcn/ui components
- **Backend**: Node.js Express, Joi for validation
- **State Management**: React Context API (ThemeContext, TabsContext)

## Commands

### Development
```bash
# Start both frontend and backend (from frontend directory)
cd frontend
npm run dev

# Start frontend only
cd frontend
npm run frontend

# Start backend only
cd frontend
npm run backend

# Start backend with debug logging
cd frontend
npm run backend-debug
```

### Testing
```bash
# Run backend tests
cd backend-node
npm test
```

### Build & Lint
```bash
# Build frontend
cd frontend
npm run build

# Lint frontend
cd frontend
npm run lint
```

## Architecture

### Backend Structure
- **Main entry**: `backend-node/src/app.js` - Configures Express app with logging, middleware, and routes
- **Configuration**: `backend-node/src/config.js` - Environment variables and app configuration
- **Routes**: `backend-node/src/routes/` - Each tool has its own router module (copy.js, analyse.js, etc.)
- **Utils**: `backend-node/src/utils/` - Shared utilities (file-utils.js, path-utils.js, logger.js)

### Frontend Structure
- **Entry**: `frontend/src/main.tsx` → `App.tsx`
- **Layout**: `frontend/src/components/layout/` - Main layout with tab navigation
- **Tools**: `frontend/src/components/tools/` - Each tool has its own component
- **UI Components**: `frontend/src/components/ui/` - Reusable shadcn/ui components
- **Contexts**: `frontend/src/contexts/` - Theme and tabs state management

### API Endpoints
All API routes are prefixed with `/api/v1/`:
- `/copy/advanced/scan` - Scan files based on criteria
- `/copy/advanced/format-content` - Format file contents for copying
- `/copy/health` - Health check endpoint

Other tool endpoints follow the same pattern but are not yet implemented.

## Development Notes

### Logging
Backend logging level is controlled via the `TOOLBOX_LOG_LEVEL` environment variable (default: WARNING). Set to DEBUG for detailed logs. The Node.js backend uses a custom logger with colored console output.

### CORS
Currently configured to allow all origins (`*`). Update for production deployment.

### File Operations
The copy tool includes sophisticated path sanitization and error handling. Key utilities:
- `sanitizePath()` - Cleans and validates file paths
- `scanDirectory()` - Recursively scans with exclusion rules
- `formatFileForCopy()` - Formats file content for clipboard

### Current Status
Only the copy tool is fully functional. Other tools (analyse, WinMerge, duplicate detection, AI structure) have placeholder routes but no implementation. The backup tool was excluded from the Node.js migration.