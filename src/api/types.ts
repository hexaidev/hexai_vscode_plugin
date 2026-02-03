// ============================================
// Authentication
// ============================================

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number; // seconds
}

export interface UserInfo {
  id: string;
  username: string;
  email: string;
  is_admin: boolean;
  created_at: string;
}

// ============================================
// Workflow Templates (dostępne workflow do wykonania)
// ============================================

export interface WorkflowTemplate {
  id: string;                    // UUID
  workflow_id: string;           // human-readable identifier (e.g., "data-analysis")
  name: string;
  description: string | null;
  container_image: string;
  tools: string[];
  version: number;
  is_active: boolean;
  webhook_url: string;
  webhook_auth_type: string;
  webhook_schema: Record<string, unknown> | null;
  session_id_json_path: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// Workflow Executions (wykonania workflow)
// ============================================

export type WorkflowStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface WorkflowCreate {
  workflow_template_id: string;  // UUID template
  session_id: string;            // e.g., "session-001"
  input_data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface WorkflowExecution {
  id: string;                    // UUID wykonania
  workflow_template_id: string;
  user_id: string;
  session_id: string;
  status: WorkflowStatus;
  pod_name: string | null;
  trigger: string;
  input_data: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  error: string | null;
  result_summary: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  last_activity_at: string | null;
  token_usage?: Record<string, unknown> | null;
}

export interface WorkflowListItem {
  id: string;
  workflow_template_id: string;
  user_id: string;
  session_id: string;
  status: WorkflowStatus;
  pod_name: string | null;
  trigger: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

// ============================================
// Events (logi wykonania)
// ============================================

export type EventType =
  | 'status_change'
  | 'message'
  | 'tool_call'
  | 'error'
  | 'checkpoint';

export interface WorkflowEvent {
  id: string;
  workflow_id: string;
  event_type: EventType;
  timestamp: string;
  data: Record<string, unknown>;
}

// ============================================
// Configuration
// ============================================

export interface HexAIConfig {
  serverUrl: string;
  username: string;
  password: string;
  timeout?: number;
}

export interface StoredCredentials {
  serverUrl: string;
  username: string;
  accessToken?: string;
  tokenExpiresAt?: number;
}
