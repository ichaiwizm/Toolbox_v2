import express from 'express';
import Joi from 'joi';
import path from 'path';
import fs from 'fs';
import { scanDirectory, readFileContent, formatFileForCopy } from '../utils/file-utils.js';
import { isValidDirectory, sanitizePath, formatPathError } from '../utils/path-utils.js';
import { getLogger } from '../utils/logger.js';

const router = express.Router();
const logger = getLogger('toolbox.copy');

// Schémas de validation Joi
const AdvancedCopyRuleSchema = Joi.object({
    exclude_extensions: Joi.array().items(Joi.string()).default([]),
    exclude_patterns: Joi.array().items(Joi.string()).default([]),
    exclude_directories: Joi.array().items(Joi.string()).default([]),
    include_extensions: Joi.array().items(Joi.string()).default([]),
    include_patterns: Joi.array().items(Joi.string()).default([])
});

const AdvancedCopyRequestSchema = Joi.object({
    directories: Joi.array().items(Joi.string()).default([]),
    files: Joi.array().items(Joi.string()).default([]),
    rules: AdvancedCopyRuleSchema.default({}),
    recursive: Joi.boolean().default(true)
});

// Middleware de validation
function validateRequest(schema) {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                error: 'Validation error',
                details: error.details.map(d => d.message)
            });
        }
        req.validatedBody = value;
        next();
    };
}

/**
 * Scanne les fichiers selon les critères spécifiés
 */
