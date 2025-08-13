import { wslDetector } from '../../utils/remote/wsl-detector.js';
import { sshCommander } from '../../utils/remote/ssh-commander.js';
import { cacheManager } from './cache-manager.js';
import { rsyncExecutor } from './rsync-executor.js';
import { getLogger } from '../../utils/logger.js';

const logger = getLogger('toolbox.remote-sync');

/**
 * Service de synchronisation distante via SSH/WSL
 * Version refactorisée - orchestrateur principal
 */
export class RemoteSyncService {
    
    /**
     * Synchronise un chemin distant vers le cache local
     * @param {Object} sshConnection - Configuration SSH
     * @param {string} remotePath - Chemin sur le serveur distant
     * @param {Object} syncOptions - Options de synchronisation
     * @returns {Promise<Object>} Résultat de la synchronisation
     */
    async syncRemoteToCache(sshConnection, remotePath, syncOptions = {}) {
        const syncId = Date.now();
        logger.info(`[${syncId}] Début synchronisation ${sshConnection.host}:${remotePath}`);
        
        try {
            // 1. Vérifications préalables
            await this._performPreflightChecks(sshConnection, remotePath);
            
            // 2. Préparation du cache
            const cacheKey = cacheManager.generateCacheKey(sshConnection, remotePath, syncOptions);
            const cachePath = cacheManager.prepareCacheDirectory(cacheKey);
            
            // 3. Gestion du verrou
            if (cacheManager.isLocked(cacheKey)) {
                throw new Error('Synchronisation déjà en cours pour ce chemin');
            }
            
            const lockPath = cacheManager.createLock(cacheKey, syncId);
            
            try {
                // 4. Dry-run pour estimation
                const dryRunResult = await rsyncExecutor.performDryRun(
                    sshConnection, 
                    remotePath, 
                    cachePath, 
                    syncOptions
                );
                
                logger.info(`[${syncId}] Dry-run: ${dryRunResult.estimatedFiles} fichiers estimés`);
                
                // 5. Synchronisation réelle
                const syncResult = await rsyncExecutor.performSync(
                    sshConnection,
                    remotePath,
                    cachePath,
                    syncOptions,
                    syncId
                );
                
                // Mettre à jour le timestamp de dernière synchronisation
                cacheManager.updateLastSync(cacheKey);
                
                const result = {
                    success: true,
                    cacheKey,
                    cachePath,
                    syncId,
                    stats: {
                        ...syncResult,
                        estimated: dryRunResult
                    },
                    connection: {
                        host: sshConnection.host,
                        username: sshConnection.username
                    }
                };
                
                logger.info(`[${syncId}] Synchronisation terminée avec succès`);
                return result;
                
            } finally {
                // Nettoyer le verrou dans tous les cas
                cacheManager.removeLock(cacheKey);
            }
            
        } catch (error) {
            logger.error(`[${syncId}] Erreur synchronisation: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Vérifie le statut du cache pour une connexion/chemin
     * @param {Object} sshConnection - Configuration SSH
     * @param {string} remotePath - Chemin distant
     * @param {Object} syncOptions - Options de sync
     * @returns {Object} Statut du cache
     */
    getCacheStatus(sshConnection, remotePath, syncOptions = {}) {
        const cacheKey = cacheManager.generateCacheKey(sshConnection, remotePath, syncOptions);
        return cacheManager.getCacheStatus(cacheKey);
    }
    
    /**
     * Nettoie les caches expirés
     * @param {number} maxAgeHours - Âge max en heures (défaut: 72h)
     * @returns {Promise<Object>} Résultat du nettoyage
     */
    async cleanupExpiredCaches(maxAgeHours = 72) {
        logger.info('Début nettoyage des caches expirés');
        return cacheManager.cleanupExpiredCaches(maxAgeHours);
    }
    
    /**
     * Supprime un cache spécifique
     * @param {string} cacheKey - Clé de cache à supprimer
     */
    removeCache(cacheKey) {
        cacheManager.removeCache(cacheKey);
    }
    
    /**
     * Force le déblocage d'un cache verrouillé
     * @param {Object} sshConnection - Configuration SSH
     * @param {string} remotePath - Chemin distant
     * @param {Object} syncOptions - Options de sync
     * @returns {boolean} True si un verrou a été supprimé
     */
    forceUnlock(sshConnection, remotePath, syncOptions = {}) {
        const cacheKey = cacheManager.generateCacheKey(sshConnection, remotePath, syncOptions);
        const unlocked = cacheManager.forceUnlock(cacheKey);
        logger.info(`Force unlock ${cacheKey}: ${unlocked ? 'success' : 'no lock found'}`);
        return unlocked;
    }
    
    /**
     * Effectue les vérifications préalables
     * @private
     */
    async _performPreflightChecks(sshConnection, remotePath) {
        logger.info('Vérifications préalables...');
        
        // 1. Vérifier WSL
        const env = await wslDetector.detectEnvironment();
        if (!env.hasWSL) {
            throw new Error('WSL non détecté - Synchronisation distante non disponible. Installez WSL avec: wsl --install');
        }
        
        // 2. Log authentication method
        if (sshConnection.password) {
            logger.debug('Utilisation de l\'authentification par mot de passe');
        } else {
            logger.debug('Utilisation de l\'authentification par clés SSH');
        }
        
        // 3. Tester la connexion SSH
        const sshConnected = await sshCommander.testConnection(sshConnection);
        if (!sshConnected) {
            throw new Error('Impossible de se connecter au serveur SSH');
        }
        
        // 4. Vérifier le chemin distant
        const pathExists = await sshCommander.checkRemotePath(sshConnection, remotePath);
        if (!pathExists) {
            throw new Error(`Chemin distant introuvable: ${remotePath}`);
        }
        
        logger.info('Vérifications préalables terminées avec succès');
    }
}

// Export d'une instance singleton
export const remoteSyncService = new RemoteSyncService();