import * as vscode from 'vscode';
import { TemplateCache } from '../services/template-cache';
import { ConnectionManager } from '../services/connection-manager';

class TemplateTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly tooltip: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly templateId?: string,
    public readonly contextValue?: string
  ) {
    super(label, collapsibleState);

    if (contextValue === 'template') {
      this.description = tooltip.substring(0, 50);
      this.command = {
        command: 'hexai.executeWorkflow',
        title: 'Execute Workflow',
        arguments: [templateId]
      };
      this.iconPath = new vscode.ThemeIcon('play-circle');
    } else if (contextValue === 'disconnected') {
      this.command = {
        command: 'hexai.connect',
        title: 'Connect'
      };
      this.iconPath = new vscode.ThemeIcon('plug');
    } else if (contextValue === 'empty') {
      this.command = {
        command: 'hexai.refreshTemplates',
        title: 'Refresh'
      };
      this.iconPath = new vscode.ThemeIcon('refresh');
    } else if (contextValue === 'info') {
      this.iconPath = new vscode.ThemeIcon('info');
    }
  }
}

export class TemplateTreeProvider implements vscode.TreeDataProvider<TemplateTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TemplateTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private cache: TemplateCache) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: TemplateTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TemplateTreeItem): Promise<TemplateTreeItem[]> {
    if (!ConnectionManager.getInstance().isConnected()) {
      return [
        new TemplateTreeItem(
          'Not connected',
          'Click to connect to HexAI',
          vscode.TreeItemCollapsibleState.None,
          undefined,
          'disconnected'
        )
      ];
    }

    if (element && element.contextValue === 'template') {
      // Show template details as children
      const template = this.cache.getTemplate(element.templateId!);
      if (template) {
        const items: TemplateTreeItem[] = [];

        // Workflow ID
        items.push(new TemplateTreeItem(
          `ID: ${template.workflow_id}`,
          'Workflow identifier',
          vscode.TreeItemCollapsibleState.None,
          undefined,
          'info'
        ));

        // Tools
        if (template.tools && template.tools.length > 0) {
          items.push(new TemplateTreeItem(
            `Tools: ${template.tools.join(', ')}`,
            'Available tools',
            vscode.TreeItemCollapsibleState.None,
            undefined,
            'info'
          ));
        }

        // Status
        items.push(new TemplateTreeItem(
          `Status: ${template.is_active ? 'Active' : 'Inactive'}`,
          'Template status',
          vscode.TreeItemCollapsibleState.None,
          undefined,
          'info'
        ));

        return items;
      }
      return [];
    }

    // Root level - show all templates
    const templates = this.cache.getTemplates();

    if (templates.length === 0) {
      return [
        new TemplateTreeItem(
          'No workflows available',
          'Click refresh to reload',
          vscode.TreeItemCollapsibleState.None,
          undefined,
          'empty'
        )
      ];
    }

    return templates.map(t => new TemplateTreeItem(
      t.name,
      t.description || t.workflow_id,
      vscode.TreeItemCollapsibleState.Collapsed,
      t.id,
      'template'
    ));
  }
}

export class HistoryTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<vscode.TreeItem[]> {
    if (!ConnectionManager.getInstance().isConnected()) {
      const item = new vscode.TreeItem('Not connected');
      item.iconPath = new vscode.ThemeIcon('plug');
      return [item];
    }

    try {
      const client = ConnectionManager.getInstance().getClient();
      const executions = await client.listWorkflows(undefined, undefined, 20);

      if (executions.length === 0) {
        const item = new vscode.TreeItem('No executions yet');
        item.iconPath = new vscode.ThemeIcon('history');
        return [item];
      }

      return executions.map(exec => {
        const item = new vscode.TreeItem(
          `${exec.session_id} - ${exec.status}`,
          vscode.TreeItemCollapsibleState.None
        );
        item.description = new Date(exec.created_at).toLocaleString();
        item.tooltip = `ID: ${exec.id}\nStatus: ${exec.status}\nTrigger: ${exec.trigger}`;

        switch (exec.status) {
          case 'completed':
            item.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
            break;
          case 'failed':
            item.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
            break;
          case 'running':
            item.iconPath = new vscode.ThemeIcon('sync~spin');
            break;
          case 'pending':
          case 'queued':
            item.iconPath = new vscode.ThemeIcon('clock');
            break;
          default:
            item.iconPath = new vscode.ThemeIcon('circle-outline');
        }

        return item;
      });
    } catch {
      const item = new vscode.TreeItem('Failed to load history');
      item.iconPath = new vscode.ThemeIcon('error');
      return [item];
    }
  }
}
