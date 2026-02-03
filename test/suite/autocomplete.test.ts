import * as assert from 'assert';

// Workflow data structure for autocomplete
interface AutocompleteWorkflow {
  id: string;
  workflowId: string;
  name: string;
  description: string;
  tools: string[];
}

// Mock workflows for testing
const mockWorkflows: AutocompleteWorkflow[] = [
  {
    id: 'uuid-1',
    workflowId: 'data-analysis',
    name: 'Data Analysis',
    description: 'Analysis workflow for data processing',
    tools: ['pandas', 'numpy']
  },
  {
    id: 'uuid-2',
    workflowId: 'code-review',
    name: 'Code Review',
    description: 'Automated code review workflow',
    tools: ['github', 'sonar']
  },
  {
    id: 'uuid-3',
    workflowId: 'air-quality',
    name: 'Air Quality Check',
    description: 'Check air quality metrics',
    tools: ['sensors', 'api']
  },
  {
    id: 'uuid-4',
    workflowId: 'bugfix',
    name: 'Bug Fix Workflow',
    description: 'Quick bugfix process',
    tools: ['git', 'testing']
  }
];

/**
 * Filter workflows based on query - mirrors the webview logic
 */
function filterWorkflows(workflows: AutocompleteWorkflow[], query: string): AutocompleteWorkflow[] {
  if (!query) {
    return workflows.slice();
  }
  const q = query.toLowerCase().replace(/^workflow-/, '');
  return workflows.filter(w => {
    return w.workflowId.toLowerCase().includes(q) ||
           w.name.toLowerCase().includes(q) ||
           w.description.toLowerCase().includes(q);
  });
}

/**
 * Build command from selected workflow - mirrors the webview logic
 */
function buildCommand(workflow: AutocompleteWorkflow, textBeforeSlash: string): string {
  return textBeforeSlash + '/workflow-' + workflow.workflowId + ' ';
}

/**
 * Find slash position for autocomplete - mirrors the webview logic
 */
function findSlashPosition(value: string, cursorPos: number): number {
  for (let i = cursorPos - 1; i >= 0; i--) {
    if (value[i] === '/') {
      return i;
    }
    // Stop if we hit a space before finding a slash
    if (value[i] === ' ' && i < cursorPos - 1) {
      break;
    }
  }
  return -1;
}

suite('Autocomplete Filtering Test Suite', () => {
  test('Empty query returns all workflows', () => {
    const results = filterWorkflows(mockWorkflows, '');
    assert.strictEqual(results.length, 4);
  });

  test('Filter by exact workflow_id', () => {
    const results = filterWorkflows(mockWorkflows, 'data-analysis');
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].workflowId, 'data-analysis');
  });

  test('Filter by partial workflow_id', () => {
    const results = filterWorkflows(mockWorkflows, 'data');
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].workflowId, 'data-analysis');
  });

  test('Filter by name substring', () => {
    const results = filterWorkflows(mockWorkflows, 'Review');
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].name, 'Code Review');
  });

  test('Filter by description substring', () => {
    const results = filterWorkflows(mockWorkflows, 'automated');
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].workflowId, 'code-review');
  });

  test('Filter with "workflow-" prefix strips prefix', () => {
    const results = filterWorkflows(mockWorkflows, 'workflow-air');
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].workflowId, 'air-quality');
  });

  test('Case insensitive matching', () => {
    const results1 = filterWorkflows(mockWorkflows, 'DATA');
    assert.strictEqual(results1.length, 1);

    const results2 = filterWorkflows(mockWorkflows, 'data');
    assert.strictEqual(results2.length, 1);

    // Results should be the same regardless of case
    assert.deepStrictEqual(
      results1.map(r => r.id).sort(),
      results2.map(r => r.id).sort()
    );

    // Also test with 'Analysis' which appears in name and description
    const results3 = filterWorkflows(mockWorkflows, 'ANALYSIS');
    const results4 = filterWorkflows(mockWorkflows, 'analysis');
    assert.deepStrictEqual(
      results3.map(r => r.id).sort(),
      results4.map(r => r.id).sort()
    );
  });

  test('Non-matching query returns empty array', () => {
    const results = filterWorkflows(mockWorkflows, 'nonexistent');
    assert.strictEqual(results.length, 0);
  });

  test('Multiple matches across different fields', () => {
    // 'quality' matches air-quality workflowId and 'Air Quality Check' name
    const results = filterWorkflows(mockWorkflows, 'quality');
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].workflowId, 'air-quality');
  });

  test('Filter with special characters in query', () => {
    const results = filterWorkflows(mockWorkflows, 'code-');
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].workflowId, 'code-review');
  });
});

suite('Autocomplete Selection Test Suite', () => {
  test('Build correct command from selection', () => {
    const workflow = mockWorkflows[0];
    const result = buildCommand(workflow, '');
    assert.strictEqual(result, '/workflow-data-analysis ');
  });

  test('Handle mid-text slash replacement', () => {
    const workflow = mockWorkflows[1];
    const result = buildCommand(workflow, 'Hello ');
    assert.strictEqual(result, 'Hello /workflow-code-review ');
  });

  test('Preserve text before slash', () => {
    const workflow = mockWorkflows[2];
    const result = buildCommand(workflow, 'Previous text: ');
    assert.strictEqual(result, 'Previous text: /workflow-air-quality ');
  });
});

suite('Slash Position Detection Test Suite', () => {
  test('Find slash at start of input', () => {
    const pos = findSlashPosition('/dev', 4);
    assert.strictEqual(pos, 0);
  });

  test('Find slash after text', () => {
    const pos = findSlashPosition('text /dev', 9);
    assert.strictEqual(pos, 5);
  });

  test('Return -1 when no slash found', () => {
    const pos = findSlashPosition('no slash here', 13);
    assert.strictEqual(pos, -1);
  });

  test('Stop at space before slash', () => {
    // If there's a space after the slash query, we shouldn't match
    const pos = findSlashPosition('/workflow-dev session', 21);
    assert.strictEqual(pos, -1);
  });

  test('Find correct slash when multiple exist', () => {
    // Should find the most recent slash before cursor
    const pos = findSlashPosition('/first /second', 14);
    assert.strictEqual(pos, 7);
  });

  test('Handle cursor at slash position', () => {
    const pos = findSlashPosition('text /', 6);
    assert.strictEqual(pos, 5);
  });
});
