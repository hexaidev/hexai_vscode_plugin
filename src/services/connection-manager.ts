import * as vscode from 'vscode';
import { HexAIClient } from '../api/hexai-client';
import { HexAIConfig, UserInfo } from '../api/types';
import { EventEmitter } from 'events';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export class ConnectionManager extends EventEmitter {
  private static instance: ConnectionManager;
  private client: HexAIClient | null = null;
  private state: ConnectionState = 'disconnected';
  private userInfo: UserInfo | null = null;
  private serverUrl: string | null = null;

  private constructor() {
    super();
  }

  static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  async connect(config: HexAIConfig): Promise<void> {
    this.setState('connecting');
    this.serverUrl = config.serverUrl;

    try {
      console.log(`HexAI: Connecting to ${config.serverUrl}...`);
      this.client = new HexAIClient(config);

      // Test connection first
      console.log('HexAI: Testing server health...');
      const healthCheck = await this.client.testConnection();
      if (!healthCheck.success) {
        throw new Error(healthCheck.error || 'Server is not reachable');
      }
      console.log('HexAI: Server health check passed');

      // Authenticate
      console.log(`HexAI: Authenticating as ${config.username}...`);
      await this.client.authenticate();
      console.log('HexAI: Authentication successful');

      // Get user info (optional - server may not support this endpoint)
      console.log('HexAI: Fetching user info...');
      try {
        this.userInfo = await this.client.getCurrentUser();
        console.log(`HexAI: Connected as ${this.userInfo.username}`);
      } catch (userInfoError) {
        // If /me endpoint fails, use username from config
        console.warn('HexAI: Could not fetch user info, using config username');
        this.userInfo = {
          id: 'unknown',
          username: config.username,
          email: '',
          is_admin: false,
          created_at: new Date().toISOString()
        };
      }

      this.setState('connected');
      this.emit('connected', this.userInfo);

      vscode.window.showInformationMessage(
        `Connected to HexAI as ${this.userInfo.username}`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('HexAI: Connection failed:', errorMessage);
      this.setState('error');
      this.emit('error', error);
      throw error;
    }
  }

  disconnect(): void {
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }
    this.userInfo = null;
    this.serverUrl = null;
    this.setState('disconnected');
    this.emit('disconnected');
  }

  getClient(): HexAIClient {
    if (!this.client || this.state !== 'connected') {
      throw new Error('Not connected to HexAI server');
    }
    return this.client;
  }

  getState(): ConnectionState {
    return this.state;
  }

  isConnected(): boolean {
    return this.state === 'connected';
  }

  getUserInfo(): UserInfo | null {
    return this.userInfo;
  }

  getServerUrl(): string | null {
    return this.serverUrl;
  }

  private setState(state: ConnectionState): void {
    this.state = state;
    this.emit('stateChanged', state);
  }
}
