import * as vscode from 'vscode';

export class Logger {
  private static outputChannel: vscode.OutputChannel | null = null;
  private static debugMode: boolean = false;

  static initialize(debugMode: boolean = false): void {
    this.debugMode = debugMode;
    if (!this.outputChannel) {
      this.outputChannel = vscode.window.createOutputChannel('HexAI Debug');
    }
  }

  static info(message: string, ...args: unknown[]): void {
    const formatted = this.formatMessage('INFO', message, args);
    console.log(formatted);
    this.outputChannel?.appendLine(formatted);
  }

  static warn(message: string, ...args: unknown[]): void {
    const formatted = this.formatMessage('WARN', message, args);
    console.warn(formatted);
    this.outputChannel?.appendLine(formatted);
  }

  static error(message: string, ...args: unknown[]): void {
    const formatted = this.formatMessage('ERROR', message, args);
    console.error(formatted);
    this.outputChannel?.appendLine(formatted);
  }

  static debug(message: string, ...args: unknown[]): void {
    if (!this.debugMode) {
      return;
    }
    const formatted = this.formatMessage('DEBUG', message, args);
    console.debug(formatted);
    this.outputChannel?.appendLine(formatted);
  }

  private static formatMessage(level: string, message: string, args: unknown[]): string {
    const timestamp = new Date().toISOString();
    const argsStr = args.length > 0 ? ' ' + args.map(a => JSON.stringify(a)).join(' ') : '';
    return `[${timestamp}] [${level}] ${message}${argsStr}`;
  }

  static dispose(): void {
    this.outputChannel?.dispose();
    this.outputChannel = null;
  }
}
