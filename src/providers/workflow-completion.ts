import * as vscode from 'vscode';
import { TemplateCache } from '../services/template-cache';
import { ConnectionManager } from '../services/connection-manager';

export class WorkflowCompletionProvider implements vscode.CompletionItemProvider {
  constructor(private cache: TemplateCache) {}

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.CompletionItem[]> {
    const linePrefix = document
      .lineAt(position)
      .text.substring(0, position.character);

    // Trigger on /workflow- pattern
    if (!linePrefix.match(/\/workflow-\w*$/)) {
      return [];
    }

    if (!ConnectionManager.getInstance().isConnected()) {
      return [];
    }

    const templates = this.cache.getTemplates();

    return templates.map(template => {
      const item = new vscode.CompletionItem(
        template.name,
        vscode.CompletionItemKind.Function
      );

      item.detail = template.workflow_id;
      item.documentation = new vscode.MarkdownString(
        `**${template.name}**\n\n` +
        `${template.description || 'No description'}\n\n` +
        `**Workflow ID:** \`${template.workflow_id}\`\n\n` +
        `**Tools:** ${template.tools?.join(', ') || 'None'}`
      );

      // Insert command format: /workflow-{workflow_id} {session_id}
      item.insertText = new vscode.SnippetString(
        `workflow-${template.workflow_id} \${1:SESSION_ID}`
      );

      // Command to execute after insertion
      item.command = {
        command: 'hexai.executeWorkflow',
        title: 'Execute Workflow',
        arguments: [template.id]
      };

      return item;
    });
  }
}
