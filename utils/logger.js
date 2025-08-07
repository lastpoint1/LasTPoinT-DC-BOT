const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logsDir = path.join(__dirname, '..', 'logs');
        this.ensureLogsDirectory();
    }

    ensureLogsDirectory() {
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }
    }

    formatDate() {
        const now = new Date();
        return now.toISOString().replace('T', ' ').substring(0, 19);
    }

    formatMessage(level, message, error = null) {
        const timestamp = this.formatDate();
        const errorDetail = error ? `\nHata Detayı: ${error.stack || error}` : '';
        return `[${timestamp}] [${level.toUpperCase()}] ${message}${errorDetail}`;
    }

    writeToFile(level, message) {
        const today = new Date().toISOString().split('T')[0];
        const filename = `bot-${today}.log`;
        const filepath = path.join(this.logsDir, filename);
        
        try {
            fs.appendFileSync(filepath, message + '\n');
        } catch (error) {
            console.error('Log dosyasına yazılamadı:', error);
        }
    }

    log(level, message, error = null) {
        const formattedMessage = this.formatMessage(level, message, error);
        
        // Konsola yazdır
        switch (level) {
            case 'error':
                console.error(formattedMessage);
                break;
            case 'warn':
                console.warn(formattedMessage);
                break;
            case 'info':
                console.info(formattedMessage);
                break;
            default:
                console.log(formattedMessage);
        }
        
        // Dosyaya yazdır
        this.writeToFile(level, formattedMessage);
    }

    info(message) {
        this.log('info', message);
    }

    warn(message, error = null) {
        this.log('warn', message, error);
    }

    error(message, error = null) {
        this.log('error', message, error);
    }

    debug(message) {
        if (process.env.NODE_ENV === 'development') {
            this.log('debug', message);
        }
    }

    // Log dosyalarını temizle (30 günden eski olanları)
    cleanOldLogs() {
        try {
            const files = fs.readdirSync(this.logsDir);
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            files.forEach(file => {
                if (file.startsWith('bot-') && file.endsWith('.log')) {
                    const filePath = path.join(this.logsDir, file);
                    const stats = fs.statSync(filePath);
                    
                    if (stats.mtime < thirtyDaysAgo) {
                        fs.unlinkSync(filePath);
                        this.info(`Eski log dosyası silindi: ${file}`);
                    }
                }
            });
        } catch (error) {
            this.error('Log temizleme hatası:', error);
        }
    }
}

// Singleton instance
const logger = new Logger();

// Günlük log temizliği (24 saatte bir)
setInterval(() => {
    logger.cleanOldLogs();
}, 24 * 60 * 60 * 1000);

module.exports = logger;
