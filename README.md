# HexAI AWP Connector

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/hexai.hexai-awp-connector)](https://marketplace.visualstudio.com/items?itemName=hexai.hexai-awp-connector)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/hexai.hexai-awp-connector)](https://marketplace.visualstudio.com/items?itemName=hexai.hexai-awp-connector)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Connect to **HexAI AWP** (Artificial Intelligence Workflow Platform) and execute AI-driven workflows directly from Visual Studio Code.

## Features

### Chat Interface
Execute workflows using a modern chat-like interface with intelligent autocomplete.

- Type `/workflow-` to see available workflows
- Execute with `/workflow-{id} {session-id}` syntax
- Real-time execution progress and results
- Connection status indicator

### Sidebar Integration
Browse and manage workflows from the VS Code Activity Bar.

- **Workflows Panel** - View all available workflow templates
- **Execution History** - Track recent workflow executions
- **Quick Actions** - Execute workflows with one click

### Smart Autocomplete
Get intelligent suggestions while typing workflow commands in any file.

- Automatic workflow discovery
- Session ID suggestions
- Parameter hints

### Real-time Monitoring
Track workflow execution with live updates.

- Status polling with progress notifications
- Event streaming in Output Panel
- Success/failure notifications

## Requirements

- Visual Studio Code 1.85.0 or higher
- Access to a HexAI AWP server
- Valid user credentials

## Installation

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for "HexAI AWP Connector"
4. Click **Install**

Or install from the command line:
```bash
code --install-extension hexai.hexai-awp-connector
```

## Quick Start

1. **Open Command Palette** (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. **Run** `HexAI: Connect to AWP Server`
3. **Enter** your server URL, username, and password
4. **Browse** workflows in the HexAI sidebar (Activity Bar)
5. **Execute** a workflow by clicking on it or using the chat panel

## Commands

| Command | Description |
|---------|-------------|
| `HexAI: Connect to AWP Server` | Authenticate and connect to HexAI server |
| `HexAI: Disconnect from AWP Server` | End the current session |
| `HexAI: Open Chat Panel` | Open the chat interface for workflow execution |
| `HexAI: List Available Workflows` | Show quick pick menu with workflows |
| `HexAI: Execute Workflow` | Execute a selected workflow |
| `HexAI: Refresh Workflows` | Refresh the workflow template list |
| `HexAI: Show Output Panel` | Display the HexAI output panel |

## Extension Settings

Configure the extension in VS Code Settings (`Ctrl+,` / `Cmd+,`):

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `hexai.serverUrl` | string | `http://localhost:8000` | HexAI AWP server URL |
| `hexai.username` | string | - | Default username for authentication |
| `hexai.autoConnect` | boolean | `false` | Automatically connect on startup |
| `hexai.cacheTimeout` | number | `300` | Workflow cache timeout (seconds) |

## Usage

### Using the Chat Panel

The chat panel provides the easiest way to execute workflows:

1. Open Command Palette and run `HexAI: Open Chat Panel`
2. Type a workflow command:
   ```
   /workflow-data-analysis session-001
   /workflow-report-generator report-2025
   /workflow-code-review pr-456
   ```
3. View real-time progress and results

### Using the Sidebar

1. Click the HexAI icon in the Activity Bar
2. Browse available workflows in the **Workflows** panel
3. Click a workflow to execute it
4. Enter the required session ID and parameters
5. Monitor progress in the **Execution History** panel

### Using Autocomplete

In any file, type `/workflow-` to trigger autocomplete suggestions with available workflows.

## Workflow Execution

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Select Workflow │ ──▶ │ Enter Session   │ ──▶ │ Add Parameters  │
└─────────────────┘     │ ID              │     │ (if required)   │
                        └─────────────────┘     └────────┬────────┘
                                                         │
┌─────────────────┐     ┌─────────────────┐     ┌────────▼────────┐
│ View Results    │ ◀── │ Monitor Status  │ ◀── │ Start Execution │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Troubleshooting

### Cannot Connect to Server

- Verify the server URL is correct in settings
- Ensure the HexAI AWP server is running
- Check your network connection and firewall settings
- Verify your credentials are correct

### Workflows Not Loading

- Click the refresh button in the Workflows panel
- Check if you have permission to view workflows
- Verify your authentication token hasn't expired

### Workflow Execution Fails

- Check the Output Panel for detailed error messages
- Verify the session ID format is correct
- Ensure all required parameters are provided
- Check server logs for backend errors

## Known Issues

- Auto-connect on startup is planned for a future release
- WebSocket support for real-time events is under development

## Release Notes

### 0.1.0 (2025-01-15)

Initial release:
- Server connection with JWT authentication
- Workflow browsing and execution
- Chat interface with autocomplete
- Execution history tracking
- Real-time status monitoring
- Output panel integration

See [CHANGELOG](CHANGELOG.md) for full release history.

## Contributing

We welcome contributions! Please see our [GitHub repository](https://github.com/hexaidev/hexai_vscode_plugin) for:

- Bug reports and feature requests
- Development setup instructions
- Contribution guidelines

## License

This extension is licensed under the [MIT License](LICENSE).

Copyright (c) 2025 HexAI

## Support

- **Issues**: [GitHub Issues](https://github.com/hexaidev/hexai_vscode_plugin/issues)
- **Documentation**: [HexAI Documentation](https://docs.hexai.dev)
- **Website**: [hexai.dev](https://hexai.dev)

---

**Enjoy automating with HexAI!**
