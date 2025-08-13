import express from 'express';
import { copyService } from '../services/copy-service.js';
import { fileFilterService } from '../services/file-filter-service.js';
import { validateRequest, AdvancedCopyRequestSchema, sanitizeSensitiveData } from '../middleware/validation.js';
import { remoteDetectionMiddleware } from '../middleware/remote-mode.js';
import { getLogger } from '../utils/logger.js';

const router = express.Router();
const logger = getLogger('toolbox.copy');

// Middleware communs pour les routes de copie
const copyMiddleware = [
    validateRequest(AdvancedCopyRequestSchema),
    remoteDetectionMiddleware,
    sanitizeSensitiveData,
    (req, res, next) => {
        // Nettoyer et valider les règles de filtrage
        if (req.validatedBody.rules) {
            req.validatedBody.rules = fileFilterService.validateAndCleanRules(req.validatedBody.rules);
        }
        next();
    }
];

/**
 * Scanne les fichiers selon les critères spécifiés
 */
router.post('/advanced/scan', copyMiddleware, async (req, res) => {
    const requestId = Date.now();
    logger.info(`[${requestId}] Début du scan de fichiers`);
    
    try {
        const result = await copyService.scanFiles(req.validatedBody);
        logger.info(`[${requestId}] Scan terminé avec succès: ${result.total_matches} fichiers`);
        res.json(result);
    } catch (error) {
        logger.error(`[${requestId}] Erreur lors du scan: ${error.message}`);
        res.status(500).json({
            error: 'Erreur interne du serveur',
            message: error.message
        });
    }
});

/**
 * Récupère et formate le contenu des fichiers sélectionnés
 */
router.post('/advanced/format-content', copyMiddleware, async (req, res) => {
    const requestId = Date.now();
    logger.info(`[${requestId}] Début du formatage de contenu`);
    
    try {
        const result = await copyService.scanAndFormatContent(req.validatedBody);
        logger.info(`[${requestId}] Formatage terminé avec succès: ${result.total_matches} fichiers`);
        res.json(result);
    } catch (error) {
        logger.error(`[${requestId}] Erreur lors du formatage: ${error.message}`);
        res.status(500).json({
            error: 'Erreur interne du serveur',
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
        service: 'copy'
    });
});

export default router;