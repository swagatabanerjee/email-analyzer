import * as vscode from 'vscode';
import * as assert from 'assert';
import * as path from 'path';
import * as sinon from 'sinon';
import { ChatCommandHandler } from '../chat/chatCommandHandler';
import { readFileSync } from 'fs';

suite('Email Analyzer Chat Command Test Suite', () => {
    let sandbox: sinon.SinonSandbox;
    let chatHandler: ChatCommandHandler;
    let testEmailsDir: string;

    setup(() => {
        sandbox = sinon.createSandbox();
        chatHandler = new ChatCommandHandler();
        testEmailsDir = path.join(__dirname, '..', '..', 'src', 'test', 'test-emails');

        // Mock VS Code chat command
        sandbox.stub(vscode.commands, 'executeCommand').callsFake(async (command: string, ...args: any[]) => {
            if (command === 'vscode.chat.open') {
                const emailContent = args[0];
                // Simulate chat response based on email content
                // Mock responses based on email content
                if (emailContent.includes('incomplete')) {
                    return '{}'; // Force empty response for incomplete-report.txt
                } else if (emailContent.includes('Password Reset')) {
                    return JSON.stringify({
                        requestType: 'Support Request',
                        priority: 'high',
                        keyPoints: ['Password reset not working', 'Email delivery issue', '30 minute delay'],
                        actionItems: ['Check email service', 'Verify user account', 'Reset password manually'],
                        accountNumber: 'ACC456789',
                        customerId: 'CUST789',
                        subject: 'Password Reset Not Working',
                        content: emailContent
                    });
                } else if (emailContent.includes('BUG')) {
                    return JSON.stringify({
                        requestType: 'Bug Report',
                        priority: 'high',
                        keyPoints: ['Authentication failure', 'Production impact', 'All users affected'],
                        actionItems: ['Investigate auth service', 'Deploy hotfix', 'Monitor metrics'],
                        accountNumber: 'ACC123456',
                        customerId: 'CUST789',
                        subject: '[BUG] Critical Authentication Failure',
                        content: emailContent
                    });
                } else if (emailContent.includes('Feature Request')) {
                    return JSON.stringify({
                        requestType: 'Feature Request',
                        priority: 'medium',
                        keyPoints: ['Dark mode support', 'User preference', 'System integration'],
                        actionItems: ['Design review', 'Implementation plan', 'User testing'],
                        accountNumber: 'ACC789012',
                        customerId: 'CUST456',
                        subject: '[Feature Request] Dark Mode Implementation',
                        content: emailContent
                    });
                }
                // Add more response patterns as needed
                return '{}';
            }
            if (command === 'jira.createIssue') {
                return { key: 'PROJ-123' };
            }
            if (command === 'servicenow.createTicket') {
                return { number: 'INC0001234' };
            }
            return undefined;
        });
    });

    teardown(() => {
        sandbox.restore();
    });

    test('Handle Jira bug report via chat command', async () => {
        const emailContent = readFileSync(path.join(testEmailsDir, 'jira-bug.txt'), 'utf8');
        
        // Set up the active editor with the test content
        const document = await vscode.workspace.openTextDocument({ content: emailContent });
        await vscode.window.showTextDocument(document);

        const result = await chatHandler.handleChatCommand({
            command: '/start',
            participants: ['user'],
            prompt: 'Analyze this email'
        });

        assert.ok(result.includes('Jira ticket created: PROJ-123'));
    });

    test('Handle ServiceNow incident via chat command', async () => {
        const emailContent = readFileSync(path.join(testEmailsDir, 'servicenow-incident.txt'), 'utf8');
        
        // Set up the active editor with the test content
        const document = await vscode.workspace.openTextDocument({ content: emailContent, language: 'plaintext' });
        const editor = await vscode.window.showTextDocument(document);
        
        // Ensure content is set and visible
        await new Promise(resolve => setTimeout(resolve, 100));

        const result = await chatHandler.handleChatCommand({
            command: '/start',
            participants: ['user'],
            prompt: 'Analyze this email'
        });

        assert.ok(result.includes('ServiceNow incident created: INC0001234'));
    });

    test('Handle incomplete email report', async () => {
        const emailContent = readFileSync(path.join(testEmailsDir, 'incomplete-report.txt'), 'utf8');
        
        const document = await vscode.workspace.openTextDocument({ content: emailContent });
        await vscode.window.showTextDocument(document);

        const result = await chatHandler.handleChatCommand({
            command: '/start',
            participants: ['user'],
            prompt: 'Analyze this email'
        });

        assert.ok(result.includes('queued for human review'));
        const queue = chatHandler.getHumanReviewQueue();
        assert.strictEqual(queue.length, 1);
        assert.ok(queue[0].missingFields.includes('Analysis Failed'));
    });

    test('Handle bulk email analysis', async () => {
        // Mock workspace.findFiles to return multiple test files
        sandbox.stub(vscode.workspace, 'findFiles').resolves([
            vscode.Uri.file(path.join(testEmailsDir, 'jira-bug.txt')),
            vscode.Uri.file(path.join(testEmailsDir, 'servicenow-incident.txt'))
        ]);

        const result = await chatHandler.handleChatCommand({
            command: '/start',
            participants: ['user'],
            prompt: 'Analyze all emails'
        });

        assert.ok(result.includes('Processed 2 files'));
    });

    test('Handle invalid command', async () => {
        const result = await chatHandler.handleChatCommand({
            command: '/invalid',
            participants: ['user'],
            prompt: 'Invalid command'
        });

        assert.strictEqual(result, 'Unknown command. Available commands: /start');
    });
});
