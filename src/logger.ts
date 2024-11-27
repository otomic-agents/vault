class Logger {
    private formatMessage(level: string, message: string): string {
        const now = new Date().toISOString();
        const stack = new Error().stack;
        const callerLine = stack?.split('\n')[3].trim();
        return `[${now}] [${level}] ${callerLine}: ${message}`;
    }

    log(message: string): void {
        console.log(this.formatMessage('LOG', message));
    }

    info(message: string): void {
        console.info(this.formatMessage('INFO', message));
    }

    warn(message: string): void {
        console.warn(this.formatMessage('WARN', message));
    }

    error(message: string): void {
        console.error(this.formatMessage('ERROR', message));
    }
}

export default new Logger();
