# Changelog

All notable changes to the HexAI AWP Connector extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-01-15

### Added

- **Authentication**: Connect to HexAI AWP server with username/password (JWT-based)
- **Workflow Browser**: View available workflow templates in the sidebar
- **Chat Interface**: Execute workflows using `/workflow-{id} {session-id}` commands
- **Autocomplete**: Smart suggestions for workflow commands in any file
- **Execution History**: Track and review recent workflow executions
- **Real-time Monitoring**: Status polling with progress notifications
- **Output Panel**: View workflow execution events and results
- **Status Bar**: Connection state indicator
- **Configuration**: Settings for server URL, username, and cache timeout

### UI Components

- Activity Bar icon for quick access
- Workflows TreeView panel
- Execution History TreeView panel
- Chat webview panel
- Dedicated output channel

## [Unreleased]

### Planned

- Secure credential storage using VS Code SecretStorage API
- Auto-connect on VS Code startup
- Workflow favorites and pinning
- Cancel running workflows
- WebSocket support for real-time event streaming
- Workflow input schema validation
- Multiple server profile support
- Keyboard shortcuts for common actions
