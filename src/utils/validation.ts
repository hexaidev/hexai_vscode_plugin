export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidSessionId(sessionId: string): boolean {
  if (!sessionId || sessionId.trim().length === 0) {
    return false;
  }
  if (sessionId.length < 3) {
    return false;
  }
  // Allow alphanumeric, dashes, underscores
  return /^[a-zA-Z0-9_-]+$/.test(sessionId);
}

export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}

export interface ParsedCommand {
  workflowId: string;
  parameters: Record<string, string>;
}

/**
 * Parses commands in format:
 * /workflow-data-analysis session-001
 * /workflow-report-gen task-5234 --priority high
 */
export function parseWorkflowCommand(input: string): ParsedCommand | null {
  const match = input.match(/^\/workflow-(\S+)\s*(.*)?$/);
  if (!match) {
    return null;
  }

  const workflowId = match[1];
  const argsString = match[2]?.trim() || '';

  const parameters: Record<string, string> = {};

  // Parse named parameters (--key value or --key=value)
  const namedRegex = /--(\w+)(?:=|\s+)(\S+)/g;
  let namedMatch;
  let remainingArgs = argsString;

  while ((namedMatch = namedRegex.exec(argsString)) !== null) {
    parameters[namedMatch[1]] = namedMatch[2];
    remainingArgs = remainingArgs.replace(namedMatch[0], '').trim();
  }

  // First positional argument is typically the main identifier
  const positional = remainingArgs.split(/\s+/).filter(Boolean);
  if (positional.length > 0) {
    parameters['_positional'] = positional[0];
    // Common aliases
    parameters['issueId'] = positional[0];
    parameters['ticketId'] = positional[0];
  }

  return { workflowId, parameters };
}