router.post('/advanced/scan', validateRequest(AdvancedCopyRequestSchema), async (req, res) => {
    const request = req.validatedBody;
    
    logger.info(`Démarrage du scan avec ${request.directories.length} dossiers et ${request.files.length} fichiers`);
    
    const matches = [];
    let totalSubdirectories = 0;
    const invalidPaths = [];
    
    try {
        // Analyser les dossiers spécifiés
        for (const directory of request.directories) {
            const dirPath = sanitizePath(directory);
            logger.info(`Traitement du dossier: ${dirPath}`);
            
            try {
                if (!isValidDirectory(dirPath)) {
                    logger.warning(`Dossier non valide: ${dirPath}`);
                    invalidPaths.push(formatPathError(directory, "not_found"));
                    continue;
                }
                
                // Calculer le nombre de sous-dossiers si récursif
                if (request.recursive) {
                    try {
                        function countSubdirs(dir) {
                            let count = 0;
                            try {
                                const items = fs.readdirSync(dir);
                                for (const item of items) {
                                    const itemPath = path.join(dir, item);
                                    try {
                                        const stats = fs.statSync(itemPath);
                                        if (stats.isDirectory()) {
                                            // Vérifier si le dossier est exclu
                                            if (!request.rules.exclude_directories.includes(item)) {
                                                count++;
                                                count += countSubdirs(itemPath);
                                            }
                                        }
                                    } catch (itemError) {
                                        logger.warning(`Erreur d'accès à ${itemPath}: ${itemError.message}`);
                                    }
                                }
                            } catch (readError) {
                                logger.error(`Erreur lors de la lecture de ${dir}: ${readError.message}`);
                            }
                            return count;
                        }
                        totalSubdirectories += countSubdirs(dirPath);
                    } catch (walkError) {
                        logger.error(`Erreur lors du parcours de ${dirPath}: ${walkError.message}`);
                        invalidPaths.push(formatPathError(directory, `Erreur lors du parcours: ${walkError.message}`));
                    }
                }
                
                // Rechercher les fichiers correspondants
                logger.info(`Scan du dossier: ${dirPath} (récursif=${request.recursive})`);
                const scanResult = scanDirectory(dirPath, {
                    excludeExtensions: request.rules.exclude_extensions,
                    includeExtensions: request.rules.include_extensions,
                    excludePatterns: request.rules.exclude_patterns,
                    includePatterns: request.rules.include_patterns,
                    excludeDirectories: request.rules.exclude_directories,
                    recursive: request.recursive
                });
                
                const dirMatches = scanResult.files;
                
                // Ajouter les erreurs de scan aux chemins invalides
                for (const errorMsg of scanResult.errors) {
                    logger.warning(`Erreur pendant le scan: ${errorMsg}`);
                    invalidPaths.push(formatPathError(directory, errorMsg));
                }
                
                logger.info(`Trouvé ${dirMatches.length} fichiers dans ${dirPath}`);
                
                // Ajouter la taille formatée pour chaque fichier
                for (const match of dirMatches) {
                    const size = match.size;
                    let sizeHuman;
                    if (size < 1024) {
                        sizeHuman = `${size} octets`;
                    } else if (size < 1024 * 1024) {
                        sizeHuman = `${(size / 1024).toFixed(1)} Ko`;
                    } else {
                        sizeHuman = `${(size / (1024 * 1024)).toFixed(1)} Mo`;
                    }
                    
                    match.size_human = sizeHuman;
                }
                
                matches.push(...dirMatches);
                
            } catch (error) {
                logger.error(`Erreur générale lors du traitement de ${dirPath}: ${error.message}`);
                invalidPaths.push(formatPathError(directory, error.message));
            }
        }
        
        // Ajouter les fichiers spécifiques s'ils respectent les règles
        for (const filePath of request.files) {
            try {
                const cleanFilePath = sanitizePath(filePath);
                logger.info(`Traitement du fichier: ${cleanFilePath}`);
                
                try {
                    const stats = fs.statSync(cleanFilePath);
                    if (!stats.isFile()) {
                        logger.warning(`Fichier non trouvé: ${cleanFilePath}`);
                        invalidPaths.push(formatPathError(filePath, "not_found"));
                        continue;
                    }
                    
                    // Vérifier si le fichier correspond aux règles
                    const extension = path.extname(cleanFilePath).slice(1);
                    const filename = path.basename(cleanFilePath);
                    
                    // Vérification des extensions
                    if (request.rules.include_extensions.length > 0) {
                        // Si include_extensions est spécifié, seules ces extensions sont acceptées
                        if (!request.rules.include_extensions.includes(extension)) {
                            logger.info(`Fichier exclu (include_extensions): ${cleanFilePath}`);
                            continue;
                        }
                    } else if (request.rules.exclude_extensions.includes(extension)) {
                        // Sinon, utiliser exclude_extensions
                        logger.info(`Fichier exclu (extension): ${cleanFilePath}`);
                        continue;
                    }
                    
                    // Vérification des motifs
                    if (request.rules.include_patterns.length > 0) {
                        // Si include_patterns est spécifié, seuls ces motifs sont acceptés
                        let includeMatch = false;
                        for (const pattern of request.rules.include_patterns) {
                            try {
                                const regex = new RegExp(pattern);
                                if (regex.test(filename)) {
                                    includeMatch = true;
                                    break;
                                }
                            } catch (regexError) {
                                logger.warning(`Motif regex invalide (include): ${pattern}`);
                            }
                        }
                        if (!includeMatch) {
                            logger.info(`Fichier exclu (include_patterns): ${cleanFilePath}`);
                            continue;
                        }
                    } else {
                        // Sinon, utiliser exclude_patterns
                        let excludeMatch = false;
                        for (const pattern of request.rules.exclude_patterns) {
                            try {
                                const regex = new RegExp(pattern);
                                if (regex.test(filename)) {
                                    excludeMatch = true;
                                    break;
                                }
                            } catch (regexError) {
                                logger.warning(`Motif regex invalide (exclude): ${pattern}`);
                            }
                        }
                        
                        if (excludeMatch) {
                            logger.info(`Fichier exclu (motif): ${cleanFilePath}`);
                            continue;
                        }
                    }
                    
                    // Vérification des sous-dossiers exclus
                    const fileDir = path.dirname(cleanFilePath);
                    const isExcluded = request.rules.exclude_directories.some(excludedDir => {
                        return path.basename(fileDir) === excludedDir || fileDir.includes(`/${excludedDir}/`);
                    });
                    
                    if (isExcluded) {
                        logger.info(`Fichier exclu (dossier parent): ${cleanFilePath}`);
                        continue;
                    }
                    
                    // Calculer la taille formatée
                    const fileSize = stats.size;
                    let fileSizeHuman;
                    if (fileSize < 1024) {
                        fileSizeHuman = `${fileSize} octets`;
                    } else if (fileSize < 1024 * 1024) {
                        fileSizeHuman = `${(fileSize / 1024).toFixed(1)} Ko`;
                    } else {
                        fileSizeHuman = `${(fileSize / (1024 * 1024)).toFixed(1)} Mo`;
                    }
                    
                    // Ajouter le fichier aux résultats
                    matches.push({
                        path: cleanFilePath.replace(/\\/g, '/'),
                        name: filename,
                        size: fileSize,
                        size_human: fileSizeHuman,
                        extension: extension
                    });
                    
                    logger.info(`Fichier ajouté aux résultats: ${cleanFilePath}`);
                    
                } catch (statError) {
                    logger.error(`Erreur d'accès au fichier ${cleanFilePath}: ${statError.message}`);
                    invalidPaths.push(formatPathError(filePath, `Erreur d'accès: ${statError.message}`));
                }
                
            } catch (error) {
                logger.error(`Erreur générale lors du traitement du fichier ${filePath}: ${error.message}`);
                invalidPaths.push(formatPathError(filePath, error.message));
            }
        }
        
        logger.info(`Scan terminé: ${matches.length} fichiers trouvés, ${invalidPaths.length} chemins invalides`);
        
        const result = {
            matches: matches,
            total_matches: matches.length,
            formatted_content: "",
            total_subdirectories: totalSubdirectories
        };
        
        if (invalidPaths.length > 0) {
            result.invalid_paths = invalidPaths;
        }
        
        res.json(result);
        
    } catch (error) {
        logger.error(`Erreur générale dans le scan: ${error.message}`);
        res.status(500).json({
            error: 'Erreur interne du serveur',
            message: error.message
        });
    }
});

