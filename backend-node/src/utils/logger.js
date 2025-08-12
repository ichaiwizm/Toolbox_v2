import { config } from '../config.js';

// Niveaux de log
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARNING: 2,
    ERROR: 3
};

// Couleurs pour les logs (pour la console)
const LOG_COLORS = {
    DEBUG: '\x1b[36m',    // Cyan
    INFO: '\x1b[32m',     // Vert
    WARNING: '\x1b[33m',  // Jaune
    ERROR: '\x1b[31m',    // Rouge
    RESET: '\x1b[0m'      // Reset
};

class Logger {
    constructor(name, level = 'WARNING') {
        this.name = name;
        this.level = LOG_LEVELS[level.toUpperCase()] ?? LOG_LEVELS.WARNING;
    }
    
    /**
     * Formate un message de log
     * @param {string} level - Niveau de log
     * @param {string} message - Message à logger
     * @returns {string} Message formaté
     */
    formatMessage(level, message) {
        const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
        return `${timestamp} - ${this.name} - ${level} - ${message}`;
    }
    
    /**
     * Log un message avec un niveau donné
     * @param {string} level - Niveau de log
     * @param {string} message - Message à logger
     */
    log(level, message) {
        const levelNum = LOG_LEVELS[level.toUpperCase()];
        if (levelNum >= this.level) {
            const formattedMessage = this.formatMessage(level, message);
            const color = LOG_COLORS[level.toUpperCase()] || LOG_COLORS.RESET;
            
            // Utiliser console.error pour ERROR et WARNING, console.log pour le reste
            if (level === 'ERROR' || level === 'WARNING') {
                console.error(`${color}${formattedMessage}${LOG_COLORS.RESET}`);
            } else {
                console.log(`${color}${formattedMessage}${LOG_COLORS.RESET}`);
            }
        }
    }
    
    debug(message) {
        this.log('DEBUG', message);
    }
    
    info(message) {
        this.log('INFO', message);
    }
    
    warning(message) {
        this.log('WARNING', message);
    }
    
    // Alias pour compatibilité
    warn(message) {
        this.warning(message);
    }
    
    error(message) {
        this.log('ERROR', message);
    }
}

// Cache des loggers
const loggers = new Map();

/**
 * Crée ou récupère un logger avec un nom donné
 * @param {string} name - Nom du logger
 * @returns {Logger} Instance du logger
 */
export function getLogger(name) {
    if (!loggers.has(name)) {
        loggers.set(name, new Logger(name, config.LOG_LEVEL));
    }
    return loggers.get(name);
}

// Logger par défaut
export const logger = getLogger('toolbox');