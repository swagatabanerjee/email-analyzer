import { EmailAttachment } from './emailTypes';

export interface ChatRequest {
    command: string;
    participants: string[];
    prompt?: string;
}

export interface JiraTicket {
    type: 'bug' | 'feature' | 'epic' | 'story' | 'task';
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    accountNumber?: string;
    customerId?: string;
    attachments?: EmailAttachment[];
}

export interface ServiceNowTicket {
    type: 'incident' | 'request';
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    accountNumber?: string;
    customerId?: string;
    attachments?: EmailAttachment[];
}

export interface HumanReviewItem {
    reason: string;
    emailContent: string;
    missingFields: string[];
    partialAnalysis?: any;
}
