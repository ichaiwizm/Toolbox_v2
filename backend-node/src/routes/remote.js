import express from 'express';
import { remoteSyncService } from '../services/sync/remote-sync-service.js';
import { copyService } from '../services/copy-service.js';
import { 
    validateRequest, 
    RemoteSyncRequestSchema, 
    CacheStatusRequestSchema,
    CacheCleanupRequestSchema 
} from '../middleware/validation.js';
import { getLogger } from '../utils/logger.js';

const router = express.Router();
const logger = getLogger('toolbox.remote');

/**
 * Synchronise un chemin distant vers le cache local
 * POST /api/v1/remote/sync
 */
router.post('/sync', validateRequest(RemoteSyncRequestSchema), async (req, res) => {
    const requestId = Date.now();
    logger.info(`[${requestId}] Début synchronisation distante`);

    try {
        const validated = req.validatedBody;

        const { ssh_connection, directories, files, sync_options } = validated;
        
        // Lancer la synchronisation avec support des chemins multiples
        const result = await remoteSyncService.syncMultiplePathsToCache(
            ssh_connection,
            directories,
            files,
            sync_options
        );
        
        logger.info(`[${requestId}] Synchronisation terminée: cache ${result.cacheKey}`);
        
        res.json({
            success: true,
            message: 'Synchronisation terminée avec succès',
            data: {
                cacheKey: result.cacheKey,
                cachePath: result.cachePath,
                stats: result.stats,
                connection: result.connection,
                syncId: result.syncId
            }
        });

    } catch (error) {
        logger.error(`[${requestId}] Erreur synchronisation: ${error.message}`);
        
        res.status(500).json({
            error: 'Erreur lors de la synchronisation',
            message: error.message
        });
    }
});

/**
 * Vérifie le statut du cache pour une connexion/chemin
 * POST /api/v1/remote/cache-status
 */
router.post('/cache-status', validateRequest(CacheStatusRequestSchema), async (req, res) => {
    const requestId = Date.now();
    
    try {
        const validated = req.validatedBody;

        const { ssh_connection, directories, files, sync_options } = validated;
        
        const status = remoteSyncService.getMultiplePathsCacheStatus(
            ssh_connection,
            directories,
            files,
            sync_options
        );
        
        logger.debug(`[${requestId}] Statut cache ${status.cacheKey}: exists=${status.exists}, expired=${status.isExpired}`);
        
        res.json({
            success: true,
            data: status
        });

    } catch (error) {
        logger.error(`[${requestId}] Erreur statut cache: ${error.message}`);
        
        res.status(500).json({
            error: 'Erreur lors de la vérification du cache',
            message: error.message
        });
    }
});

/**
 * Scanne les fichiers depuis le cache distant (après sync)
 * POST /api/v1/remote/scan
 */
router.post('/scan', validateRequest(RemoteSyncRequestSchema), async (req, res) => {
    const requestId = Date.now();
    logger.info(`[${requestId}] Début scan depuis cache distant`);

    try {
        const validated = req.validatedBody;

        const { ssh_connection, directories, files, sync_options, allowExpired } = validated;
        
        // Vérifier le statut du cache pour les chemins multiples
        const cacheStatus = remoteSyncService.getMultiplePathsCacheStatus(
            ssh_connection,
            directories,
            files,
            sync_options
        );
        
        if (!cacheStatus.exists) {
            return res.status(404).json({
                error: 'Cache non trouvé',
                message: 'Vous devez d\'abord synchroniser ces chemins distants',
                cacheKey: cacheStatus.cacheKey
            });
        }
        
        if (cacheStatus.isExpired && !allowExpired) {
            return res.status(410).json({
                error: 'Cache expiré',
                message: 'Le cache est expiré, une re-synchronisation est recommandée',
                cacheStatus
            });
        }
        
        // Scanner les fichiers depuis le cache local avec chemins multiples
        const scanRequest = {
            directories: cacheStatus.cacheDirectories || [],
            files: cacheStatus.cacheFiles || [],
            rules: {
                exclude_extensions: sync_options.excludeExtensions || [],
                exclude_patterns: sync_options.excludePatterns || [],
                exclude_directories: sync_options.excludeDirectories || [],
                include_extensions: [],
                include_patterns: []
            },
            recursive: sync_options.recursive !== false
        };
        
        const result = await copyService.scanFiles(scanRequest);
        
        // Remplacer les chemins de cache par les chemins distants originaux
        const remoteResult = {
            ...result,
            matches: result.matches.map(match => {
                // Trouver le chemin distant correspondant basé sur le mapping du cache
                let remotePath = match.path;
                for (const [originalPath, cachePath] of cacheStatus.pathMappings || []) {
                    if (match.path.startsWith(cachePath)) {
                        remotePath = match.path.replace(cachePath, originalPath);
                        break;
                    }
                }
                
                return {
                    ...match,
                    path: remotePath,
                    cache_path: match.path
                };
            }),
            cache_info: {
                cacheKey: cacheStatus.cacheKey,
                lastSync: cacheStatus.lastSync,
                isExpired: cacheStatus.isExpired,
                pathMappings: cacheStatus.pathMappings
            }
        };
        
        logger.info(`[${requestId}] Scan cache terminé: ${result.total_matches} fichiers`);
        res.json(remoteResult);

    } catch (error) {
        logger.error(`[${requestId}] Erreur scan cache: ${error.message}`);
        
        res.status(500).json({
            error: 'Erreur lors du scan du cache',
            message: error.message
        });
    }
});

