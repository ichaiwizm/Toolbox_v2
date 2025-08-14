import fs from 'fs';
import path from 'path';
import os from 'os';
import { getLogger } from '../../../utils/logger.js';

const logger = getLogger('toolbox.cache-storage');
const LAST_SYNC_FILE = '.last_sync.json';

/**
 * Gestionnaire de stockage pour les caches distants
 */
export class CacheStorage {
    constructor() {
        this.cacheBasePath = this._getCacheBasePath();
        this.defaultTTL = 72; // 72 heures par défaut
    }

    /**
     * Obtient le chemin complet du cache pour une clé
     * @param {string} cacheKey - Clé de cache
     * @returns {string} Chemin complet du cache
     */
    getCachePath(cacheKey) {
        return path.join(this.cacheBasePath, cacheKey);
    }

    /**
     * Prépare un répertoire de cache
     * @param {string} cacheKey - Clé de cache
     * @returns {string} Chemin du cache préparé
     */
    prepareCacheDirectory(cacheKey) {
        const cachePath = this.getCachePath(cacheKey);
        
        if (!fs.existsSync(cachePath)) {
            fs.mkdirSync(cachePath, { recursive: true });
            logger.debug(`Répertoire cache créé: ${cachePath}`);
        }
        
        return cachePath;
    }

    /**
     * Met à jour le timestamp de dernière synchronisation
     * @param {string} cacheKey - Clé de cache
     */
    updateLastSync(cacheKey) {
        const cachePath = this.getCachePath(cacheKey);
        const stampPath = path.join(cachePath, LAST_SYNC_FILE);
        const now = new Date();
        
        try {
            fs.writeFileSync(stampPath, JSON.stringify({ syncedAt: now.toISOString() }, null, 2));
            // also "touch" the directory so humans see it change
            try { 
                fs.utimesSync(cachePath, now, now); 
            } catch (_) {
                // Ignore errors
            }
            logger.debug(`Last-sync stamp updated: ${stampPath}`);
        } catch (e) {
            logger.warning(`Unable to write last-sync stamp for ${cacheKey}: ${e.message}`);
        }
    }

    /**
     * Lit le timestamp de dernière synchronisation
     * @param {string} cacheKey - Clé de cache
     * @returns {Date|null} Date de dernière sync ou null
     */
    readLastSync(cacheKey) {
        const cachePath = this.getCachePath(cacheKey);
        const stampPath = path.join(cachePath, LAST_SYNC_FILE);
        
        try {
            if (fs.existsSync(stampPath)) {
                const obj = JSON.parse(fs.readFileSync(stampPath, 'utf8'));
                if (obj?.syncedAt) return new Date(obj.syncedAt);
            }
        } catch (e) {
            logger.warning(`Unable to read last-sync stamp for ${cacheKey}: ${e.message}`);
        }
        
        return null;
    }

    /**
     * Supprime complètement un cache
     * @param {string} cacheKey - Clé de cache
     */
    removeCache(cacheKey) {
        const cachePath = this.getCachePath(cacheKey);
        
        if (fs.existsSync(cachePath)) {
            this._removeDirectory(cachePath);
            logger.info(`Cache supprimé: ${cacheKey}`);
        }
    }

    /**
     * Vérifie si un cache est expiré
     * @param {Date} lastSync - Date de dernière synchronisation
     * @param {number} maxAgeHours - Âge maximum en heures
     * @returns {boolean}
     */
    isCacheExpired(lastSync, maxAgeHours = this.defaultTTL) {
        const ageMs = Date.now() - lastSync.getTime();
        const ageHours = ageMs / (1000 * 60 * 60);
        return ageHours > maxAgeHours;
    }

    /**
     * Obtient les statistiques d'un cache
     * @param {string} cachePath - Chemin du cache
     * @returns {Object} Statistiques { size, fileCount }
     */
    getCacheStats(cachePath) {
        let size = 0;
        let fileCount = 0;
        
        const walkDir = (dir) => {
            try {
                const files = fs.readdirSync(dir);
                for (const file of files) {
                    const filePath = path.join(dir, file);
                    const stats = fs.statSync(filePath);
                    
                    if (stats.isDirectory()) {
                        walkDir(filePath);
                    } else {
                        size += stats.size;
                        fileCount++;
                    }
                }
            } catch (e) {
                // Ignorer les erreurs d'accès
            }
        };
        
        walkDir(cachePath);
        return { size, fileCount };
    }

    /**
     * Obtient le chemin de base du cache
     * @private
     */
    _getCacheBasePath() {
        const tempDir = os.tmpdir();
        const cacheDir = path.join(tempDir, 'toolbox-remote-cache');
        
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
            logger.debug(`Répertoire cache de base créé: ${cacheDir}`);
        }
        
        return cacheDir;
    }

    /**
     * Supprime récursivement un répertoire
     * @private
     */
    _removeDirectory(dirPath) {
        if (fs.existsSync(dirPath)) {
            fs.rmSync(dirPath, { recursive: true, force: true });
        }
    }
}