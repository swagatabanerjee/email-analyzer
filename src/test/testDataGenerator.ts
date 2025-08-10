import * as fs from 'fs';
import * as path from 'path';

interface Attachment {
    filename: string;
    content: string;
    contentType: string;
}

interface TestEmailData {
    type: 'bug' | 'feature' | 'support' | 'general' | 'unknown';
    priority: 'high' | 'medium' | 'low' | 'unknown';
    withBody?: boolean;
    withAttachments?: boolean;
    withAccountNumber?: boolean;
    attachments?: Attachment[];
}

export class TestDataGenerator {
    private static readonly SUBJECTS = {
        bug: [
            'Critical Bug: Application Crash in Production',
            'Urgent: Database Connection Issue',
            'Error: API Authentication Failure',
            'Bug Report: Memory Leak in Service',
            'Issue: Performance Degradation'
        ],
        feature: [
            'Feature Request: Dark Mode Implementation',
            'Enhancement: Add Export to PDF',
            'New Feature: Multi-factor Authentication',
            'Request: Bulk Import Functionality',
            'Suggestion: Dashboard Customization'
        ],
        support: [
            'Support: Unable to Access Account',
            'Help Needed: Configuration Issues',
            'Question: API Integration Steps',
            'Assistance: Deployment Process',
            'Support Request: User Management'
        ],
        general: [
            'Monthly Usage Report',
            'Account Status Update',
            'Team Access Request',
            'Service Review Meeting Notes',
            'Documentation Update'
        ]
    };

    private static readonly PRIORITIES = {
        high: [
            'Production system down',
            'Data loss risk',
            'Security vulnerability',
            'Critical business impact',
            'Customer-facing issue'
        ],
        medium: [
            'Feature enhancement',
            'Performance optimization',
            'UI/UX improvement',
            'Documentation update',
            'Internal tool issue'
        ],
        low: [
            'Minor cosmetic issue',
            'Non-urgent enhancement',
            'Documentation typo',
            'Optional feature request',
            'Future consideration'
        ]
    };

    private static readonly ACCOUNT_NUMBERS = [
        'ACC123456',
        'ACC789012',
        'ACC345678',
        'ACC901234',
        'ACC567890'
    ];

    private static readonly ATTACHMENTS = [
        {
            name: 'error_log.txt',
            type: 'text/plain',
            content: 'Error: NullPointerException at line 120\nStack trace: ...'
        },
        {
            name: 'screenshot.png',
            type: 'image/png',
            content: 'Base64EncodedImageContent...'
        },
        {
            name: 'config.json',
            type: 'application/json',
            content: '{"debug": true, "environment": "production"}'
        }
    ];

    static generateTestEmail(options: TestEmailData): string {
        const subject = options.type === 'unknown' ? 'No Subject' : 
            this.SUBJECTS[options.type][Math.floor(Math.random() * this.SUBJECTS[options.type].length)];
        const priorityDetails = options.priority === 'unknown' ? '' :
            this.PRIORITIES[options.priority][Math.floor(Math.random() * this.PRIORITIES[options.priority].length)];
        const accountNumber = options.withAccountNumber ? 
            this.ACCOUNT_NUMBERS[Math.floor(Math.random() * this.ACCOUNT_NUMBERS.length)] : 
            undefined;

        let email = `Subject: ${subject}\n`;
        email += `From: test@example.com\n`;
        email += `To: support@company.com\n`;
        email += `Date: ${new Date().toISOString()}\n\n`;
        
        if (options.withBody !== false) {
            email += `Dear Support Team,\n\n`;
            if (options.type !== 'unknown' && options.priority !== 'unknown') {
                email += `${this.generateEmailBody(options.type, options.priority, priorityDetails)}\n\n`;
            }
        }
        
        if (accountNumber) {
            email += `Account Number: ${accountNumber}\n`;
        }

        if (options.attachments) {
            // Use provided attachments
            for (const attachment of options.attachments) {
                email += `\n--ATTACHMENT--\nFilename: ${attachment.filename}\nContent-Type: ${attachment.contentType}\nContent: ${attachment.content}\n--END-ATTACHMENT--\n`;
            }
        } else if (options.withAttachments) {
            // Use default attachments
            for (const attachment of this.ATTACHMENTS) {
                email += `\n--ATTACHMENT--\n`;
                email += `Filename: ${attachment.name}\n`;
                email += `Content-Type: ${attachment.type}\n`;
                email += `Content: ${attachment.content}\n`;
                email += `--END-ATTACHMENT--\n`;
            }
        }

        return email;
    }

