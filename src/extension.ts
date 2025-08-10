import * as vscode from 'vscode';
import { EmailAnalysis, EmailAttachment, EmailHeader, ParsedEmail } from './types/emailTypes';
import { ChatCommandHandler } from './chat/chatCommandHandler';
import { Logger } from './utils/logger';
import * as dotenv from 'dotenv';
dotenv.config();

export function activate(context: vscode.ExtensionContext) {
    // Initialize logger
    Logger.initialize(context);
    Logger.info('Email Analyzer extension is now active');
    
    const chatHandler = new ChatCommandHandler();

    // Register chat handler
    const participant = vscode.chat.createChatParticipant('email-analyzer', async (request, context, response, token) => {
        try {
            // Extract command from the prompt
            const promptText = request.prompt.trim();
            
            // Handle /start command
            if (promptText === '/start') {
                const result = await chatHandler.handleChatCommand({
                    command: '/start',
                    participants: ['user'],
                    prompt: promptText
                });
                response.progress(result);
                return;
            }
            
            // Handle regular messages
            response.progress('Unknown command. Available commands: /start');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            response.progress(errorMessage);
        }
    });
    
    context.subscriptions.push(participant);

    // Register chat commands
    const startCommand = vscode.commands.registerCommand('email-analyzer.start', async () => {
        Logger.debug('Processing /start command');
        return await chatHandler.handleChatCommand({
            command: '/start',
            participants: ['user'],
            prompt: 'Analyze this email'
        });
    });

    // Register the analyze email command
    let analyzeCommand = vscode.commands.registerCommand('email-analyzer.analyzeEmail', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('Please open an email file first.');
            return;
        }

        try {
            const emailContent = editor.document.getText();
            const parsedEmail = parseEmail(emailContent);
            
            if (!parsedEmail.headers.subject) {
                throw new Error('Email subject is mandatory');
            }

            const analysis = await analyzeEmail(parsedEmail);
            displayAnalysis(analysis);
        } catch (error) {
            vscode.window.showErrorMessage(`Error analyzing email: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });

    // Register the bulk analysis command
    let bulkAnalyzeCommand = vscode.commands.registerCommand('email-analyzer.analyzeBulkEmails', async (uris: vscode.Uri[]) => {
        if (!uris || uris.length === 0) {
            vscode.window.showErrorMessage('No files selected for bulk analysis.');
            return;
        }

        try {
            const results = [];
            for (const uri of uris) {
                const doc = await vscode.workspace.openTextDocument(uri);
                const emailContent = doc.getText();
                const parsedEmail = parseEmail(emailContent);
                const analysis = await analyzeEmail(parsedEmail);
                results.push({
                    file: uri.fsPath,
                    result: analysis
                });
            }
            return results;
        } catch (error) {
            vscode.window.showErrorMessage(`Error analyzing emails: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    });

    // Register the chat command
    let chatCommand = vscode.commands.registerCommand('email-analyzer.chat', async (request: any) => {
        if (!request || !request.prompt) {
            return 'Invalid chat request';
        }

        const result = await chatHandler.handleChatCommand({
            command: request.arguments?.[0] || '',
            participants: request.participants || [],
            prompt: request.prompt
        });
        return result;
    });

    context.subscriptions.push(analyzeCommand, bulkAnalyzeCommand, chatCommand);
}

// This method is called when your extension is deactivated
export function deactivate() {}

// Function to parse email content
function parseEmail(content: string): ParsedEmail {
    // Extract headers using regex
    const headerRegex = /^(?<key>[A-Za-z-]+):\s*(?<value>.+)$/gm;
    const headers: EmailHeader = { subject: '' };
    
    // Split content into headers and body
    const [headerSection, ...bodyParts] = content.split('\n\n');
    
    // Parse headers
    for (const match of headerSection.matchAll(headerRegex)) {
        const key = match.groups?.key.toLowerCase();
        const value = match.groups?.value;
        if (key && value) {
            switch (key) {
                case 'subject':
                    headers.subject = value;
                    break;
                case 'from':
                    headers.from = value;
                    break;
                case 'to':
                    headers.to = value;
                    break;
                case 'date':
                    headers.date = value;
                    break;
            }
        }
    }

    // Extract attachments using regex
    const attachments: EmailAttachment[] = [];
    const attachmentRegex = /--ATTACHMENT--\r?\n+Filename:\s*(.*?)\r?\n+Content-Type:\s*(.*?)\r?\n+Content:\s*([^]*?)\r?\n+--END-ATTACHMENT--/gs;
    const bodyContent = bodyParts.join('\n\n');
    const bodyWithoutAttachments = bodyContent.replace(/--ATTACHMENT--[\s\S]*?--END-ATTACHMENT--/g, '');
    
    for (const match of bodyContent.matchAll(attachmentRegex)) {
        const [_, filename, contentType, base64Content] = match;
        try {
            // Decode base64 content
            const decodedContent = Buffer.from(base64Content.trim(), 'base64').toString('utf-8');
            
            // Create attachment with appropriate parsed content
            const attachment: EmailAttachment = {
                filename,
                contentType,
                content: decodedContent,
                ...(contentType === 'text/csv' && {
                    parsedContent: decodedContent.split('\n')
                        .filter(line => line.trim())
                        .map(line => {
                            const [header, ...values] = line.split(',');
                            return { [header.trim()]: values[0]?.trim() };
                        })
                        .reduce((obj: any, item) => ({ ...obj, ...item }), {})
                }),
                ...(contentType === 'application/pdf' && {
                    extractedText: decodedContent
                })
            };
            attachments.push(attachment);
        } catch (err) {
            console.error('Failed to decode attachment:', err);
        }
    }

    return {
        headers,
        body: bodyWithoutAttachments.trim() || undefined,
        attachments
    };
}

