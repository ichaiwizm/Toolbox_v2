import fs from 'fs';
import path from 'path';
import { directoryScannerService } from './directory-scanner-service.js';
import { fileReaderService } from './file-reader-service.js';
import { contentFormatterService } from './content-formatter-service.js';
import { fileFilterService } from './file-filter-service.js';
import { isValidDirectory, sanitizePath, formatPathError } from '../utils/path-utils.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('toolbox.copy-service');

/**
 * Service de gestion des opérations de copie
 * Extrait la logique métier du controller
 */
export class CopyService {
    
    /**
     * Scanne les fichiers selon les critères spécifiés
     * @param {Object} request - Configuration de scan
     * @returns {Promise<Object>} Résultats du scan
     */
    async scanFiles(request) {
        logger.info(`Démarrage du scan avec ${request.directories.length} dossiers et ${request.files.length} fichiers`);
        
        const matches = [];
        let totalSubdirectories = 0;
        const invalidPaths = [];
        
        try {
            // Traitement des dossiers
            for (const directory of request.directories) {
                const result = await this._processDirectory(directory, request, invalidPaths);
                matches.push(...result.matches);
                totalSubdirectories += result.subdirectories;
            }
            
            // Traitement des fichiers spécifiques
            for (const filePath of request.files) {
                const result = await this._processFile(filePath, request, invalidPaths);
                if (result) {
                    matches.push(result);
                }
            }
            
            logger.info(`Scan terminé: ${matches.length} fichiers trouvés, ${invalidPaths.length} chemins invalides`);
            
            const scanResult = {
                matches: matches,
                total_matches: matches.length,
                formatted_content: "",
                total_subdirectories: totalSubdirectories
            };
            
            if (invalidPaths.length > 0) {
                scanResult.invalid_paths = invalidPaths;
            }
            
            return scanResult;
            
        } catch (error) {
            logger.error(`Erreur générale dans le scan: ${error.message}`);
            throw new Error(`Erreur lors du scan: ${error.message}`);
        }
    }
    
    /**
     * Scanne et formate le contenu des fichiers
     * @param {Object} request - Configuration de scan
     * @returns {Promise<Object>} Résultats avec contenu formaté
     */
    async scanAndFormatContent(request) {
        logger.info('Début du formatage du contenu des fichiers');
        
        try {
            // D'abord obtenir la liste des fichiers
            const scanResult = await this.scanFiles(request);
            const matches = scanResult.matches;
            const invalidPaths = scanResult.invalid_paths || [];
            
            logger.info(`Formatage du contenu pour ${matches.length} fichiers`);
            
            // Formater le contenu de chaque fichier
            let formattedContent = "";
            for (const fileMatch of matches) {
                try {
                    const result = await this._formatFileContent(fileMatch);
                    formattedContent += result.content;
                    
                    if (result.hasError) {
                        invalidPaths.push(formatPathError(fileMatch.path, result.errorMessage));
                    }
                } catch (error) {
                    const errorMsg = `Erreur lors de la lecture: ${error.message}`;
                    logger.error(`Erreur lors de la lecture de ${fileMatch.path}: ${error.message}`);
                    formattedContent += `=== ${fileMatch.path} (${fileMatch.size_human}) ===\n${errorMsg}\n\n---\n\n`;
                    invalidPaths.push(formatPathError(fileMatch.path, errorMsg));
                }
            }
            
            logger.info('Formatage du contenu terminé');
            
            const result = {
                matches: matches,
                total_matches: matches.length,
                formatted_content: formattedContent,
                total_subdirectories: scanResult.total_subdirectories
            };
            
            if (invalidPaths.length > 0) {
                result.invalid_paths = invalidPaths;
            }
            
            return result;
            
        } catch (error) {
            logger.error(`Erreur générale dans le formatage: ${error.message}`);
            throw new Error(`Erreur lors du formatage: ${error.message}`);
        }
    }
    
