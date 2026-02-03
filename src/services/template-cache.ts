import { WorkflowTemplate } from '../api/types';

export class TemplateCache {
  private templates: Map<string, WorkflowTemplate> = new Map();
  private byWorkflowId: Map<string, WorkflowTemplate> = new Map();
  private lastFetch: Date | null = null;
  private cacheTimeout: number;

  constructor(cacheTimeoutSeconds: number = 300) {
    this.cacheTimeout = cacheTimeoutSeconds * 1000;
  }

  setTemplates(templates: WorkflowTemplate[]): void {
    this.templates.clear();
    this.byWorkflowId.clear();

    for (const template of templates) {
      this.templates.set(template.id, template);
      this.byWorkflowId.set(template.workflow_id, template);
    }
    this.lastFetch = new Date();
  }

  getTemplates(): WorkflowTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplate(id: string): WorkflowTemplate | undefined {
    return this.templates.get(id);
  }

  findByWorkflowId(workflowId: string): WorkflowTemplate | undefined {
    return this.byWorkflowId.get(workflowId);
  }

  findByName(query: string): WorkflowTemplate[] {
    const lowerQuery = query.toLowerCase();
    return this.getTemplates().filter(t =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.workflow_id.toLowerCase().includes(lowerQuery) ||
      (t.description?.toLowerCase().includes(lowerQuery) ?? false)
    );
  }

  isStale(): boolean {
    if (!this.lastFetch) {
      return true;
    }
    return Date.now() - this.lastFetch.getTime() > this.cacheTimeout;
  }

  clear(): void {
    this.templates.clear();
    this.byWorkflowId.clear();
    this.lastFetch = null;
  }
}
