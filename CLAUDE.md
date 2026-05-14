# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run dev      # Start development server with hot reload
npm run build    # Production build (electron-vite + electron-builder)
npm run lint     # ESLint check
npm test         # Run all tests (node --test with glob pattern)
```

## Architecture Overview

LMBridge is an Electron desktop application that provides an AI-powered chat and agent workflow interface.

### Process Model

The app uses a 3-process architecture:
- **Main process** (`electron/main.ts`): App lifecycle, window management, IPC registration
- **Preload** (`electron/preload.ts`): Secure context bridge exposing `window.electronAPI`
- **Renderer** (`src/renderer/`): React UI with two entry points: main chat (`index.html`) and settings (`settings.html`)

### UI Structure

```
App (src/renderer/App.tsx)
├── IconBar (navigation sidebar)
├── ChatWorkspace / SettingsWindow (switchable via IconBar)
│   ├── ChatSessionTimeline
│   ├── AgentWorkspace (when agent mode active)
│   └── RagWorkspace (RAG knowledge base)
```

### Core Systems

**Agent Runtime** (`electron/agent/runtime.ts`): Orchestrates task execution with:
- `TaskSessionManager` - maintains task state and loop messages
- `DefaultPlanner` - decides next action (tool call, skill use, script run, finish)
- `SkillRegistry` / `SkillExecutor` - loads and runs skills
- `ToolBroker` - routes MCP tool calls to external servers
- `ApprovalGate` - enforces permission policies for sensitive actions
- `HookRunner` - executes PreToolUse/PostToolUse hooks
- `CapabilityRouter` - resolves tool names to MCP server + tool

**Provider System** (`src/lib/providers/`): Abstracts LLM backends with a common interface. Supports:
- `LMStudioProvider` - local LM Studio
- `CustomProvider` - user-defined endpoints

**RAG Service** (`electron/rag/`): File-based knowledge base with:
- Text splitting, embeddings via LM Studio, vector storage
- IPC handler for file indexing and querying

**Web Search** (`electron/web-search/`): Service wrapping search providers

### IPC Communication

Main process registers handlers in `register*Ipc()` functions:
- `registerAgentIpc` - task lifecycle
- `registerChatIpc` - chat completion
- `registerRagIpc` - knowledge base
- `registerWebSearchIpc` - web search

Renderer accesses via `window.electronAPI.{agent,chat,rag,webSearch}`.

### State Management

Zustand stores in `src/lib/store/`:
- `useSettingsStore` - theme, provider config
- `useChatStore` - chat sessions, messages
- `useAgentStore` - agent state

### Design System

Custom Tailwind config with CSS variables for theming (`--background`, `--foreground`, `--primary`, etc.). Dark mode via `.dark` class on `html`. Animation utilities in `src/renderer/index.css` (`hover-lift`, `hover-scale`, `glass`, etc.).

### Key File Locations

| Purpose | Path |
|---------|------|
| Main process entry | `electron/main.ts` |
| Preload bridge | `electron/preload.ts` |
| Agent runtime | `electron/agent/runtime.ts` |
| IPC handlers | `electron/agent/ipc.ts`, `electron/chat-ipc.ts` |
| Provider abstraction | `src/lib/providers/index.ts` |
| UI components | `src/components/` |
| State stores | `src/lib/store/` |
| Renderer entry | `src/renderer/App.tsx` |