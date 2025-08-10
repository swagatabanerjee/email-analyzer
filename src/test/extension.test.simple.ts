const vscode = require('vscode');
const path = require('path');
const assert = require('assert');

suite('Email Analyzer Extension Tests', () => {
    vscode.window.showInformationMessage('Starting email analyzer tests.');

    test('Extension activation', async () => {
        // Get the extension
        const extension = vscode.extensions.getExtension('email-analyzer');
        assert.ok(extension, 'Extension should be present');

        // Active the extension if not already activated
        if (!extension.isActive) {
            await extension.activate();
        }
        assert.ok(extension.isActive, 'Extension should be active');
    });

    test('Analyze email command', async () => {
        // Create test email content
        const emailContent = `Subject: Bug Report: Application Crash
From: test@example.com
To: support@example.com

Critical issue in production environment.
Account: ACC123456
Severity: High

Details: Application crashes during peak hours.`;

        // Create and show document
        const document = await vscode.workspace.openTextDocument({
            content: emailContent,
            language: 'plaintext'
        });
        await vscode.window.showTextDocument(document);

        // Execute command
        const result = await vscode.commands.executeCommand('email-analyzer.analyzeEmail');
        
        // Verify result
        assert.ok(result, 'Should return analysis result');
        if (result && typeof result === 'object') {
            const analysis = result as any;
            assert.strictEqual(analysis.requestType.toLowerCase().includes('bug'), true, 'Should identify as bug report');
            assert.strictEqual(analysis.priority, 'high', 'Should be high priority');
            assert.strictEqual(analysis.accountNumber, 'ACC123456', 'Should extract account number');
            assert.ok(Array.isArray(analysis.keyPoints), 'Should have key points');
            assert.ok(Array.isArray(analysis.actionItems), 'Should have action items');
        }
    });

    test('Handle missing subject', async () => {
        // Create email without subject
        const emailContent = `From: test@example.com
To: support@example.com

Test content.`;

        // Create and show document
        const document = await vscode.workspace.openTextDocument({
            content: emailContent,
            language: 'plaintext'
        });
        await vscode.window.showTextDocument(document);

        // Execute command and expect error
        try {
            await vscode.commands.executeCommand('email-analyzer.analyzeEmail');
            assert.fail('Should throw error for missing subject');
        } catch (error) {
            assert.ok(error, 'Should have error');
            if (error instanceof Error) {
                assert.ok(error.message.toLowerCase().includes('subject'), 'Error should mention subject');
            }
        }
    });

    test('Bulk email analysis', async () => {
        // Create test directory
        const testDir = path.join(__dirname, '..', 'test-emails');
        const fs = require('fs');
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir);
        }

        // Create test email files
        const emails = [
            {
                name: 'bug.eml',
                content: `Subject: Bug Report
From: test1@example.com
Account: ACC111
Severity: High

Critical bug.`
            },
            {
                name: 'feature.eml',
                content: `Subject: Feature Request
From: test2@example.com
Account: ACC222
Priority: Medium

New feature needed.`
            }
        ];

        // Write test files
        for (const email of emails) {
            fs.writeFileSync(path.join(testDir, email.name), email.content);
        }

        // Execute command
        await vscode.commands.executeCommand('email-analyzer.analyzeBulkEmails');

        // Clean up
        fs.rmSync(testDir, { recursive: true, force: true });
    });
});
