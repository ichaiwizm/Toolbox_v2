import express from 'express';
import { Client as SSHClient } from 'ssh2';
import Joi from 'joi';
import { getLogger } from '../utils/logger.js';

const router = express.Router();
const logger = getLogger('toolbox.ssh');

// Schéma de validation pour les connexions SSH
const sshConnectionSchema = Joi.object({
    host: Joi.string().required().min(1).max(255),
    port: Joi.number().integer().min(1).max(65535).default(22),
    username: Joi.string().required().min(1).max(255),
    password: Joi.string().allow('').optional()
});

/**
 * Test d'une connexion SSH
 * POST /api/v1/ssh/test-connection
 */
router.post('/test-connection', async (req, res) => {
    const requestId = Date.now();
    logger.info(`[${requestId}] Début du test de connexion SSH`);

    try {
        // Validation des données d'entrée
        const { error, value: connectionData } = sshConnectionSchema.validate(req.body);
        
        if (error) {
            logger.warning(`[${requestId}] Données invalides: ${error.details[0].message}`);
            return res.status(400).json({
                error: 'Données de connexion invalides',
                details: error.details[0].message
            });
        }

        const { host, port, username, password } = connectionData;
        
        logger.info(`[${requestId}] Test de connexion vers ${username}@${host}:${port}`);

        // Créer une nouvelle connexion SSH
        const conn = new SSHClient();
        
        // Promise pour gérer la connexion SSH
        const testConnection = new Promise((resolve, reject) => {
            // Timeout de 10 secondes
            const timeout = setTimeout(() => {
                conn.end();
                reject(new Error('Timeout de connexion (10 secondes)'));
            }, 10000);

            conn.on('ready', () => {
                clearTimeout(timeout);
                logger.info(`[${requestId}] Connexion SSH établie avec succès`);
                
                // Fermer immédiatement la connexion après le test
                conn.end();
                resolve({
                    success: true,
                    message: `Connexion réussie vers ${host}`
                });
            });

            conn.on('error', (err) => {
                clearTimeout(timeout);
                logger.warning(`[${requestId}] Erreur de connexion SSH: ${err.message}`);
                
                let userMessage = 'Échec de la connexion';
                
                // Messages d'erreur plus spécifiques selon le type d'erreur
                if (err.level === 'client-authentication') {
                    userMessage = 'Authentification échouée - Vérifiez le nom d\'utilisateur et le mot de passe';
                } else if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
                    userMessage = 'Impossible de joindre le serveur - Vérifiez l\'hôte et le port';
                } else if (err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET') {
                    userMessage = 'Timeout de connexion - Le serveur ne répond pas';
                } else if (err.message.includes('hostkey')) {
                    userMessage = 'Problème de clé d\'hôte SSH';
                }
                
                reject(new Error(userMessage));
            });

            conn.on('close', () => {
                clearTimeout(timeout);
                logger.debug(`[${requestId}] Connexion SSH fermée`);
            });

            // Établir la connexion
            const connectionConfig = {
                host,
                port,
                username
            };

            // Ajouter le mot de passe seulement s'il est fourni
            if (password && password.trim() !== '') {
                connectionConfig.password = password;
            }

            conn.connect(connectionConfig);
        });

        // Attendre le résultat du test
        const result = await testConnection;
        
        logger.info(`[${requestId}] Test de connexion SSH terminé avec succès`);
        res.json(result);

    } catch (error) {
        logger.error(`[${requestId}] Erreur lors du test de connexion SSH: ${error.message}`);
        
        res.status(500).json({
            error: error.message || 'Erreur lors du test de connexion'
        });
    }
});

/**
 * Endpoint de santé pour le service SSH
 * GET /api/v1/ssh/health
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'ssh',
        message: 'Service SSH opérationnel'
    });
});

export default router;