    static generateBulkTestEmails(count: number, testDir: string): string[] {
        const types: TestEmailData['type'][] = ['bug', 'feature', 'support', 'general'];
        const priorities: TestEmailData['priority'][] = ['high', 'medium', 'low'];
        const filePaths: string[] = [];

        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }

        for (let i = 0; i < count; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            const priority = priorities[Math.floor(Math.random() * priorities.length)];
            const emailData = this.generateTestEmail({
                type,
                priority,
                withAttachments: Math.random() > 0.5,
                withAccountNumber: Math.random() > 0.3
            });

            const filePath = path.join(testDir, `test_email_${i + 1}.eml`);
            fs.writeFileSync(filePath, emailData);
            filePaths.push(filePath);
        }

        return filePaths;
    }

    private static generateEmailBody(type: TestEmailData['type'], priority: TestEmailData['priority'], details: string): string {
        let body = '';
        
        switch (type) {
            case 'bug':
                body = `I am reporting a ${priority} priority issue in our system.\n\n`;
                body += `Issue Details: ${details}\n\n`;
                body += `Impact: ${this.getImpactDescription(priority)}\n`;
                body += `Environment: Production\n`;
                body += `Steps to Reproduce:\n1. [Step 1]\n2. [Step 2]\n3. [Step 3]`;
                break;

            case 'feature':
                body = `I would like to request a new feature with ${priority} priority.\n\n`;
                body += `Feature Details: ${details}\n\n`;
                body += `Business Value: ${this.getBusinessValue(priority)}\n`;
                body += `Target Users: [User Group]\n`;
                body += `Proposed Timeline: ${this.getProposedTimeline(priority)}`;
                break;

            case 'support':
                body = `I need assistance with the following ${priority} priority issue:\n\n`;
                body += `${details}\n\n`;
                body += `Current Status: ${this.getCurrentStatus(priority)}\n`;
                body += `Last Action Taken: [Action]\n`;
                body += `Expected Outcome: [Outcome]`;
                break;

            case 'general':
                body = `This is a general communication regarding ${details}.\n\n`;
                body += `Context: ${this.getGeneralContext()}\n`;
                body += `Next Steps: [Steps]\n`;
                body += `Timeline: [Timeline]`;
                break;
        }

        return body;
    }

    private static getImpactDescription(priority: TestEmailData['priority']): string {
        switch (priority) {
            case 'high': return 'System-wide impact affecting multiple users';
            case 'medium': return 'Limited impact affecting specific functionality';
            case 'low': return 'Minimal impact on system usage';
            default: return 'Impact unknown';
        }
    }

    private static getBusinessValue(priority: TestEmailData['priority']): string {
        switch (priority) {
            case 'high': return 'Critical for business operations';
            case 'medium': return 'Significant improvement to workflow';
            case 'low': return 'Quality of life enhancement';
            default: return 'Business value undefined';
        }
    }

    private static getProposedTimeline(priority: TestEmailData['priority']): string {
        switch (priority) {
            case 'high': return 'Next 2 weeks';
            case 'medium': return 'Next quarter';
            case 'low': return 'Future roadmap';
            default: return 'Timeline undefined';
        }
    }

    private static getCurrentStatus(priority: TestEmailData['priority']): string {
        switch (priority) {
            case 'high': return 'System unusable';
            case 'medium': return 'Workaround available';
            case 'low': return 'Alternative solution in place';
            default: return 'Status unknown';
        }
    }

    private static getGeneralContext(): string {
        return [
            'Regular system maintenance',
            'Process improvement initiative',
            'Team collaboration update',
            'Project status report',
            'Quarterly review'
        ][Math.floor(Math.random() * 5)];
    }
}
