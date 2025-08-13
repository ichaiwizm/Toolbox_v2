import fs from 'fs';
import path from 'path';
import { normalizePath } from '../utils/cross-platform-paths.js';
import { fileFilterService } from './file-filter-service.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('toolbox.directory-scanner');

/**
 * Service de scan des répertoires
 * Gère le parcours récursif des dossiers avec filtrage
 */
export class DirectoryScannerService {
    constructor() {
        this.maxFileSize = 5 * 1024 * 1024; // 5MB
        this.maxDepth = 20; // Protection contre la récursion infinie
    }
    
    /**
     * Scanne un dossier et retourne les fichiers correspondant aux critères
     * @param {string} directory - Chemin du dossier à scanner
     * @param {Object} options - Options de scan
     * @returns {Object} Résultats du scan avec fichiers et erreurs
     */
    scanDirectory(directory, options = {}) {
        const {
            excludeExtensions = [],
            includeExtensions = [],
            excludePatterns = [],
            includePatterns = [],
            excludeDirectories = [],
            recursive = true
        } = options;
        
        logger.debug(`Début scan dossier ${directory} (récursif=${recursive})`);
        
        // Normaliser le chemin pour l'environnement courant
        const normalizedDirectory = normalizePath(directory);
        logger.debug(`Chemin normalisé: "${directory}" → "${normalizedDirectory}"`);
        
        const results = [];
        const errors = [];
        
        // Vérifier que le dossier existe
        try {
            const stats = fs.statSync(normalizedDirectory);
            if (!stats.isDirectory()) {
                const errorMsg = `Le dossier ${normalizedDirectory} n'est pas un répertoire`;
                logger.error(errorMsg);
                return { files: results, errors: [errorMsg] };
            }
        } catch (error) {
            const errorMsg = `Le dossier ${normalizedDirectory} n'existe pas ou n'est pas accessible: ${error.message}`;
            logger.error(errorMsg);
            return { files: results, errors: [errorMsg] };
        }
        
        // Construire les règles de filtrage
        const rules = {
            include_extensions: includeExtensions,
            exclude_extensions: excludeExtensions,
            include_patterns: includePatterns,
            exclude_patterns: excludePatterns,
            exclude_directories: excludeDirectories
        };
        
        // Commencer le parcours
        this._walkDirectory(normalizedDirectory, rules, recursive, results, errors, 0);
        
        logger.debug(`Scan terminé: ${results.length} fichiers trouvés, ${errors.length} erreurs`);
        return { files: results, errors };
    }
    
    /**
     * Compte le nombre de sous-dossiers récursivement
     * @param {string} directory - Dossier de base
     * @param {Array<string>} excludeDirectories - Dossiers à exclure
     * @returns {number} Nombre de sous-dossiers
     */
    countSubdirectories(directory, excludeDirectories = []) {
        const normalizedDirectory = normalizePath(directory);
        return this._countSubdirs(normalizedDirectory, excludeDirectories, 0);
    }
    
    /**
     * Obtient une liste plate de tous les dossiers dans un répertoire
     * @param {string} directory - Répertoire racine
     * @param {boolean} recursive - Inclure les sous-dossiers
     * @returns {Array<string>} Liste des répertoires
     */
    getDirectoryList(directory, recursive = false) {
        const normalizedDirectory = normalizePath(directory);
        const directories = [];
        
        try {
            this._collectDirectories(normalizedDirectory, directories, recursive, 0);
        } catch (error) {
            logger.error(`Erreur collecte dossiers: ${error.message}`);
        }
        
        return directories;
    }
    
    /**
     * Fonction récursive pour parcourir les dossiers
     * @private
     */
    _walkDirectory(currentDir, rules, recursive, results, errors, depth) {
        if (depth > this.maxDepth) {
            logger.warning(`Profondeur maximale atteinte pour ${currentDir}`);
            return;
        }
        
        try {
            const items = fs.readdirSync(currentDir);
            
            for (const item of items) {
                const itemPath = path.join(currentDir, item);
                
                try {
                    const stats = fs.statSync(itemPath);
                    
                    if (stats.isFile()) {
                        this._processFile(itemPath, item, stats, rules, results);
                    } else if (stats.isDirectory() && recursive) {
                        this._processDirectory(itemPath, item, rules, recursive, results, errors, depth);
                    }
                    
                } catch (itemError) {
                    const errorMsg = `Erreur d'accès à '${itemPath}': ${itemError.message}`;
                    logger.warning(errorMsg);
                    errors.push(errorMsg);
                }
            }
            
        } catch (readError) {
            const errorMsg = `Erreur lors de la lecture de '${currentDir}': ${readError.message}`;
            logger.error(errorMsg);
            errors.push(errorMsg);
        }
    }
    
    /**
     * Traite un fichier individuel
     * @private
     */
    _processFile(itemPath, fileName, stats, rules, results) {
        const extension = path.extname(fileName).slice(1); // Sans le point
        
        // Vérifier la taille
        if (stats.size > this.maxFileSize) {
            logger.debug(`Fichier trop volumineux ignoré: ${itemPath} (${stats.size} octets)`);
            return;
        }
        
        // Appliquer les filtres
        if (!fileFilterService.matchesAllRules(fileName, extension, rules)) {
            return;
        }
        
        // Ajouter le fichier aux résultats
        results.push({
            path: itemPath.replace(/\\/g, '/'),
            name: fileName,
            size: stats.size,
            extension: extension,
            lastModified: stats.mtime
        });
        
        logger.debug(`Fichier ajouté: ${itemPath}`);
    }
    
    /**
     * Traite un dossier
     * @private
     */
    _processDirectory(itemPath, dirName, rules, recursive, results, errors, depth) {
        // Vérifier si le dossier est exclu
        if (rules.exclude_directories.includes(dirName)) {
            logger.debug(`Dossier exclu: ${itemPath}`);
            return;
        }
        
        // Parcourir récursivement
        this._walkDirectory(itemPath, rules, recursive, results, errors, depth + 1);
    }
    
    /**
     * Compte récursivement les sous-dossiers
     * @private
     */
    _countSubdirs(dir, excludeDirectories, depth) {
        if (depth > this.maxDepth) {
            return 0;
        }
        
        let count = 0;
        try {
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const itemPath = path.join(dir, item);
                try {
                    const stats = fs.statSync(itemPath);
                    if (stats.isDirectory() && !excludeDirectories.includes(item)) {
                        count++;
                        count += this._countSubdirs(itemPath, excludeDirectories, depth + 1);
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
    
    /**
     * Collecte récursivement les répertoires
     * @private
     */
    _collectDirectories(currentDir, directories, recursive, depth) {
        if (depth > this.maxDepth) {
            return;
        }
        
        try {
            const items = fs.readdirSync(currentDir);
            
            for (const item of items) {
                const itemPath = path.join(currentDir, item);
                
                try {
                    const stats = fs.statSync(itemPath);
                    
                    if (stats.isDirectory()) {
                        directories.push(itemPath.replace(/\\/g, '/'));
                        
                        if (recursive) {
                            this._collectDirectories(itemPath, directories, recursive, depth + 1);
                        }
                    }
                } catch (itemError) {
                    logger.warning(`Erreur d'accès à ${itemPath}: ${itemError.message}`);
                }
            }
        } catch (readError) {
            logger.error(`Erreur lecture dossier ${currentDir}: ${readError.message}`);
        }
    }
}

// Export d'une instance singleton
export const directoryScannerService = new DirectoryScannerService();