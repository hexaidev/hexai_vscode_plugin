import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import {
  LoginRequest,
  TokenResponse,
  UserInfo,
  WorkflowTemplate,
  WorkflowCreate,
  WorkflowExecution,
  WorkflowListItem,
  WorkflowEvent,
  HexAIConfig
} from './types';
import { HexAIError, ConnectionError, AuthError } from './errors';

export class HexAIClient {
  private client: AxiosInstance;
  private config: HexAIConfig;
  private accessToken: string | null = null;
  private tokenExpiresAt: number | null = null;

  constructor(config: HexAIConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.serverUrl,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-Client': 'vscode-hexai-plugin',
        'X-Client-Version': '0.1.0'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        if (this.accessToken && !config.url?.includes('/auth/login')) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle errors
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        // Log error details for debugging
        console.error('HexAI API Error:', {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          code: error.code,
          message: error.message
        });

        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          throw new ConnectionError(`Cannot connect to HexAI server at ${this.config.serverUrl}. Please check if the server is running.`);
        }
        if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
          throw new ConnectionError(`Connection to ${this.config.serverUrl} was reset or timed out. Please try again.`);
        }
        if (error.response?.status === 401) {
          // Try to refresh token once
          if (!error.config?.url?.includes('/auth/')) {
            try {
              await this.authenticate();
              // Retry original request
              if (error.config) {
                return this.client.request(error.config);
              }
            } catch {
              this.accessToken = null;
              throw new AuthError('Session expired. Please login again.');
            }
          }
          throw new AuthError('Invalid username or password. Please check your credentials.');
        }
        if (error.response?.status === 500) {
          const errorData = error.response?.data as Record<string, unknown> | undefined;
          const detail = (errorData?.detail as string) || (errorData?.error as string) || 'Unknown server error';
          throw new HexAIError(`Server error: ${detail}. Please check server logs or contact administrator.`, 500);
        }
        const errorData = error.response?.data as Record<string, unknown> | undefined;
        const message = (errorData?.detail as string) ||
                       (errorData?.message as string) ||
                       (errorData?.error as string) ||
                       error.message;
        throw new HexAIError(message, error.response?.status);
      }
    );
  }

  // ============================================
  // Authentication
  // ============================================

  async authenticate(): Promise<TokenResponse> {
    const response = await this.client.post<TokenResponse>(
      '/api/v1/auth/login',
      {
        username: this.config.username,
        password: this.config.password
      } as LoginRequest
    );

    this.accessToken = response.data.access_token;
    this.tokenExpiresAt = Date.now() + (response.data.expires_in * 1000);

    return response.data;
  }

  async getCurrentUser(): Promise<UserInfo> {
    await this.ensureAuthenticated();
    const response = await this.client.get<UserInfo>('/api/v1/auth/me');
    return response.data;
  }

  // ============================================
  // Templates (dostępne workflow)
  // ============================================

  async getTemplates(activeOnly: boolean = true): Promise<WorkflowTemplate[]> {
    await this.ensureAuthenticated();
    const response = await this.client.get<WorkflowTemplate[]>(
      '/api/v1/templates',
      { params: { active_only: activeOnly } }
    );
    return response.data;
  }

  async getTemplate(templateId: string): Promise<WorkflowTemplate> {
    await this.ensureAuthenticated();
    const response = await this.client.get<WorkflowTemplate>(
      `/api/v1/templates/${templateId}`
    );
    return response.data;
  }

  // ============================================
  // Workflow Executions
  // ============================================

  async createWorkflow(data: WorkflowCreate): Promise<WorkflowExecution> {
    await this.ensureAuthenticated();
    const response = await this.client.post<WorkflowExecution>(
      '/api/v1/workflows',
      data
    );
    return response.data;
  }

  async getWorkflow(workflowId: string): Promise<WorkflowExecution> {
    await this.ensureAuthenticated();
    const response = await this.client.get<WorkflowExecution>(
      `/api/v1/workflows/${workflowId}`
    );
    return response.data;
  }

  async listWorkflows(
    templateId?: string,
    statusFilter?: string,
    limit: number = 50
  ): Promise<WorkflowListItem[]> {
    await this.ensureAuthenticated();
    const response = await this.client.get<WorkflowListItem[]>(
      '/api/v1/workflows',
      {
        params: {
          template_id: templateId,
          status_filter: statusFilter,
          limit
        }
      }
    );
    return response.data;
  }

  // ============================================
  // Events & Logs
  // ============================================

  async getWorkflowEvents(
    workflowId: string,
    limit: number = 100
  ): Promise<WorkflowEvent[]> {
    await this.ensureAuthenticated();
    const response = await this.client.get<WorkflowEvent[]>(
      `/api/v1/workflows/${workflowId}/events`,
      { params: { limit } }
    );
    return response.data;
  }

  async getWorkflowLogs(
    workflowId: string,
    tail: number = 100
  ): Promise<string> {
    await this.ensureAuthenticated();
    const response = await this.client.get<{ logs: string }>(
      `/api/v1/workflows/${workflowId}/logs`,
      { params: { tail } }
    );
    return response.data.logs;
  }

  // ============================================
  // Connection
  // ============================================

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.client.get('/health');
      console.log('HexAI health check response:', response.data);
      return { success: true };
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorMessage = axiosError.code === 'ECONNREFUSED'
        ? `Server not reachable at ${this.config.serverUrl}`
        : axiosError.message;
      console.error('HexAI health check failed:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  setToken(token: string, expiresAt: number): void {
    this.accessToken = token;
    this.tokenExpiresAt = expiresAt;
  }

  getToken(): { token: string | null; expiresAt: number | null } {
    return {
      token: this.accessToken,
      expiresAt: this.tokenExpiresAt
    };
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.accessToken || this.isTokenExpired()) {
      await this.authenticate();
    }
  }

  private isTokenExpired(): boolean {
    if (!this.tokenExpiresAt) {
      return true;
    }
    // Refresh 60s before expiry
    return Date.now() >= (this.tokenExpiresAt - 60000);
  }

  disconnect(): void {
    this.accessToken = null;
    this.tokenExpiresAt = null;
  }
}
