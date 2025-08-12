import express from 'express';
import { getLogger } from '../utils/logger.js';

const router = express.Router();
const logger = getLogger('toolbox.duplicate_detection');

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'duplicate'
    });
});

/**
 * Placeholder endpoint pour la détection de doublons
 */
router.post('/scan', (req, res) => {
    logger.info('Appel de l\'endpoint duplicate/scan (placeholder)');
    res.json({
        message: 'Service de détection de doublons non encore implémenté',
        status: 'placeholder',
        service: 'duplicate'
    });
});

export default router;