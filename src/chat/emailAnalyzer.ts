import * as vscode from 'vscode';
import { EmailAnalysis, ParsedEmail } from '../types/emailTypes';

export async function analyzeEmail(emailContent: string): Promise<EmailAnalysis> {
    try {
        // Create chat prompt
        const prompt = `Analyze this email and extract the following information:
1. Request type (e.g., bug report, feature request, support inquiry, etc.)
2. Priority level (high, medium, or low)
3. Key points (max 3)
4. Action items (if any)
5. Account number or Customer ID (if present)
6. Subject and content
7. Any other relevant fields

Email content:
${emailContent}

Return the analysis in this JSON format:
{
    "requestType": "string",
    "priority": "high|medium|low",
    "keyPoints": ["string"],
    "actionItems": ["string"],
    "accountNumber": "string",
    "customerId": "string",
    "subject": "string",
    "content": "string",
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
        return analysis;
    } catch (error) {
        throw error instanceof Error ? error : new Error('Unknown error during analysis');
    }
}
