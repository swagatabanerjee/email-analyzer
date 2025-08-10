# Email Analyzer for VS Code

A powerful VS Code extension that analyzes emails to extract key information and classify request types using VS Code's Language Model and LlamaIndex. This extension helps you quickly understand and categorize email content, making it easier to manage and prioritize email-based tasks.

## Features

- **Email Analysis**: Automatically analyzes the content of email text to:
  - Determine the request type (e.g., bug report, feature request, support inquiry)
  - Assess priority level (high, medium, low)
  - Extract key points
  - Identify action items

- **Visual Results**: Displays analysis results in a clean, easy-to-read format in a separate panel
- **Smart Classification**: Uses VS Code's built-in language model to intelligently categorize emails
- **Quick Access**: Simple command to analyze any email content in your editor

## Usage

1. Open a file containing email content in VS Code
2. Run the command "Analyze Email" using:
   - Command Palette (Ctrl/Cmd + Shift + P): `Email Analyzer: Analyze Email`
   - Or right-click in the editor and select "Analyze Email"
3. View the analysis results in the side panel

## Requirements

- Visual Studio Code version 1.103.0 or higher
- Active internet connection for language model access

## Privacy

This extension uses VS Code's built-in language model to analyze email content. No email data is stored or transmitted outside of your VS Code environment.

## Known Issues

- The extension requires the email content to be in plain text format
- HTML emails may need to be converted to plain text first

## Release Notes

### 1.0.0

Initial release of Email Analyzer:
- Email content analysis
- Request type classification
- Priority assessment
- Key points extraction
- Action items identification

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**

## Setup Instructions for API Integration

To enable service request logging in Jira and ServiceNow, you must provide API credentials. You can do this using a `.env` file in your workspace root or by setting VS Code settings under `emailAnalyzer`.

### 1. Create a `.env` file

Add a file named `.env` in your project root with the following content:

```
EMAILANALYZER_JIRAURL=https://your-jira-instance.atlassian.net
EMAILANALYZER_JIRAUSER=your-jira-username
EMAILANALYZER_JIRATOKEN=your-jira-api-token
EMAILANALYZER_SERVICENOWURL=https://your-servicenow-instance.service-now.com
EMAILANALYZER_SERVICENOWUSER=your-servicenow-username
EMAILANALYZER_SERVICENOWTOKEN=your-servicenow-api-token
```

### 2. (Optional) VS Code Settings

You can also set these credentials in VS Code settings (`settings.json`):

```
{
  "emailAnalyzer.jiraUrl": "https://your-jira-instance.atlassian.net",
  "emailAnalyzer.jiraUser": "your-jira-username",
  "emailAnalyzer.jiraToken": "your-jira-api-token",
  "emailAnalyzer.serviceNowUrl": "https://your-servicenow-instance.service-now.com",
  "emailAnalyzer.serviceNowUser": "your-servicenow-username",
  "emailAnalyzer.serviceNowToken": "your-servicenow-api-token"
}
```

The extension will use VS Code settings if set, otherwise it will fall back to the `.env` file.

### 3. Security
- Do not commit your `.env` file to version control.
- Keep your API tokens secure.

### 4. Running Bulk Analysis
- Use the command palette: `Email Analyzer: Analyze Bulk Emails`
- Select multiple email files or a folder to process
- The extension will log requests in Jira or ServiceNow, or route to human review as needed
