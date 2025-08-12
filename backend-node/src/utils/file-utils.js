import fs from 'fs';
import path from 'path';
import { sanitizePath } from './path-utils.js';
import { normalizePath } from './cross-platform-paths.js';

// Configuration
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Scanne un dossier et retourne les fichiers correspondant aux critères
 * @param {string} directory - Chemin du dossier à scanner
 * @param {Array<string>} excludeExtensions - Extensions à exclure (sans le point)
 * @param {Array<string>} includeExtensions - Extensions à inclure (sans le point, priorité sur exclude)
 * @param {Array<string>} excludePatterns - Motifs regex à exclure
 * @param {Array<string>} includePatterns - Motifs regex à inclure (priorité sur exclude)
 * @param {Array<string>} excludeDirectories - Sous-dossiers à exclure
 * @param {boolean} recursive - Chercher dans les sous-dossiers
 * @returns {Object} Dictionnaire contenant les fichiers et erreurs
 */
export function scanDirectory(directory, {
    excludeExtensions = [],
    includeExtensions = [],
    excludePatterns = [],
    includePatterns = [],
    excludeDirectories = [],
    recursive = true
} = {}) {
    console.log(`Début du scan du dossier ${directory} (récursif=${recursive})`);
    
    // Normaliser le chemin pour l'environnement courant
    const normalizedDirectory = normalizePath(directory);
    console.log(`[SCAN] Chemin normalisé: "${directory}" → "${normalizedDirectory}"`);
    
    const results = [];
    const errors = [];
    
    // Vérifier que le dossier existe
    try {
        const stats = fs.statSync(normalizedDirectory);
        if (!stats.isDirectory()) {
            const errorMsg = `Le dossier ${normalizedDirectory} n'est pas un répertoire`;
            console.error(errorMsg);
            return { files: results, errors: [errorMsg] };
        }
    } catch (error) {
        const errorMsg = `Le dossier ${normalizedDirectory} n'existe pas ou n'est pas accessible: ${error.message}`;
        console.error(errorMsg);
        return { files: results, errors: [errorMsg] };
    }
    
    /**
     * Fonction récursive pour parcourir les dossiers
     * @param {string} currentDir - Dossier courant
     * @param {number} depth - Profondeur courante (pour éviter la récursion infinie)
     */
    function walkDirectory(currentDir, depth = 0) {
        if (depth > 20) { // Protection contre la récursion infinie
            console.warn(`Profondeur maximale atteinte pour ${currentDir}`);
            return;
        }
        
        try {
            const items = fs.readdirSync(currentDir);
            
            for (const item of items) {
                const itemPath = path.join(currentDir, item);
                
                try {
                    const stats = fs.statSync(itemPath);
                    
                    if (stats.isFile()) {
                        // Traitement des fichiers
                        const extension = path.extname(item).slice(1); // Sans le point
                        
                        // Vérifier l'extension
                        if (includeExtensions.length > 0) {
                            // Si includeExtensions est spécifié, seules ces extensions sont acceptées
                            if (!includeExtensions.includes(extension)) {
                                console.log(`Fichier exclu par include_extensions: ${itemPath}`);
                                continue;
                            }
                        } else if (excludeExtensions.includes(extension)) {
                            // Sinon, utiliser excludeExtensions
                            console.log(`Fichier exclu par extension: ${itemPath}`);
                            continue;
                        }
                        
                        // Vérifier les motifs
                        if (includePatterns.length > 0) {
                            // Si includePatterns est spécifié, seuls ces motifs sont acceptés
                            let includeMatch = false;
                            for (const pattern of includePatterns) {
                                try {
                                    const regex = new RegExp(pattern);
                                    if (regex.test(item)) {
                                        includeMatch = true;
                                        break;
                                    }
                                } catch (regexError) {
                                    console.warn(`Motif regex invalide (include): ${pattern}`);
                                }
                            }
                            if (!includeMatch) {
                                console.log(`Fichier exclu par include_patterns: ${itemPath}`);
                                continue;
                            }
                        } else {
                            // Sinon, utiliser excludePatterns
                            let excludeMatch = false;
                            for (const pattern of excludePatterns) {
                                try {
                                    const regex = new RegExp(pattern);
                                    if (regex.test(item)) {
                                        excludeMatch = true;
                                        break;
                                    }
                                } catch (regexError) {
                                    console.warn(`Motif regex invalide (exclude): ${pattern}`);
                                }
                            }
                            
                            if (excludeMatch) {
                                console.log(`Fichier exclu par motif: ${itemPath}`);
                                continue;
                            }
                        }
                        
                        // Vérifier la taille
                        if (stats.size > MAX_FILE_SIZE) {
                            console.log(`Fichier trop volumineux ignoré: ${itemPath} (${stats.size} octets)`);
                            continue;
                        }
                        
                        // Ajouter le fichier aux résultats
                        results.push({
                            path: itemPath.replace(/\\/g, '/'),
                            name: item,
                            size: stats.size,
                            extension: extension
                        });
                        
                    } else if (stats.isDirectory() && recursive) {
                        // Traitement des dossiers (si récursif)
                        const dirName = path.basename(itemPath);
                        
                        // Vérifier si le dossier est exclu
                        if (excludeDirectories.includes(dirName)) {
                            console.log(`Dossier exclu: ${itemPath}`);
                            continue;
                        }
                        
                        // Parcourir récursivement
                        walkDirectory(itemPath, depth + 1);
                    }
                    
                } catch (itemError) {
                    const errorMsg = `Erreur d'accès à '${itemPath}': ${itemError.message}`;
                    console.warn(errorMsg);
                    errors.push(errorMsg);
                }
            }
            
        } catch (readError) {
            const errorMsg = `Erreur lors de la lecture de '${currentDir}': ${readError.message}`;
            console.error(errorMsg);
            errors.push(errorMsg);
        }
    }
    
    // Commencer le parcours avec le chemin normalisé
    walkDirectory(normalizedDirectory);
    
    console.log(`Scan terminé: ${results.length} fichiers trouvés, ${errors.length} erreurs`);
    return { files: results, errors };
}

