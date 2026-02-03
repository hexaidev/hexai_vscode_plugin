import * as vscode from 'vscode';
import { ConnectionManager } from './services/connection-manager';
import { TemplateCache } from './services/template-cache';
import { OutputManager } from './services/output-manager';
import { TemplateTreeProvider, HistoryTreeProvider } from './providers/template-tree';
import { StatusBarProvider } from './providers/status-bar';
import { executeWorkflowCommand } from './commands/execute-workflow';
import { Logger } from './utils/logger';
import { isValidUrl, parseWorkflowCommand } from './utils/validation';

let statusBarProvider: StatusBarProvider | undefined;
let outputManager: OutputManager | undefined;
let templateCache: TemplateCache;
let treeProvider: TemplateTreeProvider | undefined;
let historyProvider: HistoryTreeProvider | undefined;
let chatViewProvider: HexAIChatViewProvider | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('HexAI AWP Connector: Starting activation...');

  try {
    // Wrap entire activation in try-catch to capture errors
    await doActivate(context);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('HexAI AWP Connector: ACTIVATION FAILED:', error);
    vscode.window.showErrorMessage(`HexAI extension failed to activate: ${errorMsg}`);
    throw error;
  }
}

async function doActivate(context: vscode.ExtensionContext): Promise<void> {
  try {
    Logger.initialize(true);
    Logger.info('HexAI AWP Connector is now active');
  } catch (e) {
    console.error('HexAI: Failed to initialize logger:', e);
  }

  // Core services - these must succeed
  const connectionManager = ConnectionManager.getInstance();
  const config = vscode.workspace.getConfiguration('hexai');
  const cacheTimeout = config.get<number>('cacheTimeout', 300);
  templateCache = new TemplateCache(cacheTimeout);

  // ============================================
  // REGISTER COMMANDS FIRST - This is critical!
  // ============================================

  console.log('HexAI AWP Connector: Registering commands...');

  // Connect command
  const connectCmd = vscode.commands.registerCommand('hexai.connect', async () => {
    const storedUrl = config.get<string>('serverUrl', 'http://localhost:8000');
    const storedUsername = config.get<string>('username', '');

    const serverUrl = await vscode.window.showInputBox({
      prompt: 'Enter HexAI AWP Server URL',
      value: storedUrl,
      placeHolder: 'http://localhost:8000',
      validateInput: (input) => {
        if (!input) return 'Server URL is required';
        if (!isValidUrl(input)) return 'Please enter a valid URL (http:// or https://)';
        return null;
      }
    });
    if (!serverUrl) return;

    const username = await vscode.window.showInputBox({
      prompt: 'Enter your username',
      value: storedUsername,
      validateInput: (input) => (!input?.trim()) ? 'Username is required' : null
    });
    if (!username) return;

    const password = await vscode.window.showInputBox({
      prompt: 'Enter your password',
      password: true,
      validateInput: (input) => (!input?.trim()) ? 'Password is required' : null
    });
    if (!password) return;

    try {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Connecting to HexAI...', cancellable: false },
        async () => {
          await connectionManager.connect({ serverUrl, username, password });
          await config.update('serverUrl', serverUrl, true);
          await config.update('username', username, true);
          const client = connectionManager.getClient();
          const templates = await client.getTemplates(true);
          templateCache.setTemplates(templates);
          treeProvider?.refresh();
          historyProvider?.refresh();
          chatViewProvider?.refresh();
        }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('HexAI connect command error:', error);

      // Show user-friendly error with option to see details
      const action = await vscode.window.showErrorMessage(
        `Failed to connect: ${errorMessage}`,
        'Show Output'
      );
      if (action === 'Show Output') {
        vscode.commands.executeCommand('hexai.showOutput');
      }
    }
  });

  // Disconnect command
  const disconnectCmd = vscode.commands.registerCommand('hexai.disconnect', () => {
    connectionManager.disconnect();
    templateCache.clear();
    treeProvider?.refresh();
    historyProvider?.refresh();
    chatViewProvider?.refresh();
    vscode.window.showInformationMessage('Disconnected from HexAI');
  });

  // List workflows command
  const listWorkflowsCmd = vscode.commands.registerCommand('hexai.listWorkflows', async () => {
    if (!connectionManager.isConnected()) {
      const action = await vscode.window.showErrorMessage('Not connected to HexAI', 'Connect Now');
      if (action === 'Connect Now') await vscode.commands.executeCommand('hexai.connect');
      return;
    }

    if (templateCache.isStale()) {
      try {
        const templates = await connectionManager.getClient().getTemplates(true);
        templateCache.setTemplates(templates);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to refresh: ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
    }

    const templates = templateCache.getTemplates();
    const items = templates.map(t => ({
      label: `$(play) ${t.name}`,
      description: t.workflow_id,
      detail: t.description || 'No description',
      templateId: t.id
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a workflow to execute',
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (selected && outputManager) {
      await executeWorkflowCommand(templateCache, outputManager, selected.templateId);
    }
  });

  // Execute workflow command
  const executeWorkflowCmd = vscode.commands.registerCommand('hexai.executeWorkflow',
    (templateId?: string, sessionId?: string) => {
      if (outputManager) {
        return executeWorkflowCommand(templateCache, outputManager, templateId, sessionId);
      }
    }
  );

  // Refresh templates command
  const refreshTemplatesCmd = vscode.commands.registerCommand('hexai.refreshTemplates', async () => {
    if (!connectionManager.isConnected()) {
      const action = await vscode.window.showWarningMessage('Not connected to HexAI', 'Connect Now');
      if (action === 'Connect Now') await vscode.commands.executeCommand('hexai.connect');
      return;
    }

    try {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Refreshing workflows...', cancellable: false },
        async () => {
          const templates = await connectionManager.getClient().getTemplates(true);
          templateCache.setTemplates(templates);
          treeProvider?.refresh();
          historyProvider?.refresh();
          chatViewProvider?.refresh();
        }
      );
      vscode.window.showInformationMessage(`Loaded ${templateCache.getTemplates().length} workflow(s)`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to refresh: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // Show output panel command
  const showOutputCmd = vscode.commands.registerCommand('hexai.showOutput', () => {
    outputManager?.show();
  });

  // Open chat view command (focuses the sidebar chat view)
  const openChatCmd = vscode.commands.registerCommand('hexai.openChat', () => {
    vscode.commands.executeCommand('hexai.chatView.focus');
  });

  // Add all commands to subscriptions
  context.subscriptions.push(
    connectCmd,
    disconnectCmd,
    listWorkflowsCmd,
    executeWorkflowCmd,
    refreshTemplatesCmd,
    showOutputCmd,
    openChatCmd
  );

  console.log('HexAI AWP Connector: Commands registered successfully');

  // ============================================
  // Initialize optional UI components
  // ============================================

  try {
    outputManager = new OutputManager();
    context.subscriptions.push({ dispose: () => outputManager?.dispose() });
  } catch (e) {
    console.error('HexAI: Failed to create OutputManager:', e);
  }

  try {
    statusBarProvider = new StatusBarProvider();
    context.subscriptions.push({ dispose: () => statusBarProvider?.dispose() });
  } catch (e) {
    console.error('HexAI: Failed to create StatusBarProvider:', e);
  }

  try {
    treeProvider = new TemplateTreeProvider(templateCache);
    historyProvider = new HistoryTreeProvider();
    vscode.window.registerTreeDataProvider('hexai.workflowsView', treeProvider);
    vscode.window.registerTreeDataProvider('hexai.historyView', historyProvider);
  } catch (e) {
    console.error('HexAI: Failed to create tree providers:', e);
  }

  // Register chat webview view provider
  try {
    chatViewProvider = new HexAIChatViewProvider(context.extensionUri, templateCache, connectionManager);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(HexAIChatViewProvider.viewType, chatViewProvider)
    );
  } catch (e) {
    console.error('HexAI: Failed to create chat view provider:', e);
  }

  // Listen for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('hexai.cacheTimeout')) {
        const newTimeout = vscode.workspace.getConfiguration('hexai').get<number>('cacheTimeout', 300);
        Logger.info(`Cache timeout changed to ${newTimeout}s`);
      }
    })
  );

  console.log('HexAI AWP Connector: Activation complete');
  Logger.info('HexAI AWP Connector activation complete');

  // Show success notification
  vscode.window.showInformationMessage('HexAI AWP Connector activated successfully!');
}

export function deactivate(): void {
  Logger.info('HexAI AWP Connector is deactivating');
  ConnectionManager.getInstance().disconnect();
  Logger.dispose();
}

// ============================================
// Chat View Provider - Sidebar webview
// ============================================

class HexAIChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'hexai.chatView';
  private _view?: vscode.WebviewView;
  private readonly _extensionUri: vscode.Uri;
  private readonly _templateCache: TemplateCache;
  private readonly _connectionManager: ConnectionManager;

  constructor(
    extensionUri: vscode.Uri,
    templateCache: TemplateCache,
    connectionManager: ConnectionManager
  ) {
    this._extensionUri = extensionUri;
    this._templateCache = templateCache;
    this._connectionManager = connectionManager;
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    /* eslint-enable @typescript-eslint/no-unused-vars */
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlContent();

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'executeWorkflow':
          await this._executeWorkflow(message.workflowId, message.sessionId);
          break;
        case 'connect':
          await vscode.commands.executeCommand('hexai.connect');
          this.refresh();
          break;
        case 'refresh':
          this.refresh();
          break;
        case 'parseCommand':
          await this._parseAndExecute(message.text);
          break;
        case 'getWorkflows':
          this._postMessage({
            type: 'workflowsUpdate',
            content: '',
            workflows: this._templateCache.getTemplates().map(t => ({
              id: t.id,
              workflowId: t.workflow_id,
              name: t.name,
              description: t.description || '',
              tools: t.tools || []
            }))
          });
          break;
      }
    });
  }

  public refresh(): void {
    if (this._view) {
      this._view.webview.html = this._getHtmlContent();
    }
  }

  private async _parseAndExecute(text: string): Promise<void> {
    const parsed = parseWorkflowCommand(text);

    if (!parsed) {
      this._postMessage({
        type: 'response',
        content: `Invalid command format. Use: /workflow-{id} {session_id}\n\nExample: /workflow-data-analysis session-001`
      });
      return;
    }

    if (!this._connectionManager.isConnected()) {
      this._postMessage({
        type: 'response',
        content: 'Not connected to HexAI server. Click "Connect" to connect first.'
      });
      return;
    }

    const template = this._templateCache.findByWorkflowId(parsed.workflowId);
    if (!template) {
      const available = this._templateCache.getTemplates().map(t => t.workflow_id).join(', ');
      this._postMessage({
        type: 'response',
        content: `Workflow "${parsed.workflowId}" not found.\n\nAvailable workflows: ${available || 'None (try refreshing)'}`
      });
      return;
    }

    const sessionId = parsed.parameters['_positional'] || parsed.parameters['issueId'];
    if (!sessionId) {
      this._postMessage({
        type: 'response',
        content: `Please provide a session ID.\n\nUsage: /workflow-${parsed.workflowId} {session_id}`
      });
      return;
    }

    await this._executeWorkflow(template.id, sessionId);
  }

  private async _executeWorkflow(templateId: string, sessionId: string): Promise<void> {
    const template = this._templateCache.getTemplate(templateId);
    if (!template) {
      this._postMessage({ type: 'error', content: 'Template not found' });
      return;
    }

    this._postMessage({
      type: 'status',
      content: `Starting workflow: ${template.name}\nSession: ${sessionId}`
    });

    try {
      const client = this._connectionManager.getClient();
      const execution = await client.createWorkflow({
        workflow_template_id: templateId,
        session_id: sessionId
      });

      this._postMessage({
        type: 'status',
        content: `Workflow started!\nID: ${execution.id}\nStatus: ${execution.status}`
      });

      // Poll for status updates
      await this._pollWorkflowStatus(execution.id);
    } catch (error) {
      this._postMessage({
        type: 'error',
        content: `Failed to execute: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  private async _pollWorkflowStatus(workflowId: string): Promise<void> {
    const terminalStatuses = ['completed', 'failed', 'cancelled'];
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes max

    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 2000));
      attempts++;

      try {
        const client = this._connectionManager.getClient();
        const status = await client.getWorkflow(workflowId);

        this._postMessage({
          type: 'status',
          content: `Status: ${status.status}${status.result_summary ? '\n\n' + status.result_summary : ''}`
        });

        if (terminalStatuses.includes(status.status)) {
          if (status.status === 'completed') {
            this._postMessage({
              type: 'success',
              content: `Workflow completed successfully!\n\n${status.result_summary || ''}`
            });
          } else {
            this._postMessage({
              type: 'error',
              content: `Workflow ${status.status}: ${status.error || 'Unknown error'}`
            });
          }
          // Refresh history after completion
          historyProvider?.refresh();
          return;
        }
      } catch (error) {
        console.error('Failed to poll workflow status:', error);
      }
    }

    this._postMessage({
      type: 'warning',
      content: 'Workflow is still running. Check the Execution History for updates.'
    });
  }

  private _postMessage(message: { type: string; content: string; workflows?: unknown[] }): void {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }

  private _getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  private _getHtmlContent(): string {
    const nonce = this._getNonce();
    const isConnected = this._connectionManager.isConnected();
    const user = this._connectionManager.getUserInfo();

    // Prepare workflow data for autocomplete
    const workflows = this._templateCache.getTemplates().map(t => ({
      id: t.id,
      workflowId: t.workflow_id,
      name: t.name,
      description: t.description || '',
      tools: t.tools || []
    }));
    const workflowsJson = JSON.stringify(workflows);

    return `<!DOCTYPE html>
<!-- Generated: ${new Date().toISOString()} -->
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>HexAI Workflows Chat</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background-color: var(--vscode-sideBar-background);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: visible;
    }
    .header {
      padding: 8px 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
    }
    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background-color: ${isConnected ? '#4caf50' : '#f44336'};
    }
    .chat-container {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
      min-height: 150px;
    }
    .message {
      margin-bottom: 8px;
      padding: 8px;
      border-radius: 6px;
      background-color: var(--vscode-input-background);
      font-size: 12px;
    }
    .message.user {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      margin-left: 15%;
    }
    .message.assistant {
      background-color: var(--vscode-input-background);
      margin-right: 15%;
    }
    .message.error {
      border-left: 3px solid #f44336;
    }
    .message.success {
      border-left: 3px solid #4caf50;
    }
    .message.status {
      border-left: 3px solid var(--vscode-button-background);
      font-size: 11px;
      opacity: 0.8;
    }
    .input-container {
      padding: 8px;
      border-top: 1px solid var(--vscode-panel-border);
      display: flex;
      flex-direction: column;
      gap: 6px;
      overflow: visible;
    }
    .input-row {
      display: flex;
      gap: 4px;
      position: relative;
      overflow: visible;
    }
    #chat-input {
      flex: 1;
      padding: 6px 8px;
      border: 1px solid var(--vscode-input-border);
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border-radius: 4px;
      font-family: inherit;
      font-size: 12px;
    }
    #chat-input:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }
    #chat-input::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }
    button {
      padding: 6px 10px;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }
    button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    button.secondary {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .actions {
      display: flex;
      gap: 4px;
    }
    pre {
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    /* Autocomplete styles - inline below chat, above input */
    .autocomplete-container {
      margin: 4px 0;
      max-height: 150px;
      background-color: var(--vscode-dropdown-background, #252526);
      border: 1px solid var(--vscode-dropdown-border, #454545);
      border-radius: 6px;
      overflow: hidden;
    }
    .autocomplete-header {
      padding: 6px 8px;
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      background-color: var(--vscode-dropdown-background);
      border-bottom: 1px solid var(--vscode-dropdown-border);
    }
    .autocomplete-list {
      list-style: none;
      margin: 0;
      padding: 0;
      max-height: 200px;
      overflow-y: auto;
    }
    .autocomplete-item {
      padding: 8px 10px;
      cursor: pointer;
      border-bottom: 1px solid var(--vscode-dropdown-border);
    }
    .autocomplete-item:last-child {
      border-bottom: none;
    }
    .autocomplete-item:hover {
      background-color: var(--vscode-list-hoverBackground);
    }
    .autocomplete-item.selected {
      background-color: var(--vscode-list-activeSelectionBackground);
      color: var(--vscode-list-activeSelectionForeground);
    }
    .autocomplete-item-name {
      font-weight: 500;
      margin-bottom: 2px;
    }
    .autocomplete-item-id {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      font-family: var(--vscode-editor-font-family), monospace;
    }
    .autocomplete-item.selected .autocomplete-item-id {
      color: var(--vscode-list-activeSelectionForeground);
      opacity: 0.8;
    }
    .autocomplete-item-desc {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .autocomplete-item.selected .autocomplete-item-desc {
      color: var(--vscode-list-activeSelectionForeground);
      opacity: 0.8;
    }
    .autocomplete-item-tools {
      font-size: 10px;
      color: var(--vscode-badge-foreground);
      background-color: var(--vscode-badge-background);
      padding: 1px 4px;
      border-radius: 3px;
      display: inline-block;
      margin-top: 4px;
      margin-right: 4px;
    }
    .autocomplete-empty {
      padding: 12px;
      text-align: center;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
    }
    .autocomplete-debug {
      padding: 10px;
      text-align: center;
      background-color: #0e639c;
      color: white;
      font-size: 12px;
      font-weight: bold;
    }
    .highlight {
      background-color: var(--vscode-editor-findMatchHighlightBackground);
      border-radius: 2px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="status">
      <span class="status-dot"></span>
      <span>${isConnected ? `${user?.username || 'Connected'}` : 'Disconnected'}</span>
    </div>
  </div>

  <div class="chat-container" id="chat-container">
    <div class="message assistant">
      <p>Type a command to execute a workflow.</p>
      <p style="margin-top: 4px; font-size: 11px; opacity: 0.8;">
        Example: <code>/workflow-data-analysis session-001</code>
      </p>
    </div>
  </div>

  <div class="input-container">
    <!-- Autocomplete dropdown - inline above input -->
    <div id="autocomplete-container" class="autocomplete-container" style="display: none;">
      <div class="autocomplete-header">↑↓ navigate • Enter select • Esc close</div>
      <ul id="autocomplete-list" class="autocomplete-list"></ul>
    </div>
    <div class="input-row">
      <input type="text" id="chat-input" placeholder="Type / to see workflows..." autocomplete="off" />
      <button id="send-btn">▶</button>
    </div>
    <div class="actions">
      ${isConnected
        ? '<button class="secondary" id="refresh-btn">Refresh</button>'
        : '<button id="connect-btn">Connect</button>'
      }
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const chatContainer = document.getElementById('chat-container');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const autocompleteContainer = document.getElementById('autocomplete-container');
    const autocompleteList = document.getElementById('autocomplete-list');

    // Initialize workflow data for autocomplete
    window.hexaiWorkflows = ${workflowsJson};

    // Update placeholder with workflow count
    if (chatInput && window.hexaiWorkflows.length > 0) {
      chatInput.placeholder = 'Type / for ' + window.hexaiWorkflows.length + ' workflow(s)...';
    }

    // Verify autocomplete container exists
    if (!autocompleteContainer) {
      console.error('[HexAI] ERROR: autocomplete-container not found in DOM!');
    }

    // Autocomplete state
    const autocomplete = {
      workflows: window.hexaiWorkflows || [],
      filteredWorkflows: [],
      selectedIndex: -1,
      isVisible: false,
      slashPosition: -1
    };

    // Escape HTML to prevent XSS
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Highlight matching text in result
    function highlightMatch(text, query) {
      if (!query) return escapeHtml(text);
      const escaped = escapeHtml(text);
      const queryLower = query.toLowerCase();
      const textLower = text.toLowerCase();
      const idx = textLower.indexOf(queryLower);
      if (idx === -1) return escaped;
      const before = escapeHtml(text.substring(0, idx));
      const match = escapeHtml(text.substring(idx, idx + query.length));
      const after = escapeHtml(text.substring(idx + query.length));
      return before + '<span class="highlight">' + match + '</span>' + after;
    }

    // Filter workflows based on query
    function filterWorkflows(query) {
      if (!query) {
        return autocomplete.workflows.slice();
      }
      const q = query.toLowerCase().replace(/^workflow-/, '');
      return autocomplete.workflows.filter(w => {
        return w.workflowId.toLowerCase().includes(q) ||
               w.name.toLowerCase().includes(q) ||
               w.description.toLowerCase().includes(q);
      });
    }

    // Render autocomplete dropdown
    function renderAutocomplete(query) {
      autocompleteList.innerHTML = '';
      const displayQuery = query ? query.replace(/^workflow-/, '') : '';

      if (autocomplete.filteredWorkflows.length === 0) {
        if (autocomplete.workflows.length === 0) {
          autocompleteList.innerHTML = '<li class="autocomplete-empty">No workflows available. Connect first.</li>';
        } else {
          autocompleteList.innerHTML = '<li class="autocomplete-empty">No matching workflows</li>';
        }
        return;
      }

      autocomplete.filteredWorkflows.forEach((w, idx) => {
        const li = document.createElement('li');
        li.className = 'autocomplete-item' + (idx === autocomplete.selectedIndex ? ' selected' : '');
        li.setAttribute('data-index', idx);

        const nameHtml = highlightMatch(w.name, displayQuery);
        const idHtml = highlightMatch(w.workflowId, displayQuery);
        const descHtml = w.description ? highlightMatch(w.description, displayQuery) : '';

        let toolsHtml = '';
        if (w.tools && w.tools.length > 0) {
          toolsHtml = w.tools.slice(0, 3).map(t => '<span class="autocomplete-item-tools">' + escapeHtml(t) + '</span>').join('');
          if (w.tools.length > 3) {
            toolsHtml += '<span class="autocomplete-item-tools">+' + (w.tools.length - 3) + '</span>';
          }
        }

        li.innerHTML =
          '<div class="autocomplete-item-name">' + nameHtml + '</div>' +
          '<div class="autocomplete-item-id">/workflow-' + idHtml + '</div>' +
          (descHtml ? '<div class="autocomplete-item-desc">' + descHtml + '</div>' : '') +
          (toolsHtml ? '<div>' + toolsHtml + '</div>' : '');

        li.addEventListener('click', () => selectWorkflow(idx));
        li.addEventListener('mouseenter', () => {
          autocomplete.selectedIndex = idx;
          updateSelection();
        });

        autocompleteList.appendChild(li);
      });
    }

    // Update visual selection
    function updateSelection() {
      const items = autocompleteList.querySelectorAll('.autocomplete-item');
      items.forEach((item, idx) => {
        item.classList.toggle('selected', idx === autocomplete.selectedIndex);
      });
      // Scroll selected item into view
      if (autocomplete.selectedIndex >= 0 && items[autocomplete.selectedIndex]) {
        items[autocomplete.selectedIndex].scrollIntoView({ block: 'nearest' });
      }
    }

    // Show autocomplete
    function showAutocomplete() {
      autocompleteContainer.style.display = 'block';
      autocomplete.isVisible = true;
    }

    // Hide autocomplete
    function hideAutocomplete() {
      autocompleteContainer.style.display = 'none';
      autocomplete.isVisible = false;
      autocomplete.selectedIndex = -1;
      autocomplete.slashPosition = -1;
    }

    // Navigate down in list
    function navigateDown() {
      if (autocomplete.filteredWorkflows.length === 0) return;
      autocomplete.selectedIndex = (autocomplete.selectedIndex + 1) % autocomplete.filteredWorkflows.length;
      updateSelection();
    }

    // Navigate up in list
    function navigateUp() {
      if (autocomplete.filteredWorkflows.length === 0) return;
      autocomplete.selectedIndex = autocomplete.selectedIndex <= 0
        ? autocomplete.filteredWorkflows.length - 1
        : autocomplete.selectedIndex - 1;
      updateSelection();
    }

    // Select workflow and insert into input
    function selectWorkflow(index) {
      if (index < 0 || index >= autocomplete.filteredWorkflows.length) return;
      const workflow = autocomplete.filteredWorkflows[index];
      const value = chatInput.value;
      const beforeSlash = value.substring(0, autocomplete.slashPosition);
      const command = '/workflow-' + workflow.workflowId + ' ';
      chatInput.value = beforeSlash + command;
      chatInput.focus();
      hideAutocomplete();
    }

    // Handle input changes for autocomplete
    function handleAutocompleteInput() {
      const value = chatInput.value;
      const cursorPos = chatInput.selectionStart;

      // Find the last "/" before cursor
      let slashPos = -1;
      for (let i = cursorPos - 1; i >= 0; i--) {
        if (value[i] === '/') {
          slashPos = i;
          break;
        }
        // Stop if we hit a space before finding a slash
        if (value[i] === ' ' && i < cursorPos - 1) {
          break;
        }
      }

      if (slashPos === -1) {
        hideAutocomplete();
        return;
      }

      // Extract query after the slash
      const query = value.substring(slashPos + 1, cursorPos);

      // Don't show autocomplete if there's already a space after the query (command complete)
      if (query.includes(' ')) {
        hideAutocomplete();
        return;
      }

      autocomplete.slashPosition = slashPos;
      autocomplete.filteredWorkflows = filterWorkflows(query);
      autocomplete.selectedIndex = autocomplete.filteredWorkflows.length > 0 ? 0 : -1;
      renderAutocomplete(query);
      showAutocomplete();
    }

    function addMessage(content, type = 'assistant') {
      const div = document.createElement('div');
      div.className = 'message ' + type;
      div.innerHTML = '<pre>' + escapeHtml(content) + '</pre>';
      chatContainer.appendChild(div);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function sendMessage() {
      const text = chatInput.value.trim();
      if (!text) return;

      hideAutocomplete();
      addMessage(text, 'user');
      chatInput.value = '';

      vscode.postMessage({ command: 'parseCommand', text: text });
    }

    // Input event for autocomplete
    // Use both input and keyup for better compatibility
    chatInput.addEventListener('input', handleAutocompleteInput);
    chatInput.addEventListener('keyup', function(e) {
      // Only trigger on character keys, not on arrow keys or modifiers
      if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
        handleAutocompleteInput();
      }
    });

    // Keyboard navigation
    chatInput.addEventListener('keydown', (e) => {
      if (autocomplete.isVisible) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          navigateDown();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          navigateUp();
        } else if (e.key === 'Enter' || e.key === 'Tab') {
          if (autocomplete.selectedIndex >= 0) {
            e.preventDefault();
            selectWorkflow(autocomplete.selectedIndex);
          } else if (e.key === 'Enter') {
            sendMessage();
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          hideAutocomplete();
        }
      } else if (e.key === 'Enter') {
        sendMessage();
      }
    });

    sendBtn.addEventListener('click', sendMessage);

    // Close autocomplete when clicking outside
    document.addEventListener('click', (e) => {
      if (!chatInput.contains(e.target) && !autocompleteContainer.contains(e.target)) {
        hideAutocomplete();
      }
    });

    document.getElementById('connect-btn')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'connect' });
    });

    document.getElementById('refresh-btn')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'refresh' });
    });

    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message.type === 'workflowsUpdate') {
        autocomplete.workflows = message.workflows || [];
        if (autocomplete.isVisible) {
          handleAutocompleteInput();
        }
      } else {
        addMessage(message.content, message.type);
      }
    });

    chatInput.focus();
  </script>
</body>
</html>`;
  }
}
