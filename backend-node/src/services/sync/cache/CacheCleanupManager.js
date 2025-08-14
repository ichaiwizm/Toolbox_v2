import fs from 'fs';
import path from 'path';
import { getLogger } from '../../../utils/logger.js';

const logger = getLogger('toolbox.cache-cleanup-manager');

/**
 * Gestionnaire de nettoyage pour les caches distants
 */
export class CacheCleanupManager {
    constructor(cacheStorage, lockManager) {
        this.cacheStorage = cacheStorage;
        this.lockManager = lockManager;
    }

    /**
     * Nettoie les caches expirés
     * @param {number} maxAgeHours - Âge maximum en heures
     * @returns {Object} Résultats du nettoyage
     */
    cleanupExpiredCaches(maxAgeHours = this.cacheStorage.defaultTTL) {
        logger.info(`Nettoyage caches expirés (> ${maxAgeHours}h)`);
        
        const cleanupResults = {
            removed: [],
            errors: [],
            totalSize: 0,
            totalCount: 0
        };
        
        try {
            if (!fs.existsSync(this.cacheStorage.cacheBasePath)) {
                return cleanupResults;
            }
            
            const cacheEntries = fs.readdirSync(this.cacheStorage.cacheBasePath);
            
            for (const entry of cacheEntries) {
                const entryPath = path.join(this.cacheStorage.cacheBasePath, entry);
                
                try {
                    const stats = fs.statSync(entryPath);
                    
                    if (stats.isDirectory()) {
                        const ageHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
                        
                        if (ageHours > maxAgeHours) {
                            // Ne pas supprimer si verrouillé
                            if (this.lockManager.isLocked(entry)) {
                                logger.info(`Cache verrouillé ignoré: ${entry}`);
                                continue;
                            }
                            
                            const cacheStats = this.cacheStorage.getCacheStats(entryPath);
                            this.cacheStorage.removeCache(entry);
                            
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
}