import * as assert from 'assert';
import { TemplateCache } from '../../src/services/template-cache';
import { WorkflowTemplate } from '../../src/api/types';
import { parseWorkflowCommand, isValidUrl, isValidSessionId } from '../../src/utils/validation';

suite('Template Cache Test Suite', () => {
  test('Should store and retrieve templates', () => {
    const cache = new TemplateCache(300);

    const mockTemplates: WorkflowTemplate[] = [
      {
        id: 'uuid-1',
        workflow_id: 'data-analysis',
        name: 'Data Analysis',
        description: 'Analyze data workflow',
        container_image: 'hexai/workflow:latest',
        tools: ['pandas', 'numpy'],
        version: 1,
        is_active: true,
        webhook_url: 'http://localhost:8000/webhook',
        webhook_auth_type: 'bearer',
        webhook_schema: null,
        session_id_json_path: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      },
      {
        id: 'uuid-2',
        workflow_id: 'code-review',
        name: 'Code Review',
        description: 'Automated code review workflow',
        container_image: 'hexai/workflow:latest',
        tools: ['github', 'sonar'],
        version: 1,
        is_active: true,
        webhook_url: 'http://localhost:8000/webhook',
        webhook_auth_type: 'bearer',
        webhook_schema: null,
        session_id_json_path: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
    ];

    cache.setTemplates(mockTemplates);

    assert.strictEqual(cache.getTemplates().length, 2);
    assert.strictEqual(cache.getTemplate('uuid-1')?.name, 'Data Analysis');
    assert.strictEqual(cache.findByWorkflowId('data-analysis')?.id, 'uuid-1');
  });

  test('Should find templates by name', () => {
    const cache = new TemplateCache(300);

    const mockTemplates: WorkflowTemplate[] = [
      {
        id: 'uuid-1',
        workflow_id: 'data-analysis',
        name: 'Data Analysis',
        description: 'Analysis workflow',
        container_image: 'hexai/workflow:latest',
        tools: [],
        version: 1,
        is_active: true,
        webhook_url: '',
        webhook_auth_type: '',
        webhook_schema: null,
        session_id_json_path: null,
        created_at: '',
        updated_at: ''
      }
    ];

    cache.setTemplates(mockTemplates);

    const results = cache.findByName('data');
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].id, 'uuid-1');
  });

  test('Should return multiple matching results for autocomplete', () => {
    const cache = new TemplateCache(300);

    const mockTemplates: WorkflowTemplate[] = [
      {
        id: 'uuid-1',
        workflow_id: 'data-analysis',
        name: 'Data Analysis',
        description: 'Analysis workflow for data processing',
        container_image: 'hexai/workflow:latest',
        tools: ['pandas', 'numpy'],
        version: 1,
        is_active: true,
        webhook_url: '',
        webhook_auth_type: '',
        webhook_schema: null,
        session_id_json_path: null,
        created_at: '',
        updated_at: ''
      },
      {
        id: 'uuid-2',
        workflow_id: 'data-export',
        name: 'Data Export',
        description: 'Export workflow',
        container_image: 'hexai/workflow:latest',
        tools: ['export'],
        version: 1,
        is_active: true,
        webhook_url: '',
        webhook_auth_type: '',
        webhook_schema: null,
        session_id_json_path: null,
        created_at: '',
        updated_at: ''
      },
      {
        id: 'uuid-3',
        workflow_id: 'code-review',
        name: 'Code Review',
        description: 'Automated code review',
        container_image: 'hexai/workflow:latest',
        tools: ['github'],
        version: 1,
        is_active: true,
        webhook_url: '',
        webhook_auth_type: '',
        webhook_schema: null,
        session_id_json_path: null,
        created_at: '',
        updated_at: ''
      }
    ];

    cache.setTemplates(mockTemplates);

    // Should find multiple matches for 'data'
    const results = cache.findByName('data');
    assert.strictEqual(results.length, 2);
    assert.ok(results.some(r => r.id === 'uuid-1'));
    assert.ok(results.some(r => r.id === 'uuid-2'));
  });

  test('Should handle empty query in findByName (returns all templates)', () => {
    const cache = new TemplateCache(300);

    const mockTemplates: WorkflowTemplate[] = [
      {
        id: 'uuid-1',
        workflow_id: 'data-analysis',
        name: 'Data Analysis',
        description: 'Analysis workflow',
        container_image: 'hexai/workflow:latest',
        tools: [],
        version: 1,
        is_active: true,
        webhook_url: '',
        webhook_auth_type: '',
        webhook_schema: null,
        session_id_json_path: null,
        created_at: '',
        updated_at: ''
      },
      {
        id: 'uuid-2',
        workflow_id: 'code-review',
        name: 'Code Review',
        description: 'Review workflow',
        container_image: 'hexai/workflow:latest',
        tools: [],
        version: 1,
        is_active: true,
        webhook_url: '',
        webhook_auth_type: '',
        webhook_schema: null,
        session_id_json_path: null,
        created_at: '',
        updated_at: ''
      }
    ];

    cache.setTemplates(mockTemplates);

    // Empty query returns all templates (since '' is included in every string)
    const results = cache.findByName('');
    assert.strictEqual(results.length, 2);
  });

  test('Should match on workflow_id in findByName', () => {
    const cache = new TemplateCache(300);

    const mockTemplates: WorkflowTemplate[] = [
      {
        id: 'uuid-1',
        workflow_id: 'special-workflow',
        name: 'Regular Name',
        description: 'Regular description',
        container_image: 'hexai/workflow:latest',
        tools: [],
        version: 1,
        is_active: true,
        webhook_url: '',
        webhook_auth_type: '',
        webhook_schema: null,
        session_id_json_path: null,
        created_at: '',
        updated_at: ''
      }
    ];

    cache.setTemplates(mockTemplates);

    // Should find by workflow_id
    const results = cache.findByName('special');
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].workflow_id, 'special-workflow');
  });

  test('Should detect stale cache', async () => {
    const cache = new TemplateCache(1); // 1 second timeout

    assert.ok(cache.isStale(), 'Empty cache should be stale');

    cache.setTemplates([]);
    assert.ok(!cache.isStale(), 'Fresh cache should not be stale');

    // Wait for cache to expire
    await new Promise(resolve => setTimeout(resolve, 1100));
    assert.ok(cache.isStale(), 'Expired cache should be stale');
  });
});

