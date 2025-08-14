import fs from 'fs';
import { getLogger } from '../../../utils/logger.js';

const logger = getLogger('toolbox.cache-lock-manager');

/**
 * Gestionnaire de verrous pour les caches distants
 */
export class CacheLockManager {
    constructor(cacheStorage) {
        this.cacheStorage = cacheStorage;
        this.lockExtension = '.lock';
        this.maxLockAge = 30 * 60 * 1000; // 30 minutes
    }

    /**
     * Crée un verrou sur un cache
     * @param {string} cacheKey - Clé de cache
     * @param {string} syncId - ID de synchronisation
     * @returns {string} Chemin du fichier verrou
     */
    createLock(cacheKey, syncId) {
        const cachePath = this.cacheStorage.getCachePath(cacheKey);
        const lockPath = cachePath + this.lockExtension;
        
        const lockData = {
            syncId,
            timestamp: Date.now(),
            pid: process.pid,
            cacheKey
        };
        
        fs.writeFileSync(lockPath, JSON.stringify(lockData, null, 2));
        logger.debug(`Verrou créé: ${lockPath}`);
        
        return lockPath;
    }

    /**
     * Supprime un verrou de cache
     * @param {string} cacheKey - Clé de cache
     */
    removeLock(cacheKey) {
        const cachePath = this.cacheStorage.getCachePath(cacheKey);
        const lockPath = cachePath + this.lockExtension;
        
        if (fs.existsSync(lockPath)) {
            fs.unlinkSync(lockPath);
            logger.debug(`Verrou supprimé: ${lockPath}`);
        }
    }

    /**
     * Vérifie si un cache est verrouillé
     * @param {string} cacheKey - Clé de cache
     * @returns {boolean} True si verrouillé
     */
    isLocked(cacheKey) {
        const cachePath = this.cacheStorage.getCachePath(cacheKey);
        const lockPath = cachePath + this.lockExtension;
        
        if (!fs.existsSync(lockPath)) {
            return false;
        }
        
        // Vérifier si le verrou est expiré
        try {
            const lockData = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
            const lockAge = Date.now() - lockData.timestamp;
            
            if (lockAge > this.maxLockAge) {
                logger.warning(`Verrou expiré détecté, suppression automatique: ${lockPath}`);
                this.removeLock(cacheKey);
                return false;
            }
            
            return true;
        } catch (error) {
            logger.warning(`Verrou corrompu détecté, suppression: ${lockPath}`);
            this.removeLock(cacheKey);
            return false;
        }
    }

    /**
     * Force la suppression d'un verrou (pour déblocage)
     * @param {string} cacheKey - Clé de cache
     * @returns {boolean} True si un verrou a été supprimé
     */
    forceUnlock(cacheKey) {
        const cachePath = this.cacheStorage.getCachePath(cacheKey);
        const lockPath = cachePath + this.lockExtension;
        
        if (fs.existsSync(lockPath)) {
            try {
                fs.unlinkSync(lockPath);
                logger.info(`Verrou forcé supprimé: ${lockPath}`);
                return true;
            } catch (error) {
                logger.error(`Erreur suppression verrou forcé: ${error.message}`);
                return false;
            }
        }
        
        return false;
    }
}