/**
 * Récupère et formate le contenu des fichiers sélectionnés
 */
router.post('/advanced/format-content', validateRequest(AdvancedCopyRequestSchema), async (req, res) => {
    logger.info('Début du formatage du contenu des fichiers');
    
    try {
        // D'abord, obtenir les fichiers correspondants
        const scanRequest = {
            method: 'POST',
            url: '/advanced/scan',
            body: req.body,
            validatedBody: req.validatedBody
        };
        
        // Simuler l'appel interne au scan
        let scanResult;
        try {
            // Réutiliser la logique du scan
            const request = req.validatedBody;
            const matches = [];
            let totalSubdirectories = 0;
            const invalidPaths = [];
            
            // Copier la logique de scan (simplifiée pour éviter la duplication)
            for (const directory of request.directories) {
                const dirPath = sanitizePath(directory);
                
                if (!isValidDirectory(dirPath)) {
                    invalidPaths.push(formatPathError(directory, "not_found"));
                    continue;
                }
                
                const scanDirectoryResult = scanDirectory(dirPath, {
                    excludeExtensions: request.rules.exclude_extensions,
                    includeExtensions: request.rules.include_extensions,
                    excludePatterns: request.rules.exclude_patterns,
                    includePatterns: request.rules.include_patterns,
                    excludeDirectories: request.rules.exclude_directories,
                    recursive: request.recursive
                });
                
                // Ajouter la taille formatée
                for (const match of scanDirectoryResult.files) {
                    const size = match.size;
                    let sizeHuman;
                    if (size < 1024) {
                        sizeHuman = `${size} octets`;
                    } else if (size < 1024 * 1024) {
                        sizeHuman = `${(size / 1024).toFixed(1)} Ko`;
                    } else {
                        sizeHuman = `${(size / (1024 * 1024)).toFixed(1)} Mo`;
                    }
                    match.size_human = sizeHuman;
                }
                
                matches.push(...scanDirectoryResult.files);
                invalidPaths.push(...scanDirectoryResult.errors.map(error => formatPathError(directory, error)));
            }
            
            // Traiter les fichiers spécifiques
            for (const filePath of request.files) {
                const cleanFilePath = sanitizePath(filePath);
                try {
                    const stats = fs.statSync(cleanFilePath);
                    if (stats.isFile()) {
                        const extension = path.extname(cleanFilePath).slice(1);
                        const filename = path.basename(cleanFilePath);
                        
                        // Appliquer les mêmes règles de filtrage
                        let extensionAllowed = false;
                        if (request.rules.include_extensions.length > 0) {
                            // Si include_extensions est spécifié, seules ces extensions sont acceptées
                            extensionAllowed = request.rules.include_extensions.includes(extension);
                        } else {
                            // Sinon, utiliser exclude_extensions
                            extensionAllowed = !request.rules.exclude_extensions.includes(extension);
                        }
                        
                        if (extensionAllowed) {
                            let patternAllowed = false;
                            if (request.rules.include_patterns.length > 0) {
                                // Si include_patterns est spécifié, seuls ces motifs sont acceptés
                                for (const pattern of request.rules.include_patterns) {
                                    try {
                                        if (new RegExp(pattern).test(filename)) {
                                            patternAllowed = true;
                                            break;
                                        }
                                    } catch (e) { /* ignore invalid regex */ }
                                }
                            } else {
                                // Sinon, utiliser exclude_patterns
                                patternAllowed = true;
                                for (const pattern of request.rules.exclude_patterns) {
                                    try {
                                        if (new RegExp(pattern).test(filename)) {
                                            patternAllowed = false;
                                            break;
                                        }
                                    } catch (e) { /* ignore invalid regex */ }
                                }
                            }
                            
                            if (patternAllowed) {
                                const fileSize = stats.size;
                                let fileSizeHuman;
                                if (fileSize < 1024) {
                                    fileSizeHuman = `${fileSize} octets`;
                                } else if (fileSize < 1024 * 1024) {
                                    fileSizeHuman = `${(fileSize / 1024).toFixed(1)} Ko`;
                                } else {
                                    fileSizeHuman = `${(fileSize / (1024 * 1024)).toFixed(1)} Mo`;
                                }
                                
                                matches.push({
                                    path: cleanFilePath.replace(/\\/g, '/'),
                                    name: filename,
                                    size: fileSize,
                                    size_human: fileSizeHuman,
                                    extension: extension
                                });
                            }
                        }
                    }
                } catch (error) {
                    invalidPaths.push(formatPathError(filePath, error.message));
                }
            }
            
            scanResult = {
                matches,
                total_subdirectories: totalSubdirectories,
                invalid_paths: invalidPaths
            };
            
        } catch (scanError) {
            logger.error(`Erreur lors du scan pour le formatage: ${scanError.message}`);
            return res.status(500).json({
                error: 'Erreur lors du scan des fichiers',
                message: scanError.message
            });
        }
        
        const matches = scanResult.matches;
        const totalSubdirectories = scanResult.total_subdirectories;
        let invalidPaths = scanResult.invalid_paths || [];
        
        logger.info(`Formatage du contenu pour ${matches.length} fichiers`);
        
        // Récupérer et formater le contenu
        let formattedContent = "";
        for (const fileMatch of matches) {
            const filePath = fileMatch.path;
            try {
                logger.info(`Lecture du fichier: ${filePath}`);
                const content = readFileContent(filePath);
                
                // Si le contenu commence par "[Erreur" ou similaire, c'est une erreur
                if (content.startsWith("[Erreur") || content.startsWith("[Fichier non") || content.startsWith("[Contenu binaire")) {
                    logger.warning(`Problème lors de la lecture de ${filePath}: ${content}`);
                    formattedContent += `=== ${filePath} (${fileMatch.size_human}) ===\n${content}\n\n---\n\n`;
                    
                    if (!content.startsWith("[Contenu binaire")) {
                        invalidPaths.push(formatPathError(filePath, content));
                    }
                } else {
                    formattedContent += formatFileForCopy(filePath, content, fileMatch.size_human);
                }
            } catch (error) {
                const errorMsg = `Erreur lors de la lecture: ${error.message}`;
                logger.error(`Erreur lors de la lecture de ${filePath}: ${error.message}`);
                formattedContent += `=== ${filePath} (${fileMatch.size_human}) ===\n${errorMsg}\n\n---\n\n`;
                invalidPaths.push(formatPathError(filePath, errorMsg));
            }
        }
        
        logger.info('Formatage du contenu terminé');
        
        const result = {
            matches: matches,
            total_matches: matches.length,
            formatted_content: formattedContent,
            total_subdirectories: totalSubdirectories
        };
        
        if (invalidPaths.length > 0) {
            result.invalid_paths = invalidPaths;
        }
        
        res.json(result);
        
    } catch (error) {
        logger.error(`Erreur générale dans le formatage: ${error.message}`);
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