import * as fs from 'fs';
import * as path from 'path';

export class TestUtils {
    static createTestFile(content: string, extension: string, dir: string): string {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const filePath = path.join(dir, `test-file-${Date.now()}${extension}`);
        fs.writeFileSync(filePath, content);
        return filePath;
    }

    static createTestAttachment(type: 'excel' | 'pdf' | 'text', dir: string): { path: string; content: string } {
        const content = type === 'excel' 
            ? 'Request Type,Description,Priority\nBug Report,Critical System Error,High'
            : type === 'pdf'
            ? '[ERROR] Application crash detected\nStack trace: ...\nImpact: High'
            : 'ERROR: System failure detected\nTimestamp: 2025-08-10T10:00:00Z\nStack trace: ...\nSeverity: High';

        const extension = {
            excel: '.csv',
            pdf: '.pdf',
            text: '.txt'
        }[type];

        const filePath = this.createTestFile(content, extension, dir);
        return { path: filePath, content };
    }

    static readFileAsBase64(filePath: string): string {
        const content = fs.readFileSync(filePath);
        return content.toString('base64');
    }

    static cleanup(dir: string): void {
        if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }
}