/**
 * Lit le contenu d'un fichier de manière sécurisée
 * @param {string} filePath - Chemin du fichier à lire
 * @returns {string} Contenu du fichier ou message d'erreur
 */
export function readFileContent(filePath) {
    console.log(`Lecture du fichier: ${filePath}`);
    
    try {
        // Vérifier que le fichier existe
        const stats = fs.statSync(filePath);
        
        if (!stats.isFile()) {
            const errorMsg = `Le chemin ${filePath} n'est pas un fichier`;
            console.warn(errorMsg);
            return `[Erreur - ${errorMsg}]`;
        }
        
        // Vérifier la taille
        if (stats.size > MAX_FILE_SIZE) {
            const errorMsg = `Le fichier ${filePath} est trop volumineux (${stats.size} octets)`;
            console.warn(errorMsg);
            return `[Erreur - ${errorMsg}]`;
        }
        
        // Essayer de lire en UTF-8
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            console.log(`Fichier lu avec succès: ${filePath}`);
            return content;
        } catch (encodingError) {
            // En cas d'erreur d'encodage, essayer en latin1
            try {
                const content = fs.readFileSync(filePath, 'latin1');
                console.log(`Fichier lu avec encodage latin1: ${filePath}`);
                return content;
            } catch (latin1Error) {
                // Si ça ne fonctionne toujours pas, considérer comme binaire
                const errorMsg = `Contenu binaire - Taille: ${stats.size} octets`;
                console.warn(`Fichier binaire détecté: ${filePath}`);
                return `[${errorMsg}]`;
            }
        }
        
    } catch (error) {
        const errorMsg = `Erreur lors de la lecture de ${filePath}: ${error.message}`;
        console.error(errorMsg);
        return `[Erreur - ${errorMsg}]`;
    }
}

/**
 * Formate le contenu d'un fichier pour la copie
 * @param {string} filePath - Chemin du fichier
 * @param {string} content - Contenu du fichier
 * @param {string} sizeHuman - Taille formatée (optionnel)
 * @returns {string} Contenu formaté
 */
export function formatFileForCopy(filePath, content, sizeHuman = "") {
    if (sizeHuman) {
        return `=== ${filePath} (${sizeHuman}) ===\n\n${content}\n\n---\n\n`;
    } else {
        return `=== ${filePath} ===\n\n${content}\n\n---\n\n`;
    }
}

