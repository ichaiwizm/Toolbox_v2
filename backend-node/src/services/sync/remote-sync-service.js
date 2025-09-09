import path from 'path';
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
     * Synchronise des chemins multiples (répertoires + fichiers) vers le cache local
     * @param {Object} sshConnection - Configuration SSH
     * @param {string[]} directories - Répertoires distants
     * @param {string[]} files - Fichiers spécifiques distants
     * @param {Object} syncOptions - Options de synchronisation
     * @returns {Promise<Object>} Résultat de la synchronisation
     */
    async syncMultiplePathsToCache(sshConnection, directories = [], files = [], syncOptions = {}) {
        const allPaths = [...directories, ...files];
        if (allPaths.length === 0) {
            throw new Error('Au moins un chemin (répertoire ou fichier) doit être spécifié');
        }
        
        const syncId = Date.now();
        logger.info(`[${syncId}] Début synchronisation multiple ${sshConnection.host}: ${allPaths.length} chemins`);
        
        try {
            // 1. Vérifications préalables pour tous les chemins
            for (const path of allPaths) {
                await this._performPreflightChecks(sshConnection, path);
            }
            
            // 2. Préparation du cache unifié
            const cacheKey = cacheManager.generateMultiplePathsCacheKey(sshConnection, directories, files, syncOptions);
            const cachePath = cacheManager.prepareCacheDirectory(cacheKey);
            
            // 3. Gestion du verrou
            if (cacheManager.isLocked(cacheKey)) {
                throw new Error('Synchronisation déjà en cours pour ces chemins');
            }
            
            const lockPath = cacheManager.createLock(cacheKey, syncId);
            
            try {
                // 4. Synchronisation de chaque chemin
                const syncResults = [];
                const pathMappings = [];
                
                for (const remotePath of allPaths) {
                    const isDirectory = directories.includes(remotePath);
                    const isFile = files.includes(remotePath);
                    
                    // Pour les fichiers, créer un dossier de cache spécifique 
                    // Le fichier sera synchronisé à l'intérieur de ce dossier
                    let pathCachePath;
                    if (isFile) {
                        // Créer un dossier pour ce fichier spécifique
                        const sanitizedName = remotePath.replace(/[\/\\]/g, '_').replace(/:/g, '-');
                        pathCachePath = path.join(cachePath, `file_${sanitizedName}`);
                    } else {
                        // Pour les répertoires, utiliser la méthode normale
                        pathCachePath = cacheManager.generatePathSpecificCache(cachePath, remotePath);
                    }
                    
                    // Dry-run pour estimation
                    const dryRunResult = await rsyncExecutor.performDryRun(
                        sshConnection, 
                        remotePath, 
                        pathCachePath, 
                        { ...syncOptions, isFile: !isDirectory }
                    );
                    
                    logger.info(`[${syncId}] Dry-run ${remotePath}: ${dryRunResult.estimatedFiles} fichiers estimés`);
                    
                    // Synchronisation effective
                    const syncResult = await rsyncExecutor.performSync(
                        sshConnection, 
                        remotePath, 
                        pathCachePath, 
                        { ...syncOptions, isFile: !isDirectory }
                    );
                    
                    syncResults.push(syncResult);
                    pathMappings.push([remotePath, pathCachePath]);
                    
                    logger.info(`[${syncId}] Sync ${remotePath}: ${syncResult.transferredFiles} fichiers transférés`);
                }
                
                // 5. Consolidation des résultats
                const totalStats = syncResults.reduce((acc, result) => ({
                    transferredFiles: acc.transferredFiles + (result.transferredFiles || 0),
                    totalSize: acc.totalSize + (result.totalSize || 0),
                    duration: Math.max(acc.duration, result.duration || 0)
                }), { transferredFiles: 0, totalSize: 0, duration: 0 });
                
                // 6. Sauvegarde des métadonnées du cache
                const cacheInfo = {
                    cacheKey,
                    cachePath,
                    pathMappings,
                    directories: directories.map(dir => cacheManager.generatePathSpecificCache(cachePath, dir)),
                    files: files.map(file => {
                        // Pour les fichiers, le chemin réel dans le cache inclut le nom du fichier
                        const sanitizedName = file.replace(/[\/\\]/g, '_').replace(/:/g, '-');
                        const fileDir = path.join(cachePath, `file_${sanitizedName}`);
                        const fileName = path.basename(file);
                        return path.join(fileDir, fileName);
                    }),
                    lastSync: new Date(),
                    syncOptions,
                    connection: {
                        host: sshConnection.host,
                        port: sshConnection.port || 22,
                        username: sshConnection.username
                    },
                    stats: totalStats
                };
                
                cacheManager.saveCacheInfo(cacheKey, cacheInfo);
                
                const result = {
                    cacheKey,
                    cachePath,
                    pathMappings,
                    cacheDirectories: cacheInfo.directories,
                    cacheFiles: cacheInfo.files,
                    stats: totalStats,
                    connection: cacheInfo.connection,
                    syncId
                };
                
                logger.info(`[${syncId}] Synchronisation multiple terminée: ${totalStats.transferredFiles} fichiers`);
                return result;
                
            } finally {
                cacheManager.removeLock(cacheKey);
            }
            
        } catch (error) {
            logger.error(`[${syncId}] Erreur synchronisation multiple: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * LEGACY: Synchronise un chemin distant unique vers le cache local
     * Maintenu pour compatibilité ascendante
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
     * Vérifie le statut du cache pour des chemins multiples
     * @param {Object} sshConnection - Configuration SSH
     * @param {string[]} directories - Répertoires distants
     * @param {string[]} files - Fichiers spécifiques distants
     * @param {Object} syncOptions - Options de sync
     * @returns {Object} Statut du cache
     */
    getMultiplePathsCacheStatus(sshConnection, directories = [], files = [], syncOptions = {}) {
        const cacheKey = cacheManager.generateMultiplePathsCacheKey(sshConnection, directories, files, syncOptions);
        const status = cacheManager.getCacheStatus(cacheKey);
        
        // Enrichir avec les informations des chemins multiples
        if (status.exists) {
            const cacheInfo = cacheManager.getCacheInfo(cacheKey);
            if (cacheInfo) {
                status.pathMappings = cacheInfo.pathMappings || [];
                status.cacheDirectories = cacheInfo.directories || [];
                status.cacheFiles = cacheInfo.files || [];
            }
        }
        
        return status;
    }
    
    /**
     * LEGACY: Vérifie le statut du cache pour un chemin unique
     * Maintenu pour compatibilité ascendante
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
     * Force le déblocage d'un cache verrouillé pour chemins multiples
     * @param {Object} sshConnection - Configuration SSH
     * @param {string[]} directories - Répertoires distants
     * @param {string[]} files - Fichiers spécifiques distants
     * @param {Object} syncOptions - Options de sync
     * @returns {boolean} True si un verrou a été supprimé
     */
    forceUnlockMultiplePaths(sshConnection, directories = [], files = [], syncOptions = {}) {
        const cacheKey = cacheManager.generateMultiplePathsCacheKey(sshConnection, directories, files, syncOptions);
        const unlocked = cacheManager.forceUnlock(cacheKey);
        logger.info(`Force unlock multiple paths ${cacheKey}: ${unlocked ? 'success' : 'no lock found'}`);
        return unlocked;
    }
    
    /**
     * LEGACY: Force le déblocage d'un cache verrouillé pour un chemin unique
     * Maintenu pour compatibilité ascendante
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