/**
 * Formate le contenu des fichiers depuis le cache distant
 * POST /api/v1/remote/format-content
 */
router.post('/format-content', validateRequest(RemoteSyncRequestSchema), async (req, res) => {
    const requestId = Date.now();
    logger.info(`[${requestId}] Début formatage contenu depuis cache distant`);

    try {
        const validated = req.validatedBody;

        const { ssh_connection, directories, files, sync_options } = validated;
        
        // Vérifier le cache comme pour scan
        const cacheStatus = remoteSyncService.getMultiplePathsCacheStatus(
            ssh_connection,
            directories,
            files,
            sync_options
        );
        
        if (!cacheStatus.exists) {
            return res.status(404).json({
                error: 'Cache non trouvé',
                message: 'Vous devez d\'abord synchroniser ce chemin distant'
            });
        }
        
        // Formatter le contenu depuis le cache local avec chemins multiples
        const formatRequest = {
            directories: cacheStatus.cacheDirectories || [],
            files: cacheStatus.cacheFiles || [],
            rules: {
                exclude_extensions: sync_options.excludeExtensions || [],
                exclude_patterns: sync_options.excludePatterns || [],
                exclude_directories: sync_options.excludeDirectories || [],
                include_extensions: [],
                include_patterns: []
            },
            recursive: sync_options.recursive !== false
        };
        
        const result = await copyService.scanAndFormatContent(formatRequest);
        
        // Remplacer les chemins dans le contenu formaté avec mapping multiple
        let formattedContent = result.formatted_content;
        if (formattedContent && cacheStatus.pathMappings) {
            for (const [originalPath, cachePath] of cacheStatus.pathMappings) {
                const cachePathRegex = new RegExp(cachePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                formattedContent = formattedContent.replace(cachePathRegex, originalPath);
            }
        }
        
        const remoteResult = {
            ...result,
            formatted_content: formattedContent,
            matches: result.matches.map(match => {
                // Trouver le chemin distant correspondant basé sur le mapping du cache
                let remotePath = match.path;
                for (const [originalPath, cachePath] of cacheStatus.pathMappings || []) {
                    if (match.path.startsWith(cachePath)) {
                        remotePath = match.path.replace(cachePath, originalPath);
                        break;
                    }
                }
                
                return {
                    ...match,
                    path: remotePath,
                    cache_path: match.path
                };
            }),
            cache_info: {
                cacheKey: cacheStatus.cacheKey,
                lastSync: cacheStatus.lastSync,
                isExpired: cacheStatus.isExpired,
                pathMappings: cacheStatus.pathMappings
            }
        };
        
        logger.info(`[${requestId}] Formatage cache terminé: ${result.total_matches} fichiers`);
        res.json(remoteResult);

    } catch (error) {
        logger.error(`[${requestId}] Erreur formatage cache: ${error.message}`);
        
        res.status(500).json({
            error: 'Erreur lors du formatage du cache',
            message: error.message
        });
    }
});

/**
 * Nettoie les caches expirés
 * POST /api/v1/remote/cleanup
 */
router.post('/cleanup', validateRequest(CacheCleanupRequestSchema), async (req, res) => {
    const requestId = Date.now();
    logger.info(`[${requestId}] Début nettoyage des caches`);

    try {
        const { maxAgeHours } = req.validatedBody;
        
        const result = await remoteSyncService.cleanupExpiredCaches(maxAgeHours);
        
        logger.info(`[${requestId}] Nettoyage terminé: ${result.removed.length} caches supprimés`);
        
        res.json({
            success: true,
            message: `${result.removed.length} caches expirés supprimés`,
            data: {
                removed: result.removed,
                errors: result.errors,
                totalSize: result.totalSize,
                totalCount: result.totalCount
            }
        });

    } catch (error) {
        logger.error(`[${requestId}] Erreur nettoyage: ${error.message}`);
        
        res.status(500).json({
            error: 'Erreur lors du nettoyage',
            message: error.message
        });
    }
});

/**
 * Force le déblocage d'un cache verrouillé
 * POST /api/v1/remote/unlock
 */
router.post('/unlock', validateRequest(RemoteSyncRequestSchema), async (req, res) => {
    const requestId = Date.now();
    logger.info(`[${requestId}] Déblocage forcé demandé`);

    try {
        const validated = req.validatedBody;
        const { ssh_connection, directories, files, sync_options } = validated;
        
        const unlocked = remoteSyncService.forceUnlockMultiplePaths(
            ssh_connection,
            directories,
            files,
            sync_options
        );
        
        res.json({
            success: true,
            message: unlocked ? 'Verrou supprimé avec succès' : 'Aucun verrou trouvé',
            unlocked
        });

    } catch (error) {
        logger.error(`[${requestId}] Erreur déblocage: ${error.message}`);
        
        res.status(500).json({
            error: 'Erreur lors du déblocage',
            message: error.message
        });
    }
});

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'remote',
        message: 'Service de synchronisation distante opérationnel'
    });
});

export default router;