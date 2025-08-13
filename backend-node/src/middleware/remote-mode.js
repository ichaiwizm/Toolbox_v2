import { getLogger } from '../utils/logger.js';

const logger = getLogger('toolbox.middleware.remote');

/**
 * Middleware de détection du mode distant
 * Analyse les requêtes pour détecter si elles concernent une opération distante
 */

/**
 * Détecte si la requête est en mode distant
 * @param {Object} req - Requête Express
 * @returns {boolean} True si mode distant détecté
 */
export function detectRemoteMode(req) {
    // Vérifier la présence d'une configuration SSH
    if (req.body?.ssh_connection || req.validatedBody?.ssh_connection) {
        return true;
    }
    
    // Vérifier les headers personnalisés
    if (req.headers['x-toolbox-mode'] === 'remote') {
        return true;
    }
    
    // Vérifier les paramètres de query
    if (req.query?.remote === 'true') {
        return true;
    }
    
    return false;
}

/**
 * Middleware qui enrichit la requête avec des informations sur le mode distant
 */
export function remoteDetectionMiddleware(req, res, next) {
    // Détecter le mode distant
    const isRemote = detectRemoteMode(req);
    
    // Enrichir l'objet req avec les informations
    req.remoteMode = {
        isRemote,
        sshConnection: req.body?.ssh_connection || req.validatedBody?.ssh_connection || null,
        timestamp: Date.now()
    };
    
    // Logger en mode debug
    if (isRemote) {
        logger.debug(`Mode distant détecté pour ${req.method} ${req.path}`);
        
        // Logger la connexion SSH (sans le mot de passe)
        if (req.remoteMode.sshConnection) {
            const safeConnection = {
                host: req.remoteMode.sshConnection.host,
                port: req.remoteMode.sshConnection.port,
                username: req.remoteMode.sshConnection.username
            };
            logger.debug('Connexion SSH:', safeConnection);
        }
    }
    
    next();
}

/**
 * Middleware qui redirige automatiquement les requêtes de copie vers le mode distant
 * Utilise cette fonction sur les routes de copie pour supporter le mode distant de manière transparente
 */
export function autoRemoteRedirect(req, res, next) {
    // Seulement pour les routes de copie
    if (!req.path.startsWith('/advanced/')) {
        return next();
    }
    
    // Si mode distant détecté, rediriger vers l'API remote
    if (req.remoteMode?.isRemote) {
        const remotePath = req.body.remote_path || '/';
        const sshConnection = req.remoteMode.sshConnection;
        
        // Construire la requête pour l'API remote
        const remoteRequest = {
            ssh_connection: sshConnection,
            remote_path: remotePath,
            sync_options: {
                recursive: req.validatedBody?.recursive !== false,
                excludeExtensions: req.validatedBody?.rules?.exclude_extensions || [],
                excludePatterns: req.validatedBody?.rules?.exclude_patterns || [],
                excludeDirectories: req.validatedBody?.rules?.exclude_directories || []
            }
        };
        
        // Déterminer l'endpoint distant
        let remoteEndpoint;
        if (req.path.includes('/scan')) {
            remoteEndpoint = '/scan';
        } else if (req.path.includes('/format-content')) {
            remoteEndpoint = '/format-content';
        } else {
            return next(); // Laisser passer si on ne sait pas quoi faire
        }
        
        logger.info(`Redirection vers mode distant: ${remoteEndpoint}`);
        
        // Modifier la requête pour l'API remote
        req.body = remoteRequest;
        req.validatedBody = remoteRequest;
        req.url = remoteEndpoint;
        req.path = remoteEndpoint;
        
        // Indiquer que la requête a été redirigée
        req.redirectedFromCopy = true;
    }
    
    next();
}

/**
 * Middleware de validation pour les requêtes distantes
 * Vérifie que les informations SSH sont complètes
 */
export function validateRemoteRequest(req, res, next) {
    if (!req.remoteMode?.isRemote) {
        return next();
    }
    
    const sshConnection = req.remoteMode.sshConnection;
    
    if (!sshConnection) {
        return res.status(400).json({
            error: 'Configuration SSH manquante',
            message: 'Une connexion SSH est requise pour les opérations distantes'
        });
    }
    
    // Vérifier les champs obligatoires
    const required = ['host', 'username'];
    const missing = required.filter(field => !sshConnection[field]);
    
    if (missing.length > 0) {
        return res.status(400).json({
            error: 'Configuration SSH incomplète',
            message: `Champs manquants: ${missing.join(', ')}`
        });
    }
    
    // Valider le port
    if (sshConnection.port && (sshConnection.port < 1 || sshConnection.port > 65535)) {
        return res.status(400).json({
            error: 'Port SSH invalide',
            message: 'Le port doit être entre 1 et 65535'
        });
    }
    
    next();
}