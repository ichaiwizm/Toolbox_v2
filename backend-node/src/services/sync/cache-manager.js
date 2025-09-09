import fs from 'fs';
import path from 'path';
import { getLogger } from '../../utils/logger.js';
import { 
  CacheKeyGenerator, 
  CacheStorage, 
  CacheLockManager, 
  CacheCleanupManager 
} from './cache/index.js';

const logger = getLogger('toolbox.cache-manager');

/**
 * Gestionnaire de cache pour la synchronisation distante
 */
export class CacheManager {
    
    constructor() {
        this.storage = new CacheStorage();
        this.lockManager = new CacheLockManager(this.storage);
        this.cleanupManager = new CacheCleanupManager(this.storage, this.lockManager);
    }
    
    /**
     * Génère une clé de cache pour des chemins multiples
     * @param {Object} sshConnection - Configuration SSH
     * @param {string[]} directories - Répertoires distants
     * @param {string[]} files - Fichiers spécifiques distants
     * @param {Object} syncOptions - Options de synchronisation
     * @returns {string} Clé de cache
     */
    generateMultiplePathsCacheKey(sshConnection, directories = [], files = [], syncOptions = {}) {
        return CacheKeyGenerator.generateMultiplePathsCacheKey(sshConnection, directories, files, syncOptions);
    }
    
    /**
     * Prépare un répertoire de cache pour une clé donnée
     * @param {string} cacheKey - Clé de cache
     * @returns {string} Chemin du cache préparé
     */
    prepareCacheDirectory(cacheKey) {
        return this.storage.prepareCacheDirectory(cacheKey);
    }
    
    /**
     * LEGACY: Génère une clé de cache unique pour un chemin
     * Maintenu pour compatibilité ascendante
     */
    generateCacheKey(sshConnection, remotePath, syncOptions = {}) {
        return CacheKeyGenerator.generateCacheKey(sshConnection, remotePath, syncOptions);
    }
    
    /**
     * Génère un chemin de cache spécifique pour un chemin donné
     * @param {string} baseCachePath - Chemin de cache de base
     * @param {string} remotePath - Chemin distant
     * @returns {string} Chemin de cache spécifique
     */
    generatePathSpecificCache(baseCachePath, remotePath) {
        const sanitized = remotePath.replace(/[\/\\]/g, '_').replace(/:/g, '-');
        return path.join(baseCachePath, sanitized);
    }
    
    /**
     * Obtient le chemin complet du cache pour une clé
     * @param {string} cacheKey - Clé de cache
     * @returns {string} Chemin complet du cache
     */
    getCachePath(cacheKey) {
        return this.storage.getCachePath(cacheKey);
    }
    
    /**
     * Vérifie le statut d'un cache
     * @param {string} cacheKey - Clé de cache
     * @returns {Object} Statut du cache
     */
    getCacheStatus(cacheKey) {
        const cachePath = this.storage.getCachePath(cacheKey);
        
        const status = {
            cacheKey,
            cachePath,
            exists: fs.existsSync(cachePath),
            locked: this.lockManager.isLocked(cacheKey),
            lastSync: null,
            isExpired: false,
            size: 0,
            fileCount: 0
        };
        
        if (status.exists) {
            try {
                const stats = fs.statSync(cachePath);
                
                // Préférer le timestamp explicite au mtime du dossier
                const stamped = this.storage.readLastSync(cacheKey);
                status.lastSync = stamped || stats.mtime;
                
                status.isExpired = this.storage.isCacheExpired(status.lastSync);
                
                // Obtenir les statistiques du cache
                const cacheStats = this.storage.getCacheStats(cachePath);
                status.size = cacheStats.size;
                status.fileCount = cacheStats.fileCount;
                
            } catch (error) {
                logger.warning(`Erreur lecture statut cache ${cacheKey}: ${error.message}`);
            }
        }
        
        return status;
    }
    
    /**
     * Lit les informations d'étendue d'un cache
     * @param {string} cacheKey - Clé de cache
     * @returns {Object|null} Informations du cache
     */
    getCacheInfo(cacheKey) {
        return this.storage.readCacheInfo(cacheKey);
    }
    
