export interface EmailHeader {
    subject: string;
    from?: string;
    to?: string;
    date?: string;
}

export interface EmailAttachment {
    filename: string;
    content: string;
    contentType: string;
    parsedContent?: any;
    extractedText?: string;
}

export interface ParsedEmail {
    headers: EmailHeader;
    body?: string;
    attachments: EmailAttachment[];
}

export interface EmailAnalysis {
    requestType: string;
    priority: 'high' | 'medium' | 'low';
    keyPoints: string[];
    actionItems: string[];
    accountNumber?: string;
    additionalFields: Record<string, string>;
    attachments?: EmailAttachment[];
}

export interface BulkEmailResult {
    file: string;
    status: 'success' | 'error';
    action: 'Jira' | 'ServiceNow' | 'Human Review';
    requestId?: string;
    reason?: string;
    summary?: string;
}
