import * as vscode from 'vscode';
import { ConnectionManager } from '../services/connection-manager';
import { TemplateCache } from '../services/template-cache';
import { WorkflowTemplate, WorkflowCreate, WorkflowStatus } from '../api/types';
import { OutputManager } from '../services/output-manager';

export async function executeWorkflowCommand(
  cache: TemplateCache,
  outputManager: OutputManager,
  preselectedTemplateId?: string,
  preselectedSessionId?: string
): Promise<void> {
  const connectionManager = ConnectionManager.getInstance();

  if (!connectionManager.isConnected()) {
    const action = await vscode.window.showErrorMessage(
      'Not connected to HexAI.',
      'Connect Now'
    );
    if (action === 'Connect Now') {
      await vscode.commands.executeCommand('hexai.connect');
    }
    return;
  }

  const client = connectionManager.getClient();

  // Refresh cache if stale
  if (cache.isStale()) {
    const templates = await client.getTemplates(true);
    cache.setTemplates(templates);
  }

  // Select template (workflow to execute)
  let selectedTemplate: WorkflowTemplate | undefined;

  if (preselectedTemplateId) {
    selectedTemplate = cache.getTemplate(preselectedTemplateId) ||
      cache.findByWorkflowId(preselectedTemplateId);
  }

  if (!selectedTemplate) {
    const templates = cache.getTemplates();
    const items = templates.map(t => ({
      label: `$(play) ${t.name}`,
      description: t.workflow_id,
      detail: t.description || 'No description',
      template: t
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a workflow to execute',
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (!selected) {
      return;
    }
    selectedTemplate = selected.template;
  }

  // Get session ID (unique identifier for this execution)
  let sessionId = preselectedSessionId;
  if (!sessionId) {
    sessionId = await vscode.window.showInputBox({
      prompt: `Enter session ID for "${selectedTemplate.name}"`,
      placeHolder: 'e.g., session-001, task-5234, feature-login',
      validateInput: (input) => {
        if (!input || input.trim().length === 0) {
          return 'Session ID is required';
        }
        if (input.length < 3) {
          return 'Session ID must be at least 3 characters';
        }
        return null;
      }
    });
  }

  if (!sessionId) {
    return;
  }

  // Collect additional input_data based on webhook_schema (if available)
  const inputData: Record<string, unknown> = {};

  if (selectedTemplate.webhook_schema) {
    // Parse JSON Schema and collect required fields
    const schema = selectedTemplate.webhook_schema as {
      properties?: Record<string, { type: string; description?: string }>;
      required?: string[];
    };

    if (schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties)) {
        const isRequired = schema.required?.includes(key) ?? false;

        const value = await vscode.window.showInputBox({
          prompt: prop.description || `Enter ${key}`,
          placeHolder: `${key} (${prop.type})${isRequired ? ' - required' : ''}`,
          validateInput: (input) => {
            if (isRequired && !input) {
              return `${key} is required`;
            }
            return null;
          }
        });

        if (value === undefined && isRequired) {
          vscode.window.showWarningMessage('Workflow execution cancelled');
          return;
        }

        if (value !== undefined && value !== '') {
          inputData[key] = prop.type === 'number' ? parseFloat(value) : value;
        }
      }
    }
  }

  // Create workflow execution
  const workflowCreate: WorkflowCreate = {
    workflow_template_id: selectedTemplate.id,
    session_id: sessionId,
    input_data: Object.keys(inputData).length > 0 ? inputData : undefined
  };

  // Show output channel
  outputManager.show();
  outputManager.appendLine(`\n${'='.repeat(60)}`);
  outputManager.appendLine(`Workflow: ${selectedTemplate.name}`);
  outputManager.appendLine(`Session ID: ${sessionId}`);
  outputManager.appendLine(`Started: ${new Date().toISOString()}`);
  outputManager.appendLine(`${'='.repeat(60)}\n`);

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Executing: ${selectedTemplate.name}`,
        cancellable: false
      },
      async (progress) => {
        progress.report({ message: 'Creating workflow...' });

        const execution = await client.createWorkflow(workflowCreate);
        outputManager.appendLine(`Workflow ID: ${execution.id}`);
        outputManager.appendLine(`Status: ${execution.status}\n`);

        // Poll for completion and stream events
        let lastEventCount = 0;
        const terminalStatuses: WorkflowStatus[] = ['completed', 'failed', 'cancelled'];
        let currentStatus = execution.status;

        while (!terminalStatuses.includes(currentStatus)) {
          await new Promise(r => setTimeout(r, 2000));

          // Get latest status
          const status = await client.getWorkflow(execution.id);
          currentStatus = status.status;

          progress.report({ message: `Status: ${status.status}` });

          // Get new events
          try {
            const events = await client.getWorkflowEvents(execution.id);
            if (events.length > lastEventCount) {
              const newEvents = events.slice(0, events.length - lastEventCount);
              for (const event of newEvents.reverse()) {
                outputManager.appendEvent(event);
              }
              lastEventCount = events.length;
            }
          } catch {
            // Events may not be available yet
          }
        }

        // Final status
        const finalStatus = await client.getWorkflow(execution.id);

        outputManager.appendLine(`\n${'='.repeat(60)}`);
        outputManager.appendLine(`Final Status: ${finalStatus.status}`);

        if (finalStatus.result_summary) {
          outputManager.appendLine(`\nResult Summary:`);
          outputManager.appendLine(finalStatus.result_summary);
        }

        if (finalStatus.error) {
          outputManager.appendLine(`\nError:`);
          outputManager.appendLine(finalStatus.error);
        }

        outputManager.appendLine(`\nCompleted: ${new Date().toISOString()}`);
        outputManager.appendLine(`${'='.repeat(60)}\n`);

        if (finalStatus.status === 'completed') {
          vscode.window.showInformationMessage(
            `Workflow "${selectedTemplate!.name}" completed successfully`
          );
        } else {
          vscode.window.showErrorMessage(
            `Workflow "${selectedTemplate!.name}" ${finalStatus.status}: ${finalStatus.error || 'Unknown error'}`
          );
        }
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    outputManager.appendLine(`\nERROR: ${errorMessage}`);
    vscode.window.showErrorMessage(
      `Failed to execute workflow: ${errorMessage}`
    );
  }
}
