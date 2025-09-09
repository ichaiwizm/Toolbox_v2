import Joi from 'joi';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('toolbox.middleware.validation');

/**
 * Schémas de validation centralisés
 */

// Schéma pour les règles de filtrage des fichiers
export const FileRulesSchema = Joi.object({
    exclude_extensions: Joi.array().items(Joi.string()).default([]),
    exclude_patterns: Joi.array().items(Joi.string()).default([]),
    exclude_directories: Joi.array().items(Joi.string()).default([]),
    include_extensions: Joi.array().items(Joi.string()).default([]),
    include_patterns: Joi.array().items(Joi.string()).default([])
});

// Schéma pour une connexion SSH
export const SSHConnectionSchema = Joi.object({
    host: Joi.string().required().min(1).max(255),
    port: Joi.number().integer().min(1).max(65535).default(22),
    username: Joi.string().required().min(1).max(255),
    password: Joi.string().allow('').optional()
});

// Schéma pour les requêtes de copie avancée
export const AdvancedCopyRequestSchema = Joi.object({
    directories: Joi.array().items(Joi.string()).default([]),
    files: Joi.array().items(Joi.string()).default([]),
    rules: FileRulesSchema.default({}),
    recursive: Joi.boolean().default(true),
    ssh_connection: SSHConnectionSchema.optional() // Support pour mode distant
});

// Schéma pour les requêtes de synchronisation distante
export const RemoteSyncRequestSchema = Joi.object({
    ssh_connection: SSHConnectionSchema.required(),
    // Support des chemins multiples : répertoires ET fichiers spécifiques
    directories: Joi.array().items(Joi.string().min(1)).default([]),
    files: Joi.array().items(Joi.string().min(1)).default([]),
    // Maintien de la compatibilité ascendante avec remote_path
    remote_path: Joi.string().optional(),
    sync_options: Joi.object({
        recursive: Joi.boolean().default(true),
        excludePatterns: Joi.array().items(Joi.string()).default([]),
        excludeExtensions: Joi.array().items(Joi.string()).default([]),
        excludeDirectories: Joi.array().items(Joi.string()).default([])
    }).default({}),
    allowExpired: Joi.boolean().default(false)
}).custom((value, helpers) => {
    // Validation : au moins un chemin requis
    const hasPaths = (value.directories && value.directories.length > 0) || 
                     (value.files && value.files.length > 0) ||
                     (value.remote_path && value.remote_path.length > 0);
    
    if (!hasPaths) {
        return helpers.error('custom.atLeastOnePath', { 
            message: 'Au moins un répertoire, fichier ou remote_path doit être spécifié' 
        });
    }

    // Migration automatique : remote_path → directories[0]
    if (value.remote_path && (!value.directories || value.directories.length === 0)) {
        value.directories = [value.remote_path];
        delete value.remote_path;
    }
    
    return value;
});

// Schéma pour le statut de cache
export const CacheStatusRequestSchema = Joi.object({
    ssh_connection: SSHConnectionSchema.required(),
    // Support des chemins multiples
    directories: Joi.array().items(Joi.string().min(1)).default([]),
    files: Joi.array().items(Joi.string().min(1)).default([]),
    // Maintien de la compatibilité ascendante
    remote_path: Joi.string().optional(),
    sync_options: Joi.object().default({})
}).custom((value, helpers) => {
    // Validation et migration identique au schéma RemoteSyncRequestSchema
    const hasPaths = (value.directories && value.directories.length > 0) || 
                     (value.files && value.files.length > 0) ||
                     (value.remote_path && value.remote_path.length > 0);
    
    if (!hasPaths) {
        return helpers.error('custom.atLeastOnePath', { 
            message: 'Au moins un répertoire, fichier ou remote_path doit être spécifié' 
        });
    }

    if (value.remote_path && (!value.directories || value.directories.length === 0)) {
        value.directories = [value.remote_path];
        delete value.remote_path;
    }
    
    return value;
});

// Schéma pour le test de connexion SSH
export const SSHTestRequestSchema = Joi.object({
    host: Joi.string().required().min(1).max(255),
    port: Joi.number().integer().min(1).max(65535).default(22),
    username: Joi.string().required().min(1).max(255),
    password: Joi.string().allow('').optional()
});

// Schéma pour le nettoyage des caches
export const CacheCleanupRequestSchema = Joi.object({
    maxAgeHours: Joi.number().integer().min(1).max(8760).default(72) // Max 1 an
});

