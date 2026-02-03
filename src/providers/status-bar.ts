import * as vscode from 'vscode';
import { ConnectionManager, ConnectionState } from '../services/connection-manager';

export class StatusBarProvider {
  private statusBarItem: vscode.StatusBarItem;
  private connectionManager: ConnectionManager;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.connectionManager = ConnectionManager.getInstance();

    this.connectionManager.on('stateChanged', (state: ConnectionState) => {
      this.updateStatusBar(state);
    });

    this.updateStatusBar(this.connectionManager.getState());
    this.statusBarItem.show();
  }

  private updateStatusBar(state: ConnectionState): void {
    switch (state) {
      case 'connected': {
        const user = this.connectionManager.getUserInfo();
        this.statusBarItem.text = `$(check) HexAI: ${user?.username || 'Connected'}`;
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.command = 'hexai.listWorkflows';
        this.statusBarItem.tooltip = 'Click to list workflows';
        break;
      }
      case 'connecting':
        this.statusBarItem.text = '$(sync~spin) HexAI: Connecting...';
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.command = undefined;
        this.statusBarItem.tooltip = 'Connecting to server...';
        break;
      case 'error':
        this.statusBarItem.text = '$(error) HexAI: Error';
        this.statusBarItem.backgroundColor = new vscode.ThemeColor(
          'statusBarItem.errorBackground'
        );
        this.statusBarItem.command = 'hexai.connect';
        this.statusBarItem.tooltip = 'Click to reconnect';
        break;
      default:
        this.statusBarItem.text = '$(plug) HexAI: Disconnected';
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.command = 'hexai.connect';
        this.statusBarItem.tooltip = 'Click to connect';
    }
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}
