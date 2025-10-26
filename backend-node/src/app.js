import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { getLogger } from './utils/logger.js';

// Importation des routes
import copyRoutes from './routes/copy.js';
import sshRoutes from './routes/ssh.js';
import remoteRoutes from './routes/remote.js';
import smartautoRoutes from './routes/smartauto.js';

const logger = getLogger('toolbox.api');

function createApp() {
    logger.info('Création de l\'application Express');
    
    const app = express();
    
    // Middleware de base
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    
    // Configuration CORS
    app.use(cors({
        origin: '*', // En production, spécifier les origines exactes
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    }));
    
    // Middleware de logging des requêtes
    app.use((req, res, next) => {
        const startTime = Date.now();
        const requestId = `${startTime}`;
        
        logger.info(`[${requestId}] Début de la requête ${req.method} ${req.path}`);
        
        // Intercepter la réponse
        const originalSend = res.send;
        res.send = function(body) {
            const duration = Date.now() - startTime;
            logger.info(`[${requestId}] Fin de la requête ${req.method} ${req.path} - Status: ${res.statusCode} - Durée: ${duration}ms`);
            return originalSend.call(this, body);
        };
        
        next();
    });
    
    // Routes de base
    app.get('/', (req, res) => {
        res.json({
            message: 'ToolBox API Node.js est en ligne!',
            version: '0.1.0',
            endpoints: [
                '/api/v1/copy',
                '/api/v1/ssh',
                '/api/v1/remote',
                '/api/v1/smartauto'
            ]
        });
    });
    
    // Health check endpoint
    app.get('/api/health', (req, res) => {
        res.json({
            status: 'ok',
            service: 'toolbox-api',
            version: '0.1.0'
        });
    });
    
    // Enregistrement des routes avec préfixes
    app.use(`${config.API_PREFIX}/copy`, copyRoutes);
    app.use(`${config.API_PREFIX}/ssh`, sshRoutes);
    app.use(`${config.API_PREFIX}/remote`, remoteRoutes);
    app.use(`${config.API_PREFIX}/smartauto`, smartautoRoutes);
    
    // Route 404 pour les endpoints non trouvés
    app.use('*', (req, res) => {
        logger.warning(`Route non trouvée: ${req.method} ${req.path}`);
        res.status(404).json({
            error: 'Route non trouvée',
            path: req.path,
            method: req.method
        });
    });
    
    // Gestion globale des erreurs (doit venir après toutes les routes)
    app.use((err, req, res, next) => {
        const requestId = Date.now();
        logger.error(`[${requestId}] Exception non gérée: ${req.method} ${req.path} - ${err.message}`, err);
        
        res.status(500).json({
            error: 'Erreur interne du serveur',
            message: config.DEBUG ? err.message : 'Une erreur est survenue'
        });
    });
    
    logger.info('Application Express créée et configurée');
    return app;
}

// Démarrage du serveur
const app = createApp();

const server = app.listen(config.API_PORT, config.API_HOST, () => {
    const logLevel = config.LOG_LEVEL;
    if (logLevel !== 'WARNING') {
        logger.info(`Niveau de logging configuré à ${logLevel}`);
    }
    if (logLevel === 'DEBUG') {
        logger.info('==== MODE DEBUG ACTIVÉ - Les logs détaillés seront affichés ====');
    }
    
    if (logLevel !== 'WARNING') {
        logger.info(`Serveur démarré sur ${config.API_HOST}:${config.API_PORT}`);
    }
    
    console.log(`🚀 Toolbox API Node.js listening on http://${config.API_HOST}:${config.API_PORT}`);
});

// Gestion de l'arrêt propre
function gracefulShutdown(signal) {
    logger.info(`🛑 Signal ${signal} reçu, fermeture propre en cours...`);
    
    server.close(async () => {
        logger.info('✅ Serveur HTTP fermé');
        
        try {
            // Aucun service distant à fermer désormais
        } catch (e) {
            logger.warn(`Erreur lors de l'arrêt des services: ${e.message}`);
        }
        
        logger.info('✅ Fermeture terminée');
        process.exit(0);
    });
    
    // Force la fermeture après 10 secondes
    setTimeout(() => {
        logger.error('⚠️ Fermeture forcée après timeout');
        process.exit(1);
    }, 10000);
}

// Intercepter les signaux d'arrêt
process.on('SIGINT', () => gracefulShutdown('SIGINT'));   // Ctrl+C
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // Docker/PM2
process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT')); // Quit

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
    logger.error('❌ Exception non capturée:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('❌ Promise rejetée non gérée:', reason);
    logger.error('Promise:', promise);
    // Ne pas arrêter le serveur pour une Promise rejetée, juste logger
});

export default app;