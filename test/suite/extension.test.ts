import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('hexai.hexai-awp-connector'));
  });

  test('Commands should be registered', async () => {
    // Ensure extension is activated first
    const extension = vscode.extensions.getExtension('hexai.hexai-awp-connector');
    if (extension && !extension.isActive) {
      await extension.activate();
    }

    const commands = await vscode.commands.getCommands(true);

    assert.ok(commands.includes('hexai.connect'), 'hexai.connect should be registered');
    assert.ok(commands.includes('hexai.disconnect'), 'hexai.disconnect should be registered');
    assert.ok(commands.includes('hexai.listWorkflows'), 'hexai.listWorkflows should be registered');
    assert.ok(commands.includes('hexai.executeWorkflow'), 'hexai.executeWorkflow should be registered');
    assert.ok(commands.includes('hexai.refreshTemplates'), 'hexai.refreshTemplates should be registered');
    assert.ok(commands.includes('hexai.showOutput'), 'hexai.showOutput should be registered');
  });

  test('Configuration should have default values', () => {
    const config = vscode.workspace.getConfiguration('hexai');

    assert.strictEqual(config.get('serverUrl'), 'http://localhost:8000');
    assert.strictEqual(config.get('username'), '');
    assert.strictEqual(config.get('autoConnect'), false);
    assert.strictEqual(config.get('cacheTimeout'), 300);
  });
});