suite('Validation Utils Test Suite', () => {
  test('Should validate URLs', () => {
    assert.ok(isValidUrl('http://localhost:8000'));
    assert.ok(isValidUrl('https://api.hexai.io'));
    assert.ok(isValidUrl('http://192.168.1.1:3000'));

    assert.ok(!isValidUrl('not-a-url'));
    assert.ok(!isValidUrl('ftp://files.example.com'));
    assert.ok(!isValidUrl(''));
  });

  test('Should validate session IDs', () => {
    assert.ok(isValidSessionId('session-001'));
    assert.ok(isValidSessionId('feature-login'));
    assert.ok(isValidSessionId('ABC123'));

    assert.ok(!isValidSessionId(''));
    assert.ok(!isValidSessionId('ab')); // too short
    assert.ok(!isValidSessionId('has spaces'));
    assert.ok(!isValidSessionId('has<html>'));
  });

  test('Should parse workflow commands', () => {
    const cmd1 = parseWorkflowCommand('/workflow-data-analysis session-001');
    assert.ok(cmd1);
    assert.strictEqual(cmd1.workflowId, 'data-analysis');
    assert.strictEqual(cmd1.parameters['_positional'], 'session-001');
    assert.strictEqual(cmd1.parameters['issueId'], 'session-001');

    const cmd2 = parseWorkflowCommand('/workflow-bugfix BUG-123 --priority high');
    assert.ok(cmd2);
    assert.strictEqual(cmd2.workflowId, 'bugfix');
    assert.strictEqual(cmd2.parameters['priority'], 'high');

    const cmd3 = parseWorkflowCommand('not a workflow command');
    assert.strictEqual(cmd3, null);
  });
});