    /**
     * Traite un dossier et retourne les fichiers correspondants
     * @private
     */
    async _processDirectory(directory, request, invalidPaths) {
        const dirPath = sanitizePath(directory);
        logger.info(`Traitement du dossier: ${dirPath}`);
        
        const result = { matches: [], subdirectories: 0 };
        
        try {
            if (!isValidDirectory(dirPath)) {
                logger.warning(`Dossier non valide: ${dirPath}`);
                invalidPaths.push(formatPathError(directory, "not_found"));
                return result;
            }
            
            // Compter les sous-dossiers si récursif
            if (request.recursive) {
                result.subdirectories = directoryScannerService.countSubdirectories(
                    dirPath, 
                    request.rules.exclude_directories
                );
            }
            
            // Scanner le dossier
            logger.info(`Scan du dossier: ${dirPath} (récursif=${request.recursive})`);
            const scanResult = directoryScannerService.scanDirectory(dirPath, {
                excludeExtensions: request.rules.exclude_extensions,
                includeExtensions: request.rules.include_extensions,
                excludePatterns: request.rules.exclude_patterns,
                includePatterns: request.rules.include_patterns,
                excludeDirectories: request.rules.exclude_directories,
                recursive: request.recursive
            });
            
            // Ajouter les tailles formatées
            const dirMatches = scanResult.files.map(match => ({
                ...match,
                size_human: this._formatFileSize(match.size)
            }));
            
            result.matches = dirMatches;
            
            // Ajouter les erreurs
            for (const errorMsg of scanResult.errors) {
                logger.warning(`Erreur pendant le scan: ${errorMsg}`);
                invalidPaths.push(formatPathError(directory, errorMsg));
            }
            
            logger.info(`Trouvé ${dirMatches.length} fichiers dans ${dirPath}`);
            
        } catch (error) {
            logger.error(`Erreur générale lors du traitement de ${dirPath}: ${error.message}`);
            invalidPaths.push(formatPathError(directory, error.message));
        }
        
        return result;
    }
    
    /**
     * Traite un fichier spécifique
     * @private
     */
    async _processFile(filePath, request, invalidPaths) {
        try {
            const cleanFilePath = sanitizePath(filePath);
            logger.info(`Traitement du fichier: ${cleanFilePath}`);
            
            const stats = fs.statSync(cleanFilePath);
            if (!stats.isFile()) {
                logger.warning(`Fichier non trouvé: ${cleanFilePath}`);
                invalidPaths.push(formatPathError(filePath, "not_found"));
                return null;
            }
            
            // Vérifier si le fichier respecte les règles
            const extension = path.extname(cleanFilePath).slice(1);
            const filename = path.basename(cleanFilePath);
            
            if (!fileFilterService.matchesAllRules(filename, extension, request.rules)) {
                return null;
            }
            
            // Vérifier les dossiers exclus
            const fileDir = path.dirname(cleanFilePath);
            const isExcluded = request.rules.exclude_directories.some(excludedDir => {
                return path.basename(fileDir) === excludedDir || fileDir.includes(`/${excludedDir}/`);
            });
            
            if (isExcluded) {
                logger.info(`Fichier exclu (dossier parent): ${cleanFilePath}`);
                return null;
            }
            
            return {
                path: cleanFilePath.replace(/\\/g, '/'),
                name: filename,
                size: stats.size,
                size_human: this._formatFileSize(stats.size),
                extension: extension
            };
            
        } catch (statError) {
            logger.error(`Erreur d'accès au fichier ${filePath}: ${statError.message}`);
            invalidPaths.push(formatPathError(filePath, `Erreur d'accès: ${statError.message}`));
            return null;
        }
    }
    
    /**
     * Formate le contenu d'un fichier
     * @private
     */
    async _formatFileContent(fileMatch) {
        const filePath = fileMatch.path;
        logger.info(`Lecture du fichier: ${filePath}`);
        
        const content = fileReaderService.readFileContent(filePath);
        
        // Utiliser le service de formatage avec gestion d'erreurs
        const formatResult = contentFormatterService.formatFileWithErrorHandling(
            {
                path: filePath,
                sizeHuman: fileMatch.size_human
            },
            content
        );
        
        return {
            content: formatResult.formattedContent,
            hasError: formatResult.hasError && formatResult.errorType !== 'binary_content',
            errorMessage: formatResult.errorMessage
        };
    }
    
    
    /**
     * Formate la taille d'un fichier
     * @private
     */
    _formatFileSize(size) {
        if (size < 1024) {
            return `${size} octets`;
        } else if (size < 1024 * 1024) {
            return `${(size / 1024).toFixed(1)} Ko`;
        } else {
            return `${(size / (1024 * 1024)).toFixed(1)} Mo`;
        }
    }
}

// Export d'une instance singleton
export const copyService = new CopyService();