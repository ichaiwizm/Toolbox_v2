import path from 'path';
import { fileURLToPath } from 'url';

// Obtenir le répertoire courant (équivalent de __dirname en ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration par défaut
export const config = {
    // Taille maximale des fichiers (10 MB par défaut)
    MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024,
    
    // Niveau de logging
    LOG_LEVEL: process.env.TOOLBOX_LOG_LEVEL || 'WARNING',
    
    // Configuration de l'API
    API_PREFIX: '/api/v1',
    DEBUG: (process.env.DEBUG || 'true').toLowerCase() === 'true',
    API_HOST: process.env.API_HOST || '0.0.0.0',
    API_PORT: parseInt(process.env.API_PORT) || 9000,
    
    // Répertoires
    ROOT_DIR: path.resolve(__dirname, '../..'),
    APP_DIR: path.resolve(__dirname, '..'),
    TEMP_DIR: path.resolve(__dirname, '../temp')
};

// Export des constantes individuelles pour compatibilité
export const MAX_FILE_SIZE = config.MAX_FILE_SIZE;
export const API_PREFIX = config.API_PREFIX;
export const DEBUG = config.DEBUG;
export const API_HOST = config.API_HOST;
export const API_PORT = config.API_PORT;