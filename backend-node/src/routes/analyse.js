import express from 'express';
import { getLogger } from '../utils/logger.js';

const router = express.Router();
const logger = getLogger('toolbox.analyse');

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'analyse'
    });
});

/**
 * Placeholder endpoint pour l'analyse de projet
 */
router.post('/scan', (req, res) => {
    logger.info('Appel de l\'endpoint analyse/scan (placeholder)');
    res.json({
        message: 'Service d\'analyse non encore implémenté',
        status: 'placeholder',
        service: 'analyse'
    });
});

export default router;