async function analyzeEmail(parsedEmail: ParsedEmail): Promise<EmailAnalysis> {
    try {
        // Create chat prompt
        const prompt = `Analyze this email and its attachments to extract the following information:
1. Request type (e.g., bug report, feature request, support inquiry, etc.)
2. Priority level (high, medium, or low)
3. Key points (max 3)
4. Action items (if any)
5. Account number (if present)
6. Any other relevant fields

Email subject: ${parsedEmail.headers.subject}
Email body:
${parsedEmail.body || '(No body content)'}

${parsedEmail.attachments.map(att => `
Attachment: ${att.filename}
Type: ${att.contentType}
Content: ${att.content}
${att.parsedContent ? `Parsed: ${JSON.stringify(att.parsedContent)}` : ''}
${att.extractedText ? `Text: ${att.extractedText}` : ''}`).join('\n')}

Return the analysis in this JSON format:
{
    "requestType": "string",
    "priority": "high|medium|low",
    "keyPoints": ["string"],
    "actionItems": ["string"],
    "accountNumber": "string",
    "additionalFields": {
        "fieldName": "value"
    }
}`;

        // Open VS Code chat and get analysis
        const response = await vscode.commands.executeCommand('vscode.chat.open', prompt);
        if (!response || typeof response !== 'string') {
            throw new Error('Invalid response from chat model');
        }

        // Extract JSON from response
        const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No JSON found in response');
        }

        // Parse and return the analysis
        const analysis = JSON.parse(jsonMatch[1] || jsonMatch[0]) as EmailAnalysis;
        analysis.attachments = parsedEmail.attachments;
        return analysis;
    } catch (error) {
        throw error instanceof Error ? error : new Error('Unknown error during analysis');
    }
}

function displayAnalysis(analysis: EmailAnalysis) {
    const panel = vscode.window.createWebviewPanel(
        'emailAnalysis',
        'Email Analysis',
        vscode.ViewColumn.Beside,
        { enableScripts: true }
    );

    panel.webview.html = `<!DOCTYPE html>
    <html>
        <head>
            <style>
                body { font-family: var(--vscode-font-family); padding: 20px; }
                .section { margin-bottom: 20px; }
                .title { font-weight: bold; margin-bottom: 5px; }
                .priority-high { color: #f14c4c; }
                .priority-medium { color: #e0af4f; }
                .priority-low { color: #3794ff; }
                ul { margin: 0; padding-left: 20px; }
                .field { margin-bottom: 8px; }
                .field-name { color: var(--vscode-textPreformat-foreground); }
            </style>
        </head>
        <body>
            <div class="section">
                <div class="title">Request Type:</div>
                ${analysis.requestType}
            </div>
            <div class="section">
                <div class="title">Priority:</div>
                <span class="priority-${analysis.priority.toLowerCase()}">${analysis.priority}</span>
            </div>
            ${analysis.accountNumber ? `
            <div class="section">
                <div class="title">Account Number:</div>
                ${analysis.accountNumber}
            </div>
            ` : ''}
            <div class="section">
                <div class="title">Key Points:</div>
                <ul>
                    ${analysis.keyPoints.map(point => `<li>${point}</li>`).join('')}
                </ul>
            </div>
            <div class="section">
                <div class="title">Action Items:</div>
                <ul>
                    ${analysis.actionItems.map(item => `<li>${item}</li>`).join('')}
                </ul>
            </div>
            ${Object.keys(analysis.additionalFields).length > 0 ? `
            <div class="section">
                <div class="title">Additional Fields:</div>
                ${Object.entries(analysis.additionalFields).map(([key, value]) => `
                    <div class="field">
                        <span class="field-name">${key}:</span> ${value}
                    </div>
                `).join('')}
            </div>
            ` : ''}
        </body>
    </html>`;
}

