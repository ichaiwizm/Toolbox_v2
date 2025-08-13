import { getLogger } from '../utils/logger.js';

const logger = getLogger('toolbox.file-filter');

/**
 * Service de filtrage des fichiers
 * Centralise toute la logique de filtres par extensions, patterns, etc.
 */
export class FileFilterService {
    
    /**
     * Vérifie si un fichier respecte toutes les règles de filtrage
     * @param {string} filename - Nom du fichier
     * @param {string} extension - Extension du fichier (sans le point)
     * @param {Object} rules - Règles de filtrage
     * @returns {boolean} True si le fichier passe tous les filtres
     */
    matchesAllRules(filename, extension, rules) {
        return this.matchesExtensionRules(extension, rules) && 
               this.matchesPatternRules(filename, rules);
    }
    
    /**
     * Vérifie les règles d'extensions
     * @param {string} extension - Extension du fichier
     * @param {Object} rules - Règles de filtrage
     * @returns {boolean} True si l'extension est acceptée
     */
    matchesExtensionRules(extension, rules) {
        const { include_extensions = [], exclude_extensions = [] } = rules;
        
        // Si include_extensions est spécifié, seules ces extensions sont acceptées
        if (include_extensions.length > 0) {
            const isIncluded = include_extensions.includes(extension);
            if (!isIncluded) {
                logger.debug(`Fichier exclu par include_extensions: extension "${extension}"`);
            }
            return isIncluded;
        }
        
        // Sinon, utiliser exclude_extensions
        if (exclude_extensions.includes(extension)) {
            logger.debug(`Fichier exclu par exclude_extensions: extension "${extension}"`);
            return false;
        }
        
        return true;
    }
    
    /**
     * Vérifie les règles de motifs regex
     * @param {string} filename - Nom du fichier
     * @param {Object} rules - Règles de filtrage
     * @returns {boolean} True si les motifs sont respectés
     */
    matchesPatternRules(filename, rules) {
        const { include_patterns = [], exclude_patterns = [] } = rules;
        
        // Si include_patterns est spécifié, seuls ces motifs sont acceptés
        if (include_patterns.length > 0) {
            let includeMatch = false;
            
            for (const pattern of include_patterns) {
                if (this._testRegexPattern(pattern, filename, 'include')) {
                    includeMatch = true;
                    break;
                }
            }
            
            if (!includeMatch) {
                logger.debug(`Fichier exclu par include_patterns: "${filename}"`);
            }
            return includeMatch;
        }
        
        // Sinon, utiliser exclude_patterns
        for (const pattern of exclude_patterns) {
            if (this._testRegexPattern(pattern, filename, 'exclude')) {
                logger.debug(`Fichier exclu par exclude_patterns: "${filename}" (motif: ${pattern})`);
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Vérifie si un dossier est dans la liste d'exclusion
     * @param {string} dirPath - Chemin du dossier parent
     * @param {Array<string>} excludeDirectories - Liste des dossiers à exclure
     * @returns {boolean} True si le dossier est exclu
     */
    isDirectoryExcluded(dirPath, excludeDirectories = []) {
        for (const excludedDir of excludeDirectories) {
            // Vérifier le nom exact du dossier parent
            if (dirPath.endsWith(`/${excludedDir}`) || dirPath.endsWith(`\\${excludedDir}`)) {
                return true;
            }
            
            // Vérifier si le chemin contient le dossier exclu
            if (dirPath.includes(`/${excludedDir}/`) || dirPath.includes(`\\${excludedDir}\\`)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Filtre une liste de fichiers selon les règles
     * @param {Array} files - Liste des fichiers à filtrer
     * @param {Object} rules - Règles de filtrage
     * @returns {Array} Fichiers filtrés
     */
    filterFileList(files, rules) {
        return files.filter(file => {
            const extension = file.extension || '';
            const filename = file.name || file.path;
            
            return this.matchesAllRules(filename, extension, rules);
        });
    }
    
    /**
     * Valide et nettoie les règles de filtrage
     * @param {Object} rules - Règles brutes
     * @returns {Object} Règles validées et nettoyées
     */
    validateAndCleanRules(rules = {}) {
        const cleaned = {
            include_extensions: this._cleanStringArray(rules.include_extensions),
            exclude_extensions: this._cleanStringArray(rules.exclude_extensions),
            include_patterns: this._cleanStringArray(rules.include_patterns),
            exclude_patterns: this._cleanStringArray(rules.exclude_patterns),
            exclude_directories: this._cleanStringArray(rules.exclude_directories)
        };
        
        // Valider les regex patterns
        cleaned.include_patterns = this._validateRegexPatterns(cleaned.include_patterns, 'include');
        cleaned.exclude_patterns = this._validateRegexPatterns(cleaned.exclude_patterns, 'exclude');
        
        return cleaned;
    }
    
    /**
     * Obtient un résumé des règles appliquées
     * @param {Object} rules - Règles de filtrage
     * @returns {Object} Statistiques des règles
     */
    getRulesSummary(rules) {
        const summary = {
            has_include_extensions: rules.include_extensions?.length > 0,
            has_exclude_extensions: rules.exclude_extensions?.length > 0,
            has_include_patterns: rules.include_patterns?.length > 0,
            has_exclude_patterns: rules.exclude_patterns?.length > 0,
            has_exclude_directories: rules.exclude_directories?.length > 0,
            total_rules: 0
        };
        
        summary.total_rules = Object.values(summary).filter(v => v === true).length;
        
        return summary;
    }
    
    /**
     * Teste un motif regex contre un nom de fichier
     * @private
     */
    _testRegexPattern(pattern, filename, type) {
        try {
            const regex = new RegExp(pattern);
            return regex.test(filename);
        } catch (regexError) {
            logger.warning(`Motif regex invalide (${type}): "${pattern}" - ${regexError.message}`);
            return false;
        }
    }
    
    /**
     * Nettoie un tableau de chaînes
     * @private
     */
    _cleanStringArray(arr) {
        if (!Array.isArray(arr)) {
            return [];
        }
        
        return arr
            .filter(item => typeof item === 'string' && item.trim().length > 0)
            .map(item => item.trim());
    }
    
    /**
     * Valide les motifs regex
     * @private
     */
    _validateRegexPatterns(patterns, type) {
        return patterns.filter(pattern => {
            try {
                new RegExp(pattern);
                return true;
            } catch (error) {
                logger.warning(`Pattern regex invalide retiré (${type}): "${pattern}" - ${error.message}`);
                return false;
            }
        });
    }
}

// Export d'une instance singleton
export const fileFilterService = new FileFilterService();