/**
 * Middleware factory pour la validation des requêtes
 * @param {Object} schema - Schéma Joi à utiliser pour la validation
 * @param {Object} options - Options de validation
 * @returns {Function} Middleware Express
 */
export function validateRequest(schema, options = {}) {
    const { 
        allowUnknown = false, 
        stripUnknown = true,
        abortEarly = false 
    } = options;
    
    return (req, res, next) => {
        const requestId = Date.now();
        
        // Valider le body de la requête
        const { error, value } = schema.validate(req.body, {
            allowUnknown,
            stripUnknown,
            abortEarly
        });
        
        if (error) {
            logger.warning(`[${requestId}] Validation échouée pour ${req.method} ${req.path}:`, {
                errors: error.details.map(d => ({
                    field: d.path.join('.'),
                    message: d.message,
                    value: d.context?.value
                }))
            });
            
            return res.status(400).json({
                error: 'Données de requête invalides',
                details: error.details.map(d => ({
                    field: d.path.join('.'),
                    message: d.message
                })),
                requestId
            });
        }
        
        // Enrichir la requête avec les données validées
        req.validatedBody = value;
        req.validationId = requestId;
        
        logger.debug(`[${requestId}] Validation réussie pour ${req.method} ${req.path}`);
        next();
    };
}

/**
 * Middleware de validation pour les paramètres de query
 * @param {Object} schema - Schéma Joi pour les query params
 * @returns {Function} Middleware Express
 */
export function validateQuery(schema) {
    return (req, res, next) => {
        const requestId = req.validationId || Date.now();
        
        const { error, value } = schema.validate(req.query, {
            allowUnknown: false,
            stripUnknown: true
        });
        
        if (error) {
            logger.warning(`[${requestId}] Validation query échouée:`, error.details);
            
            return res.status(400).json({
                error: 'Paramètres de requête invalides',
                details: error.details.map(d => ({
                    field: d.path.join('.'),
                    message: d.message
                })),
                requestId
            });
        }
        
        req.validatedQuery = value;
        next();
    };
}

/**
 * Middleware de validation pour les paramètres de route
 * @param {Object} schema - Schéma Joi pour les params
 * @returns {Function} Middleware Express
 */
export function validateParams(schema) {
    return (req, res, next) => {
        const requestId = req.validationId || Date.now();
        
        const { error, value } = schema.validate(req.params);
        
        if (error) {
            logger.warning(`[${requestId}] Validation params échouée:`, error.details);
            
            return res.status(400).json({
                error: 'Paramètres de route invalides',
                details: error.details.map(d => ({
                    field: d.path.join('.'),
                    message: d.message
                })),
                requestId
            });
        }
        
        req.validatedParams = value;
        next();
    };
}

/**
 * Middleware de validation composé (body + query + params)
 * @param {Object} schemas - Schémas pour body, query et params
 * @returns {Function} Middleware Express
 */
export function validateAll(schemas = {}) {
    const middlewares = [];
    
    if (schemas.body) {
        middlewares.push(validateRequest(schemas.body));
    }
    
    if (schemas.query) {
        middlewares.push(validateQuery(schemas.query));
    }
    
    if (schemas.params) {
        middlewares.push(validateParams(schemas.params));
    }
    
    // Retourner un middleware qui exécute tous les middlewares en séquence
    return (req, res, next) => {
        let index = 0;
        
        function runNextMiddleware() {
            if (index >= middlewares.length) {
                return next();
            }
            
            const middleware = middlewares[index++];
            middleware(req, res, (error) => {
                if (error) {
                    return next(error);
                }
                runNextMiddleware();
            });
        }
        
        runNextMiddleware();
    };
}

/**
 * Middleware de nettoyage des données sensibles
 * Supprime les mots de passe des logs et réponses
 */
export function sanitizeSensitiveData(req, res, next) {
    // Créer une version nettoyée pour les logs
    if (req.validatedBody) {
        req.sanitizedBody = { ...req.validatedBody };
        
        // Nettoyer les connexions SSH
        if (req.sanitizedBody.ssh_connection?.password) {
            req.sanitizedBody.ssh_connection = {
                ...req.sanitizedBody.ssh_connection,
                password: '[MASQUÉ]'
            };
        }
    }
    
    next();
}