import * as vscode from 'vscode';
import { ChatRequest, JiraTicket, ServiceNowTicket, HumanReviewItem } from '../types/chatTypes';
import { EmailAnalysis, EmailAttachment, ParsedEmail } from '../types/emailTypes';
import { analyzeEmail } from './emailAnalyzer';
import { Logger } from '../utils/logger';

export class ChatCommandHandler {
    private humanReviewQueue: HumanReviewItem[] = [];

    async handleChatCommand(request: ChatRequest): Promise<string> {
        Logger.debug(`Handling chat command: ${request.command}`);
        if (request.command !== '/start') {
            return 'Unknown command. Available commands: /start';
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return 'Please open an email file first.';
        }

        try {
            // Determine if we're dealing with single or multiple files
            const selectedFiles = await vscode.workspace.findFiles('**/*.{txt,eml}', '**/node_modules/**');
            if (selectedFiles.length > 1) {
                return await this.handleBulkAnalysis(selectedFiles);
            } else {
                return await this.handleSingleEmailAnalysis(editor.document.getText());
            }
        } catch (error) {
            return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }

    private async handleSingleEmailAnalysis(emailContent: string): Promise<string> {
        let progressMessages: string[] = [];
        const appendProgress = (message: string) => {
            Logger.info(message);
            progressMessages.push(message);
            return progressMessages.join('\n');
        };

        appendProgress('🔍 Starting email analysis...');

        // Analyze email using VS Code chat
        appendProgress('📧 Extracting email data and context...');
        const chatResult = await vscode.commands.executeCommand('vscode.chat.open', emailContent);
        Logger.debug(`Chat result: ${chatResult}`);
        
        const analysis = chatResult && chatResult !== '{}' ? JSON.parse(chatResult as string) : null;
        Logger.debug(`Analysis: ${JSON.stringify(analysis, null, 2)}`);

        // If no analysis was possible or empty response, queue for human review
        if (!analysis || chatResult === '{}') {
            appendProgress('⚠️ Analysis failed - Unable to extract email data');
            this.addToHumanReviewQueue({
                reason: 'Unable to analyze email',
                emailContent,
                missingFields: ['Analysis Failed'],
                partialAnalysis: null
            });
            appendProgress('👤 Email has been queued for human review');
            return progressMessages.join('\n');
        }

        // Log successful analysis
        appendProgress(`✅ Email data extracted successfully:
- Subject: ${analysis.subject}
- Priority: ${analysis.priority}
- Type: ${analysis.requestType}`);

        // Check for required fields
        appendProgress('🔍 Validating required fields...');
        const missingFields = this.validateRequiredFields(analysis);
        if (missingFields.length > 0) {
            appendProgress(`⚠️ Missing required fields: ${missingFields.join(', ')}`);
            this.addToHumanReviewQueue({
                reason: 'Missing required fields',
                emailContent,
                missingFields,
                partialAnalysis: analysis
            });
            appendProgress('👤 Email has been queued for human review');
            return progressMessages.join('\n');
        }
        appendProgress('✅ All required fields validated');

        // Classify and process the request
        appendProgress('🔄 Classifying request type...');
        const ticketType = this.classifyTicketType(analysis);
        
        // Create and submit ticket
        try {
            if (ticketType.startsWith('jira-')) {
                appendProgress(`📋 Creating Jira ${ticketType.split('-')[1]} ticket...`);
                const jiraTicket = this.createJiraTicket(analysis, ticketType.split('-')[1] as JiraTicket['type']);
                const result = await this.submitJiraTicket(jiraTicket);
                appendProgress('✅ Jira ticket created successfully!');
                appendProgress(`\nTicket Details:
🎫 Type: Jira ${ticketType.split('-')[1]}
📝 Subject: ${analysis.subject}
🔑 ID: ${result.split(': ')[1]}
📊 Priority: ${analysis.priority}`);
                return progressMessages.join('\n');
            } else if (ticketType.startsWith('servicenow-')) {
                const type = ticketType.split('-')[1];
                appendProgress(`📋 Creating ServiceNow ${type}...`);
                const snowTicket = this.createServiceNowTicket(analysis, type as ServiceNowTicket['type']);
                let result;
                if (ticketType === 'servicenow-incident') {
                    result = await this.submitServiceNowTicket(snowTicket);
                } else {
                    result = await this.submitServiceNowTicket(snowTicket).then(r => 
                        r.replace('incident', 'ticket')); // Only for non-incident tickets
                }
                appendProgress('✅ ServiceNow ticket created successfully!');
                appendProgress(`\nTicket Details:
🎫 Type: ServiceNow ${type}
📝 Subject: ${analysis.subject}
🔑 ID: ${result.split(': ')[1]}
📊 Priority: ${analysis.priority}`);
                return progressMessages.join('\n');
            }
        } catch (error) {
            appendProgress(`❌ Error creating ticket: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return progressMessages.join('\n');
        }

        appendProgress('⚠️ Email analysis complete, but no ticket was created');
        return progressMessages.join('\n');
    }

    private async handleBulkAnalysis(files: vscode.Uri[]): Promise<string> {
        let progressMessages: string[] = [];
        const appendProgress = (message: string) => {
            Logger.info(message);
            progressMessages.push(message);
            return progressMessages.join('\n');
        };

        appendProgress(`🔄 Starting bulk analysis of ${files.length} emails...\n`);
        const results: any[] = [];
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            appendProgress(`\n📧 Processing email ${i + 1} of ${files.length}...`);
            appendProgress(`📁 File: ${file.fsPath}`);
            
            try {
                const content = (await vscode.workspace.fs.readFile(file)).toString();
                const result = await this.handleSingleEmailAnalysis(content);
                results.push({ file: file.fsPath, result });
                appendProgress('✅ Email processed successfully\n' + '─'.repeat(40));
            } catch (error) {
                appendProgress(`❌ Error processing email: ${error instanceof Error ? error.message : 'Unknown error'}\n` + '─'.repeat(40));
            }
        }

        appendProgress(`\n📊 Summary:
✅ Total emails processed: ${files.length}
🎫 Tickets created: ${results.filter(r => r.result.includes('created successfully')).length}
⚠️ Failed/Queued for review: ${results.filter(r => !r.result.includes('created successfully')).length}`);

        return progressMessages.join('\n');
    }

    private validateRequiredFields(analysis: EmailAnalysis): string[] {
        const missingFields: string[] = [];
        
        if (!analysis.requestType) {
            missingFields.push('Request Type');
        }
        if (!analysis.priority) {
            missingFields.push('Priority');
        }
        if (!analysis.accountNumber && !analysis.customerId) {
            missingFields.push('Account Number/Customer ID');
        }
        if (!analysis.subject) {
            missingFields.push('Subject');
        }

        return missingFields;
    }

    private classifyTicketType(analysis: EmailAnalysis): string {
        const content = analysis.content?.toLowerCase() || '';
        const subject = analysis.subject?.toLowerCase() || '';
        const requestType = analysis.requestType?.toLowerCase() || '';

        if (requestType === 'bug report' || content.includes('bug') || content.includes('crash')) {
            return 'jira-bug';
        } else if (requestType === 'feature request' || content.includes('feature') || subject.includes('feature')) {
            return 'jira-feature';
        } else if (content.includes('epic') || subject.includes('epic')) {
            return 'jira-epic';
        } else if (content.includes('story') || subject.includes('story')) {
            return 'jira-story';
        } else if (content.includes('task') || subject.includes('task')) {
            return 'jira-task';
        } else if (requestType === 'support request' ||
                  content.includes('incident') || 
                  content.includes('error') || 
                  content.includes('broken') ||
                  content.includes('trouble') ||
                  content.includes('not working') ||
                  content.includes('reset')) {
            return 'servicenow-incident';
        } else {
            return 'servicenow-request';
        }
    }

    private createJiraTicket(analysis: EmailAnalysis, type: JiraTicket['type']): JiraTicket {
        return {
            type,
            title: analysis.subject || 'No Subject',
            description: analysis.content,
            priority: analysis.priority,
            accountNumber: analysis.accountNumber,
            customerId: analysis.customerId,
            attachments: analysis.attachments
        };
    }

    private createServiceNowTicket(analysis: EmailAnalysis, type: ServiceNowTicket['type']): ServiceNowTicket {
        return {
            type,
            title: analysis.subject || 'No Subject',
            description: analysis.content,
            priority: analysis.priority,
            accountNumber: analysis.accountNumber,
            customerId: analysis.customerId,
            attachments: analysis.attachments
        };
    }

    private async submitJiraTicket(ticket: JiraTicket): Promise<string> {
        try {
            const response = await vscode.commands.executeCommand('jira.createIssue', ticket);
            const jiraResponse = response as { key: string };
            return `Jira ticket created: ${jiraResponse.key}`;
        } catch (error) {
            throw new Error(`Failed to create Jira ticket: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async submitServiceNowTicket(ticket: ServiceNowTicket): Promise<string> {
        try {
            const response = await vscode.commands.executeCommand('servicenow.createTicket', ticket);
            const snowResponse = response as { number: string };
            return `ServiceNow incident created: ${snowResponse.number}`;
        } catch (error) {
            throw new Error(`Failed to create ServiceNow ticket: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private addToHumanReviewQueue(item: HumanReviewItem): void {
        this.humanReviewQueue.push(item);
        vscode.window.showInformationMessage(`Email queued for human review: ${item.reason}`);
    }

    getHumanReviewQueue(): HumanReviewItem[] {
        return [...this.humanReviewQueue];
    }
}