    /**
     * Sauvegarde les informations d'étendue d'un cache
     * @param {string} cacheKey - Clé de cache
     * @param {Object} cacheInfo - Informations à sauvegarder
     */
    saveCacheInfo(cacheKey, cacheInfo) {
        this.storage.writeCacheInfo(cacheKey, cacheInfo);
    }
    
    /**
     * Vérifie si un cache est verrouillé
     * @param {string} cacheKey - Clé de cache
     * @returns {boolean} True si verrouillé
     */
    isLocked(cacheKey) {
        return this.lockManager.isLocked(cacheKey);
    }
    
    /**
     * Crée un verrou pour un cache
     * @param {string} cacheKey - Clé de cache
     * @param {string} syncId - ID de synchronisation
     * @returns {string} Chemin du fichier de verrou
     */
    createLock(cacheKey, syncId) {
        return this.lockManager.createLock(cacheKey, syncId);
    }
    
    /**
     * Supprime un verrou pour un cache
     * @param {string} cacheKey - Clé de cache
     */
    removeLock(cacheKey) {
        this.lockManager.removeLock(cacheKey);
    }
    
    /**
     * Force le déblocage d'un cache
     * @param {string} cacheKey - Clé de cache
     * @returns {boolean} True si un verrou a été supprimé
     */
    forceUnlock(cacheKey) {
        return this.lockManager.forceUnlock(cacheKey);
    }
    
    /**
     * Nettoie les caches expirés
     * @param {number} maxAgeHours - Âge maximum en heures
     * @returns {Promise<Object>} Résultat du nettoyage
     */
    async cleanupExpiredCaches(maxAgeHours = 72) {
        return this.cleanupManager.cleanupExpiredCaches(maxAgeHours);
    }
    
    /**
     * Supprime complètement un cache
     * @param {string} cacheKey - Clé de cache
     */
    removeCache(cacheKey) {
        this.storage.removeCache(cacheKey);
    }
    
    /**
     * Prépare un répertoire de cache
     * @param {string} cacheKey - Clé de cache
     * @returns {string} Chemin du cache préparé
     */
    prepareCacheDirectory(cacheKey) {
        return this.storage.prepareCacheDirectory(cacheKey);
    }
    
    /**
     * Crée un verrou sur un cache
     * @param {string} cacheKey - Clé de cache
     * @param {string} syncId - ID de synchronisation
     * @returns {string} Chemin du fichier verrou
     */
    createLock(cacheKey, syncId) {
        return this.lockManager.createLock(cacheKey, syncId);
    }
    
    /**
     * Supprime un verrou de cache
     * @param {string} cacheKey - Clé de cache
     */
    removeLock(cacheKey) {
        this.lockManager.removeLock(cacheKey);
    }
    
    /**
     * Vérifie si un cache est verrouillé
     * @param {string} cacheKey - Clé de cache
     * @returns {boolean} True si verrouillé
     */
    isLocked(cacheKey) {
        return this.lockManager.isLocked(cacheKey);
    }
    
    /**
     * Force la suppression d'un verrou (pour déblocage)
     * @param {string} cacheKey - Clé de cache
     * @returns {boolean} True si un verrou a été supprimé
     */
    forceUnlock(cacheKey) {
        return this.lockManager.forceUnlock(cacheKey);
    }
    
    /**
     * Met à jour le timestamp de dernière synchronisation
     * @param {string} cacheKey - Clé de cache
     */
    updateLastSync(cacheKey) {
        this.storage.updateLastSync(cacheKey);
    }
    
    /**
     * Nettoie les caches expirés
     * @param {number} maxAgeHours - Âge maximum en heures
     * @returns {Object} Résultats du nettoyage
     */
    cleanupExpiredCaches(maxAgeHours = this.storage.defaultTTL) {
        return this.cleanupManager.cleanupExpiredCaches(maxAgeHours);
    }
    
    /**
     * Supprime complètement un cache
     * @param {string} cacheKey - Clé de cache
     */
    removeCache(cacheKey) {
        // Supprimer le verrou d'abord
        this.lockManager.removeLock(cacheKey);
        
        // Supprimer le répertoire
        this.storage.removeCache(cacheKey);
    }
}

// Export d'une instance singleton
export const cacheManager = new CacheManager();