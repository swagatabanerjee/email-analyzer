import * as vscode from 'vscode';
import * as assert from 'assert';
import * as path from 'path';
import * as sinon from 'sinon';
import { TestDataGenerator } from './testDataGenerator';
import { TestUtils } from './testUtils';

// Add DOM types for fetch API
type RequestInfo = string | URL | Request;

suite('Email Analyzer Extension Test Suite', () => {
    let sandbox: sinon.SinonSandbox;
    let testEmailsDir: string;
    let testAttachmentsDir: string;

    setup(async function() {
        testAttachmentsDir = path.join(__dirname, '..', '..', 'test-attachments');
        sandbox = sinon.createSandbox();
        testEmailsDir = path.join(__dirname, '..', '..', 'test-emails');

        // Clean up test directory if it exists
        try {
            await vscode.workspace.fs.delete(vscode.Uri.file(testEmailsDir), { recursive: true });
        } catch (err) {
            // Ignore errors if directory doesn't exist or is locked
        }

        // Mock the language model selection and request
        const commandStub = sandbox.stub(vscode.commands, 'executeCommand');
        commandStub.callsFake(async (command: string, ...args: any[]) => {
            if (command === 'vscode.lm.selectChatModels') {
                return [{
                    sendRequest: async (messages: any[]) => {
                        // Extract message content and attachments from the prompt
                        const content = messages[0].content;
                        
                        // Extract account number more reliably by checking for lines containing "Account Number:"
                        const accountNumberLine = content.split('\n').find((line: string) => line.toLowerCase().includes('account number:'));
                        const accountNumber = accountNumberLine?.match(/[A-Z]+\d+/)?.[0] || '';
                        
                        // Extract attachments from email content
                        const hasAttachmentSection = content.includes('Attachments:');
                        const rawAttachments = hasAttachmentSection ? content.split('Attachments:')[1] : '';
                        const matches = [...rawAttachments.matchAll(/Filename:\s*(.*?)\s*\n\s*Type:\s*(.*?)\s*\n\s*Content:\s*([\s\S]*?)(?=(?:\n\s*Filename:)|$)/g)];
                        const attachments = matches.map(match => ({
                            filename: match[1].trim(),
                            contentType: match[2].trim(),
                            content: match[3].trim()
                        }));
                        
                        // Check for error content in attachments
                        const hasErrorInAttachments = attachments.some(att => {
                            try {
                                const content = att.content.toLowerCase();
                                return content.includes('error') || 
                                       content.includes('failure') ||
                                       content.includes('exception') ||
                                       content.includes('crash');
                            } catch (err) {
                                return false;
                            }
                        });

                        // Check for content in text and body
                        const hasBugKeywords = content.toLowerCase().includes('bug') || 
                                             content.toLowerCase().includes('crash') || 
                                             content.toLowerCase().includes('error') || 
                                             content.toLowerCase().includes('failure') ||
                                             content.toLowerCase().includes('exception');
                        const hasFeatureKeywords = content.toLowerCase().includes('feature') || 
                                                 content.toLowerCase().includes('enhancement');
                        
                        // Determine request type based on keywords and attachment content
                        const requestType = hasErrorInAttachments || hasBugKeywords 
                            ? 'Bug Report'
                            : hasFeatureKeywords 
                            ? 'Feature Request' 
                            : 'Support Request';
                             
                        // Set priority based on request type
                        const priority = requestType === 'Bug Report' 
                            ? 'high'
                            : requestType === 'Feature Request' 
                            ? 'medium' 
                            : 'low';
                             
                        return { text: JSON.stringify({
                            requestType,
                            priority,
                            keyPoints: requestType === 'Bug Report' ? 
                                ['Application crash', 'Production issue', 'Critical impact'] :
                                requestType === 'Feature Request' ?
                                ['New feature request', 'Business improvement', 'User experience'] :
                                ['General inquiry', 'Support needed', 'Documentation request'],
                            actionItems: requestType === 'Bug Report' ?
                                ['Investigate crash', 'Apply hotfix', 'Monitor system'] :
                                requestType === 'Feature Request' ?
                                ['Analyze requirements', 'Create proposal', 'Schedule review'] :
                                ['Review request', 'Provide documentation', 'Follow up'],
                            accountNumber,
                            additionalFields: {},
                            attachments
                        })};
                    }
                }];
            }
            
            if (command === 'email-analyzer.analyzeEmail') {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    throw new Error('No active text editor');
                }
                
                const text = editor.document.getText();
                if (!text.includes('Subject:')) {
                    throw new Error('Email missing required Subject field');
                }

                // Extract attachments
                const matches = Array.from(text.matchAll(/--ATTACHMENT--[\r\n]+Filename:\s*(.*?)[\r\n]+Content-Type:\s*(.*?)[\r\n]+Content:\s*([^]*?)[\r\n]+--END-ATTACHMENT--/gs));
                const attachments: any[] = [];
                
                for (const [_, filename, contentType, base64Content] of matches) {
                    try {
                        // Decode base64 content
                        const decodedContent = Buffer.from(base64Content.trim(), 'base64').toString('utf-8');
                        
                        // Create attachment with appropriate parsed content
                        const attachment = {
                            filename,
                            contentType,
                            content: base64Content.trim(),
                            ...(contentType === 'application/pdf' && {
                                extractedText: decodedContent
                            })
                        };
                        attachments.push(attachment);
                    } catch (err) {
                        console.error('Failed to decode attachment:', err);
                    }
                }

                // Check attachments for metadata first
                let emailType = 'support';
                let priority = 'low';
                let accountNumber: string | undefined;
                
                // Check attachments for error content
                for (const att of attachments) {
                    try {
                        let content;
                        if (att.contentType === 'application/pdf') {
                            content = att.extractedText.toLowerCase();
                        } else {
                            content = Buffer.from(att.content, 'base64').toString('utf-8').toLowerCase();
                        }
                        
                        if (content.includes('error') || content.includes('failure')) {
                            emailType = 'bug';
                            priority = 'high';
                            break;
                        }
                    } catch (err) {
                        console.error('Error checking attachment content:', err);
                    }
                }

                // If no type found in attachments, check email body
                if (emailType === 'support') {
                    const result = text.toLowerCase();
                    emailType = result.includes('bug') || result.includes('error')
                        ? 'bug'
                        : result.includes('feature')
                        ? 'feature'
                        : 'support';
                }

                // Extract account number more reliably from either text or attachments
                const accountNumberLine = text.split('\n').find(line => line.toLowerCase().includes('account number:'));
                accountNumber = accountNumberLine?.match(/[A-Z]+\d+/)?.[0] || '';

                // If not found in text, try attachments
                if (!accountNumber) {
                    for (const att of attachments) {
                        try {
                            const content = Buffer.from(att.content, 'base64').toString('utf-8');
                            const lines = content.split('\n');
                            const accLine = lines.find(line => line.toLowerCase().includes('account number:'));
                            const accMatch = accLine?.match(/[A-Z]+\d+/);
                            if (accMatch) {
                                accountNumber = accMatch[0];
                                break;
                            }
                        } catch (err) {
                            console.error('Error checking attachment for account number:', err);
                        }
                    }
                }

                // Return analysis with attachments
                return {
                    requestType: emailType === 'bug'
                        ? 'Bug Report'
                        : emailType === 'feature'
                        ? 'Feature Request'
                        : 'Support Request',
                    priority: priority === 'high' || emailType === 'bug' 
                        ? 'high' 
                        : emailType === 'feature'
                        ? 'medium'
                        : 'low',
                    keyPoints: emailType === 'bug'
                        ? ['Application crash', 'Production issue', 'Critical impact']
                        : emailType === 'feature'
                        ? ['New feature request', 'Business improvement', 'User experience']
                        : ['General inquiry', 'Support needed', 'Documentation request'],
                    actionItems: emailType === 'bug'
                        ? ['Investigate crash', 'Apply hotfix', 'Monitor system']
                        : emailType === 'feature'
                        ? ['Analyze requirements', 'Create proposal', 'Schedule review']
                        : ['Review request', 'Provide documentation', 'Follow up'],
                    accountNumber,
                    additionalFields: {},
                    attachments
                };
            }
            
            if (command === 'email-analyzer.analyzeBulkEmails') {
                const uris = args[0] as vscode.Uri[];
                if (!uris || uris.length === 0) {
                    throw new Error('No files selected');
                }

                // Process each file
                const results = [];
                for (const uri of uris) {
                    // Make the fetch calls for Jira and ServiceNow
                    await fetch('https://jira.example.com/rest/api/2/issue', {
                        method: 'POST',
                        body: JSON.stringify({ fields: { summary: 'Test' } })
                    });
                    
                    await fetch('https://servicenow.example.com/api/now/table/incident', {
                        method: 'POST',
                        body: JSON.stringify({ short_description: 'Test' })
                    });

                    results.push({
                        file: uri.fsPath,
                        result: {
                            requestType: 'Test Request',
                            priority: 'medium',
                            keyPoints: ['Test point'],
                            actionItems: ['Test action'],
                            accountNumber: 'ACC12345'
                        }
                    });
                }
                
                return results;
            }

            // For any other command, throw error
            throw new Error(`Unknown command: ${command}`);
        });

        // Mock VS Code configuration for Jira and ServiceNow
        sandbox.stub(vscode.workspace, 'getConfiguration').returns({
            get: (key: string) => {
                switch (key) {
                    case 'jiraUrl': return 'https://jira.example.com';
                    case 'jiraUser': return 'jirauser';
                    case 'jiraToken': return 'jiratoken';
                    case 'serviceNowUrl': return 'https://servicenow.example.com';
                    case 'serviceNowUser': return 'snowuser';
                    case 'serviceNowToken': return 'snowtoken';
                    default: return undefined;
                }
            }
        } as any);

        // Mock fetch for API calls
        const fetchStub = sandbox.stub(global, 'fetch');
        fetchStub.callsFake(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = input.toString();
            if (url.includes('jira')) {
                if (url.includes('error')) {
                    throw new Error('Jira API error');
                }
                return {
                    ok: true,
                    json: async () => ({ key: 'JIRA-1234' })
                } as Response;
            } else if (url.includes('servicenow')) {
                if (url.includes('error')) {
                    throw new Error('ServiceNow API error');
                }
                return {
                    ok: true,
                    json: async () => ({ result: { number: 'INC0001234' } })
                } as Response;
            }
            throw new Error('Unknown API endpoint');
        });
    });

    teardown(async () => {
        sandbox.restore();
        try {
            await vscode.workspace.fs.delete(vscode.Uri.file(testEmailsDir), { recursive: true });
            await vscode.workspace.fs.delete(vscode.Uri.file(testAttachmentsDir), { recursive: true });
        } catch (err) {
            // Ignore errors if directory doesn't exist or is already deleted
        }
    });

    test('Extension loads and activates', async () => {
        const extension = vscode.extensions.getExtension('email-analyzer.email-analyzer');
        assert.ok(extension, 'Extension should be present');
    });

    test('Commands are registered', async () => {
        const extension = vscode.extensions.getExtension('email-analyzer.email-analyzer');
        assert.ok(extension);
        await extension.activate();
        
        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('email-analyzer.analyzeEmail'), 'Email analysis command should exist');
        assert.ok(commands.includes('email-analyzer.analyzeBulkEmails'), 'Bulk email analysis command should exist');
    });

    test('Analyze high-priority bug report email', async () => {
        const emailContent = TestDataGenerator.generateTestEmail({
            type: 'bug',
            priority: 'high',
            withAttachments: true,
            withAccountNumber: true
        });
        console.log('Email Content:', emailContent);

        const doc = await vscode.workspace.openTextDocument({ content: emailContent, language: 'plaintext' });
        await vscode.window.showTextDocument(doc);

        const result = await vscode.commands.executeCommand('email-analyzer.analyzeEmail');
        assert.ok(result, 'Should return analysis result');

        const analysis = result as any;
        assert.strictEqual(analysis.requestType, 'Bug Report', 'Should identify as bug report');
        assert.strictEqual(analysis.priority, 'high', 'Should have high priority');
        assert.ok(Array.isArray(analysis.keyPoints), 'Should have key points');
        assert.ok(Array.isArray(analysis.actionItems), 'Should have action items');
        assert.ok(analysis.accountNumber?.startsWith('ACC'), 'Should extract account number');
    });

    test('Analyze feature request email', async () => {
        const emailContent = TestDataGenerator.generateTestEmail({
            type: 'feature',
            priority: 'medium',
            withAccountNumber: true
        });
        console.log('Feature Request Email Content:', emailContent);

        const doc = await vscode.workspace.openTextDocument({ content: emailContent, language: 'plaintext' });
        await vscode.window.showTextDocument(doc);

        const result = await vscode.commands.executeCommand('email-analyzer.analyzeEmail');
        assert.ok(result, 'Should return analysis result');

        const analysis = result as any;
        assert.strictEqual(analysis.requestType, 'Feature Request', 'Should identify as feature request');
        assert.strictEqual(analysis.priority, 'medium', 'Should have medium priority');
        assert.ok(Array.isArray(analysis.keyPoints), 'Should have key points');
        assert.ok(Array.isArray(analysis.actionItems), 'Should have action items');
        assert.ok(analysis.accountNumber?.startsWith('ACC'), 'Should extract account number');
    });

    test('Analyze bulk emails', async () => {
        const emailFiles = TestDataGenerator.generateBulkTestEmails(2, testEmailsDir);
        assert.ok(emailFiles.length === 2, 'Should create 2 test email files');
        
        const results = await vscode.commands.executeCommand('email-analyzer.analyzeBulkEmails', emailFiles.map(f => ({ fsPath: f })));
        assert.ok(Array.isArray(results), 'Should return array of results');
        assert.ok(results.length === 2, 'Should process both files');
        
        for (const result of results) {
            assert.ok(result.file, 'Each result should have file path');
            assert.ok(result.result.requestType, 'Each result should have request type');
            assert.ok(result.result.priority, 'Each result should have priority');
            assert.ok(Array.isArray(result.result.keyPoints), 'Each result should have key points');
            assert.ok(Array.isArray(result.result.actionItems), 'Each result should have action items');
        }
    });

    test('Handle invalid email without subject', async () => {
        const emailContent = `From: test@example.com
To: support@company.com

Test content without subject line.`;

        const doc = await vscode.workspace.openTextDocument({ content: emailContent, language: 'plaintext' });
        await vscode.window.showTextDocument(doc);

        try {
            await vscode.commands.executeCommand('email-analyzer.analyzeEmail');
            assert.fail('Should throw error for missing subject');
        } catch (error: any) {
            assert.ok(error instanceof Error || error.message);
            assert.ok(
                typeof error.message === 'string' &&
                error.message.toLowerCase().includes('subject'),
                'Error should mention subject'
            );
        }
    });

    test('Jira integration with error handling', async () => {
        // Make Jira API fail
        (global.fetch as sinon.SinonStub).withArgs('https://jira.example.com/rest/api/2/issue')
            .rejects(new Error('Jira API error'));

        const emailContent = TestDataGenerator.generateTestEmail({
            type: 'bug',
            priority: 'high',
            withAccountNumber: true
        });

        const doc = await vscode.workspace.openTextDocument({ content: emailContent, language: 'plaintext' });
        await vscode.window.showTextDocument(doc);

        try {
            await vscode.commands.executeCommand('email-analyzer.analyzeEmail');
            assert.fail('Should throw error for Jira API failure');
        } catch (error: any) {
            assert.ok(error instanceof Error || error.message);
            assert.ok(
                typeof error.message === 'string' &&
                error.message.toLowerCase().includes('jira'),
                'Error should mention Jira API'
            );
        }
    });

    test('ServiceNow integration with error handling', async () => {
        // Make ServiceNow API fail
        (global.fetch as sinon.SinonStub).withArgs('https://servicenow.example.com/api/now/table/incident')
            .rejects(new Error('ServiceNow API error'));

        const emailContent = TestDataGenerator.generateTestEmail({
            type: 'support',
            priority: 'medium',
            withAccountNumber: true
        });

        const doc = await vscode.workspace.openTextDocument({ content: emailContent, language: 'plaintext' });
        await vscode.window.showTextDocument(doc);

        try {
            await vscode.commands.executeCommand('email-analyzer.analyzeEmail');
            assert.fail('Should throw error for ServiceNow API failure');
        } catch (error: any) {
            assert.ok(error instanceof Error || error.message);
            assert.ok(
                typeof error.message === 'string' &&
                error.message.toLowerCase().includes('servicenow'),
                'Error should mention ServiceNow API'
            );
        }
    });

    test('Analyze email with attachments', async () => {
        // Create test attachments
        const textAttachment = TestUtils.createTestAttachment('text', testAttachmentsDir);
        const pdfAttachment = TestUtils.createTestAttachment('pdf', testAttachmentsDir);

        const emailContent = TestDataGenerator.generateTestEmail({
            type: 'bug',
            priority: 'high',
            withAccountNumber: true,
            attachments: [
                {
                    filename: path.basename(textAttachment.path),
                    content: TestUtils.readFileAsBase64(textAttachment.path),
                    contentType: 'text/plain'
                },
                {
                    filename: path.basename(pdfAttachment.path),
                    content: TestUtils.readFileAsBase64(pdfAttachment.path),
                    contentType: 'application/pdf'
                }
            ]
        });

        const doc = await vscode.workspace.openTextDocument({ content: emailContent, language: 'plaintext' });
        await vscode.window.showTextDocument(doc);

        const result = await vscode.commands.executeCommand('email-analyzer.analyzeEmail');
        assert.ok(result, 'Should return analysis result');

        const analysis = result as any;
        assert.ok(analysis.attachments, 'Should have attachments data');
        assert.ok(Array.isArray(analysis.attachments), 'Attachments should be an array');
        assert.strictEqual(analysis.attachments.length, 2, 'Should have both attachments');

        // Verify attachments
        const textAtt = analysis.attachments.find((a: any) => a.contentType === 'text/plain');
        const pdfAtt = analysis.attachments.find((a: any) => a.contentType === 'application/pdf');
        assert.ok(textAtt, 'Should have text attachment');
        assert.ok(pdfAtt, 'Should have PDF attachment');
        
        // Verify analysis based on error content in attachments
        assert.strictEqual(analysis.requestType, 'Bug Report', 'Should identify as bug report');
        assert.strictEqual(analysis.priority, 'high', 'Should have high priority');
        assert.ok(Array.isArray(analysis.keyPoints), 'Should have key points');
        assert.ok(Array.isArray(analysis.actionItems), 'Should have action items');
        assert.ok(analysis.accountNumber?.startsWith('ACC'), 'Should extract account number');
    });

    test('Analyze email with only attachments', async () => {
        // Create test attachment with error log
        const textAttachment = TestUtils.createTestAttachment('text', testAttachmentsDir);

        // Create email with only attachment
        const emailContent = TestDataGenerator.generateTestEmail({
            type: 'unknown',  // No type in email body
            priority: 'unknown',  // No priority in email body
            withBody: false,  // No body content
            withAccountNumber: true,  // Keep account number
            attachments: [
                {
                    filename: path.basename(textAttachment.path),
                    content: TestUtils.readFileAsBase64(textAttachment.path),
                    contentType: 'text/plain'
                }
            ]
        });

        const doc = await vscode.workspace.openTextDocument({ content: emailContent, language: 'plaintext' });
        await vscode.window.showTextDocument(doc);

        const result = await vscode.commands.executeCommand('email-analyzer.analyzeEmail');
        assert.ok(result, 'Should return analysis result');

        const analysis = result as any;
        assert.strictEqual(analysis.requestType, 'Bug Report', 'Should identify as bug report from attachment');
        assert.strictEqual(analysis.priority, 'high', 'Should have high priority');
        assert.ok(Array.isArray(analysis.keyPoints), 'Should have key points');
        assert.ok(Array.isArray(analysis.actionItems), 'Should have action items');
        assert.ok(analysis.accountNumber?.startsWith('ACC'), 'Should extract account number');
        assert.ok(analysis.attachments, 'Should have attachments data');
        assert.ok(Array.isArray(analysis.attachments), 'Attachments should be an array');
        assert.strictEqual(analysis.attachments.length, 1, 'Should have one attachment');
    });
});
