export interface EmailHeader {
    subject: string;
    from?: string;
    to?: string;
    date?: string;
}

export interface EmailAttachment {
    filename: string;
    contentType: string;
    content: string;
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
    accountNumber: string;
    customerId: string;
    subject: string;
    content: string;
    additionalFields: Record<string, string>;
    attachments: EmailAttachment[];
}
