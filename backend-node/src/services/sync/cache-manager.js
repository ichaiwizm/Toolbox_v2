import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { getLogger } from '../../utils/logger.js';

const logger = getLogger('toolbox.cache-manager');

const LAST_SYNC_FILE = '.last_sync.json';

/**
 * Gestionnaire de cache pour la synchronisation distante
 */
export class CacheManager {
    
    constructor() {
        this.cacheBasePath = this._getCacheBasePath();
        this.lockExtension = '.lock';
        this.defaultTTL = 72; // 72 heures par défaut
    }
    
    /**
     * Génère une clé de cache unique basée sur la configuration
     * @param {Object} sshConnection - Configuration SSH
     * @param {string} remotePath - Chemin distant
     * @param {Object} syncOptions - Options de synchronisation
     * @returns {string} Clé de cache
     */
    generateCacheKey(sshConnection, remotePath, syncOptions = {}) {
        const keyData = {
            host: sshConnection.host,
            port: sshConnection.port || 22,
            username: sshConnection.username,
            remotePath: remotePath,
            recursive: syncOptions.recursive !== false,
            excludePatterns: (syncOptions.excludePatterns || []).sort(),
            excludeExtensions: (syncOptions.excludeExtensions || []).sort(),
            excludeDirectories: (syncOptions.excludeDirectories || []).sort()
        };
        
        const keyString = JSON.stringify(keyData, Object.keys(keyData).sort());
        const hash = crypto.createHash('sha256').update(keyString).digest('hex').substring(0, 16);
        
        logger.debug(`Clé cache générée: ${hash} pour ${sshConnection.host}:${remotePath}`);
        return hash;
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
     * Vérifie le statut d'un cache
     * @param {string} cacheKey - Clé de cache
     * @returns {Object} Statut du cache
     */
    getCacheStatus(cacheKey) {
        const cachePath = this.getCachePath(cacheKey);
        const lockPath = cachePath + this.lockExtension;
        
        const status = {
            cacheKey,
            cachePath,
            exists: fs.existsSync(cachePath),
            locked: fs.existsSync(lockPath),
            lastSync: null,
            isExpired: false,
            size: 0,
            fileCount: 0
        };
        
        if (status.exists) {
            try {
                const stats = fs.statSync(cachePath);
                
                // Préférer le timestamp explicite au mtime du dossier
                const stamped = this._readLastSync(cacheKey);
                status.lastSync = stamped || stats.mtime;
                
                status.isExpired = this._isCacheExpired(status.lastSync);
                
                // Obtenir les statistiques du cache
                const cacheStats = this._getCacheStats(cachePath);
                status.size = cacheStats.size;
                status.fileCount = cacheStats.fileCount;
                
            } catch (error) {
                logger.warning(`Erreur lecture statut cache ${cacheKey}: ${error.message}`);
            }
        }
        
        return status;
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
     * Crée un verrou sur un cache
     * @param {string} cacheKey - Clé de cache
     * @param {string} syncId - ID de synchronisation
     * @returns {string} Chemin du fichier verrou
     */
    createLock(cacheKey, syncId) {
        const cachePath = this.getCachePath(cacheKey);
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
        const cachePath = this.getCachePath(cacheKey);
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
        const cachePath = this.getCachePath(cacheKey);
        const lockPath = cachePath + this.lockExtension;
        
        if (!fs.existsSync(lockPath)) {
            return false;
        }
        
        // Vérifier si le verrou est expiré (plus de 30 minutes)
        try {
            const lockData = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
            const lockAge = Date.now() - lockData.timestamp;
            const MAX_LOCK_AGE = 30 * 60 * 1000; // 30 minutes
            
            if (lockAge > MAX_LOCK_AGE) {
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
        const cachePath = this.getCachePath(cacheKey);
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
            try { fs.utimesSync(cachePath, now, now); } catch (_) {}
            logger.debug(`Last-sync stamp updated: ${stampPath}`);
        } catch (e) {
            logger.warning(`Unable to write last-sync stamp for ${cacheKey}: ${e.message}`);
        }
    }
    
    /**
     * Lit le timestamp de dernière synchronisation
     * @private
     * @param {string} cacheKey - Clé de cache
     * @returns {Date|null} Date de dernière sync ou null
     */
    _readLastSync(cacheKey) {
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
     * Nettoie les caches expirés
     * @param {number} maxAgeHours - Âge maximum en heures
     * @returns {Object} Résultats du nettoyage
     */
    cleanupExpiredCaches(maxAgeHours = this.defaultTTL) {
        logger.info(`Nettoyage caches expirés (> ${maxAgeHours}h)`);
        
        const cleanupResults = {
            removed: [],
            errors: [],
            totalSize: 0,
            totalCount: 0
        };
        
        try {
            if (!fs.existsSync(this.cacheBasePath)) {
                return cleanupResults;
            }
            
            const cacheEntries = fs.readdirSync(this.cacheBasePath);
            
            for (const entry of cacheEntries) {
                const entryPath = path.join(this.cacheBasePath, entry);
                
                try {
                    const stats = fs.statSync(entryPath);
                    
                    if (stats.isDirectory()) {
                        const ageHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
                        
                        if (ageHours > maxAgeHours) {
                            // Ne pas supprimer si verrouillé
                            if (this.isLocked(entry)) {
                                logger.info(`Cache verrouillé ignoré: ${entry}`);
                                continue;
                            }
                            
                            const cacheStats = this._getCacheStats(entryPath);
                            this._removeDirectory(entryPath);
                            
                            cleanupResults.removed.push({
                                cacheKey: entry,
                                age: ageHours,
                                size: cacheStats.size,
                                fileCount: cacheStats.fileCount
                            });
                            
                            cleanupResults.totalSize += cacheStats.size;
                            cleanupResults.totalCount += cacheStats.fileCount;
                        }
                    }
                    
                } catch (error) {
                    cleanupResults.errors.push({
                        entry,
                        error: error.message
                    });
                }
            }
            
            logger.info(`Nettoyage terminé: ${cleanupResults.removed.length} caches supprimés`);
            return cleanupResults;
            
        } catch (error) {
            logger.error(`Erreur lors du nettoyage: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Supprime complètement un cache
     * @param {string} cacheKey - Clé de cache
     */
    removeCache(cacheKey) {
        const cachePath = this.getCachePath(cacheKey);
        
        // Supprimer le verrou d'abord
        this.removeLock(cacheKey);
        
        // Supprimer le répertoire
        if (fs.existsSync(cachePath)) {
            this._removeDirectory(cachePath);
            logger.info(`Cache supprimé: ${cacheKey}`);
        }
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
     * Vérifie si un cache est expiré
     * @private
     */
    _isCacheExpired(lastSync, maxAgeHours = this.defaultTTL) {
        const ageMs = Date.now() - lastSync.getTime();
        const ageHours = ageMs / (1000 * 60 * 60);
        return ageHours > maxAgeHours;
    }
    
    /**
     * Obtient les statistiques d'un cache
     * @private
     */
    _getCacheStats(cachePath) {
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
     * Supprime récursivement un répertoire
     * @private
     */
    _removeDirectory(dirPath) {
        if (fs.existsSync(dirPath)) {
            fs.rmSync(dirPath, { recursive: true, force: true });
        }
    }
}

// Export d'une instance singleton
export const cacheManager = new CacheManager();