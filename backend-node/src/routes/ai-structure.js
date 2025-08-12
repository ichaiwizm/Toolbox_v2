import express from 'express';
import { getLogger } from '../utils/logger.js';

const router = express.Router();
const logger = getLogger('toolbox.ai_structure');

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'ai-structure'
    });
});

/**
 * Placeholder endpoint pour la génération d'arborescence par IA
 */
router.post('/generate', (req, res) => {
    logger.info('Appel de l\'endpoint ai-structure/generate (placeholder)');
    res.json({
        message: 'Service de génération d\'arborescence par IA non encore implémenté',
        status: 'placeholder',
        service: 'ai-structure'
    });
});

export default router;