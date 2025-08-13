import { getLogger } from '../utils/logger.js';

const logger = getLogger('toolbox.content-formatter');

/**
 * Service de formatage de contenu
 * Gère la mise en forme des fichiers pour la copie/export
 */
export class ContentFormatterService {
    
    /**
     * Formate le contenu d'un fichier pour la copie
     * @param {string} filePath - Chemin du fichier
     * @param {string} content - Contenu du fichier
     * @param {string} sizeHuman - Taille formatée (optionnel)
     * @returns {string} Contenu formaté
     */
    formatFileForCopy(filePath, content, sizeHuman = "") {
        const separator = this._createSeparator(filePath, sizeHuman);
        return `${separator}\n\n${content}\n\n---\n\n`;
    }
    
    /**
     * Formate plusieurs fichiers en un seul contenu
     * @param {Array} files - Liste des fichiers avec contenu
     * @returns {string} Contenu formaté agrégé
     */
    formatMultipleFiles(files) {
        let formattedContent = "";
        
        for (const file of files) {
            if (file.content && file.path) {
                formattedContent += this.formatFileForCopy(
                    file.path, 
                    file.content, 
                    file.sizeHuman
                );
            }
        }
        
        return formattedContent;
    }
    
    /**
     * Formate un fichier avec gestion des erreurs
     * @param {Object} fileInfo - Informations du fichier
     * @param {string} content - Contenu ou message d'erreur
     * @returns {Object} Résultat formaté avec métadonnées
     */
    formatFileWithErrorHandling(fileInfo, content) {
        const result = {
            path: fileInfo.path,
            formattedContent: '',
            hasError: false,
            errorType: null,
            errorMessage: null
        };
        
        // Détecter les différents types d'erreurs
        if (content.startsWith("[Erreur")) {
            result.hasError = true;
            result.errorType = 'read_error';
            result.errorMessage = content;
        } else if (content.startsWith("[Fichier non")) {
            result.hasError = true;
            result.errorType = 'file_not_found';
            result.errorMessage = content;
        } else if (content.startsWith("[Contenu binaire")) {
            result.hasError = false; // Pas une erreur, juste binaire
            result.errorType = 'binary_content';
            result.errorMessage = content;
        }
        
        // Formater le contenu
        const separator = this._createSeparator(fileInfo.path, fileInfo.sizeHuman);
        result.formattedContent = `${separator}\n${content}\n\n---\n\n`;
        
        return result;
    }
    
    /**
     * Crée un résumé des fichiers formatés
     * @param {Array} files - Liste des fichiers traités
     * @returns {Object} Statistiques de formatage
     */
    createFormattingSummary(files) {
        const summary = {
            totalFiles: files.length,
            successfulFiles: 0,
            errorFiles: 0,
            binaryFiles: 0,
            totalSize: 0,
            totalLines: 0,
            errorsByType: {},
            largestFile: null,
            smallestFile: null
        };
        
        for (const file of files) {
            summary.totalSize += file.size || 0;
            
            if (file.hasError) {
                summary.errorFiles++;
                const errorType = file.errorType || 'unknown';
                summary.errorsByType[errorType] = (summary.errorsByType[errorType] || 0) + 1;
            } else if (file.errorType === 'binary_content') {
                summary.binaryFiles++;
            } else {
                summary.successfulFiles++;
                
                // Compter les lignes si possible
                if (file.content && typeof file.content === 'string') {
                    summary.totalLines += (file.content.match(/\n/g) || []).length + 1;
                }
            }
            
            // Suivre les tailles min/max
            if (file.size) {
                if (!summary.largestFile || file.size > summary.largestFile.size) {
                    summary.largestFile = { path: file.path, size: file.size };
                }
                if (!summary.smallestFile || file.size < summary.smallestFile.size) {
                    summary.smallestFile = { path: file.path, size: file.size };
                }
            }
        }
        
        return summary;
    }
    
    /**
     * Formate un contenu avec numérotation des lignes
     * @param {string} content - Contenu à formater
     * @param {number} startLine - Ligne de début (défaut: 1)
     * @returns {string} Contenu avec numéros de ligne
     */
    addLineNumbers(content, startLine = 1) {
        const lines = content.split('\n');
        const maxLineLength = String(startLine + lines.length - 1).length;
        
        return lines.map((line, index) => {
            const lineNumber = startLine + index;
            const paddedNumber = String(lineNumber).padStart(maxLineLength, ' ');
            return `${paddedNumber}: ${line}`;
        }).join('\n');
    }
    
    /**
     * Crée un index/table des matières des fichiers
     * @param {Array} files - Liste des fichiers
     * @returns {string} Index formaté
     */
    createFileIndex(files) {
        let index = "=== TABLE DES MATIÈRES ===\n\n";
        
        files.forEach((file, idx) => {
            const status = file.hasError ? '[ERREUR]' : 
                          file.errorType === 'binary_content' ? '[BINAIRE]' : '[OK]';
            const size = file.sizeHuman || 'Taille inconnue';
            
            index += `${idx + 1}. ${status} ${file.path} (${size})\n`;
        });
        
        index += "\n" + "=".repeat(50) + "\n\n";
        return index;
    }
    
    /**
     * Extrait un extrait/preview du contenu
     * @param {string} content - Contenu complet
     * @param {number} maxLines - Nombre max de lignes (défaut: 10)
     * @returns {string} Extrait du contenu
     */
    createContentPreview(content, maxLines = 10) {
        const lines = content.split('\n');
        
        if (lines.length <= maxLines) {
            return content;
        }
        
        const preview = lines.slice(0, maxLines).join('\n');
        const remaining = lines.length - maxLines;
        
        return `${preview}\n\n... [${remaining} lignes supplémentaires] ...`;
    }
    
    /**
     * Crée le séparateur de fichier
     * @private
     */
    _createSeparator(filePath, sizeHuman) {
        if (sizeHuman && sizeHuman.trim()) {
            return `=== ${filePath} (${sizeHuman}) ===`;
        } else {
            return `=== ${filePath} ===`;
        }
    }
    
    /**
     * Nettoie le contenu pour éviter les caractères problématiques
     * @param {string} content - Contenu à nettoyer
     * @returns {string} Contenu nettoyé
     */
    sanitizeContent(content) {
        return content
            .replace(/\r\n/g, '\n')  // Normaliser les fins de ligne
            .replace(/\r/g, '\n')    // Mac classic
            .replace(/\0/g, '[NUL]') // Remplacer les caractères null
            .replace(/\x1b\[[0-9;]*m/g, ''); // Supprimer les codes couleur ANSI
    }
}

// Export d'une instance singleton
export const contentFormatterService = new ContentFormatterService();