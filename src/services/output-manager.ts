import * as vscode from 'vscode';
import { WorkflowEvent } from '../api/types';

export class OutputManager {
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('HexAI Workflows');
  }

  show(): void {
    this.outputChannel.show(true); // preserveFocus = true
  }

  clear(): void {
    this.outputChannel.clear();
  }

  appendLine(message: string): void {
    this.outputChannel.appendLine(message);
  }

  appendEvent(event: WorkflowEvent): void {
    const timestamp = new Date(event.timestamp).toLocaleTimeString();
    const prefix = this.getEventPrefix(event.event_type);
    const data = event.data as Record<string, unknown>;

    switch (event.event_type) {
      case 'message': {
        const content = (data.content as string) || JSON.stringify(data);
        this.outputChannel.appendLine(`${timestamp} ${prefix} ${content}`);
        break;
      }

      case 'tool_call': {
        const tool = (data.tool_name as string) || 'unknown';
        const args = JSON.stringify(data.arguments || {});
        this.outputChannel.appendLine(`${timestamp} ${prefix} ${tool}(${args})`);
        break;
      }

      case 'status_change': {
        const from = (data.from_status as string) || '?';
        const to = (data.to_status as string) || '?';
        this.outputChannel.appendLine(`${timestamp} ${prefix} ${from} → ${to}`);
        break;
      }

      case 'error': {
        const error = (data.message as string) || JSON.stringify(data);
        this.outputChannel.appendLine(`${timestamp} ${prefix} ${error}`);
        break;
      }

      case 'checkpoint':
        this.outputChannel.appendLine(`${timestamp} ${prefix} Checkpoint created`);
        break;

      default:
        this.outputChannel.appendLine(
          `${timestamp} [${event.event_type}] ${JSON.stringify(data)}`
        );
    }
  }

  private getEventPrefix(type: string): string {
    const prefixes: Record<string, string> = {
      message: '[MSG]',
      tool_call: '[TOOL]',
      status_change: '[STATUS]',
      error: '[ERROR]',
      checkpoint: '[CHECKPOINT]'
    };
    return prefixes[type] || `[${type.toUpperCase()}]`;
  }

  dispose(): void {
    this.outputChannel.dispose();
  }
}
