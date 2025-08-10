import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class Logger {
    private static outputChannel: vscode.OutputChannel;
    private static logFile: string;
    private static extensionContext: vscode.ExtensionContext;

    public static initialize(context: vscode.ExtensionContext): void {
        this.extensionContext = context;
        this.outputChannel = vscode.window.createOutputChannel('Email Analyzer');
        this.logFile = path.join(context.extensionPath, 'email-analyzer.log');
        
        // Clear the log file on extension activation
        fs.writeFileSync(this.logFile, '');
        
        this.info('Logger initialized');
    }

    public static info(message: string): void {
        this.log('INFO', message);
    }

    public static error(message: string, error?: Error): void {
        this.log('ERROR', message);
        if (error) {
            this.log('ERROR', error.stack || error.message);
        }
    }

    public static debug(message: string): void {
        this.log('DEBUG', message);
    }

    private static log(level: string, message: string): void {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level}] ${message}`;

        // Write to output channel
        this.outputChannel.appendLine(logMessage);

        // Write to log file
        fs.appendFileSync(this.logFile, logMessage + '\n');

        // Show output channel for errors
        if (level === 'ERROR') {
            this.outputChannel.show();
        }
    }

    public static getLogFilePath(): string {
        return this.logFile;
    }

    public static showOutputChannel(): void {
        this.outputChannel.show();
    }
}
