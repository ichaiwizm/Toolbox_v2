import express from 'express';
import { getLogger } from '../utils/logger.js';

const router = express.Router();
const logger = getLogger('toolbox.winmerge');

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'winmerge'
    });
});

/**
 * Placeholder endpoint pour WinMerge
 */
router.post('/compare', (req, res) => {
    logger.info('Appel de l\'endpoint winmerge/compare (placeholder)');
    res.json({
        message: 'Service WinMerge non encore implémenté',
        status: 'placeholder',
        service: 'winmerge'
    });
});

export default router;