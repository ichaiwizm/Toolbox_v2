import { getLogger } from '../logger.js';

const logger = getLogger('toolbox.path-converter');

/**
 * Utilitaire de conversion des chemins Windows ↔ WSL
 */
export class PathConverter {
    
    /**
     * Convertit un chemin Windows vers WSL
     * C:\Users\... -> /mnt/c/Users/...
     * @param {string} windowsPath - Chemin Windows
     * @returns {string} Chemin WSL
     */
    windowsToWSL(windowsPath) {
        if (!windowsPath) return '';
        
        // Si déjà un chemin Unix, le retourner tel quel
        if (windowsPath.startsWith('/')) {
            return windowsPath;
        }
        
        // Convertir C:\path\to\dir vers /mnt/c/path/to/dir
        const match = windowsPath.match(/^([A-Za-z]):([\\/].*)/);
        if (match) {
            const [, driveLetter, restPath] = match;
            const unixPath = `/mnt/${driveLetter.toLowerCase()}${restPath.replace(/\\/g, '/')}`;
            logger.debug(`Conversion chemin: "${windowsPath}" -> "${unixPath}"`);
            return unixPath;
        }
        
        // Si pas de match, essayer de nettoyer les backslashes
        const unixPath = windowsPath.replace(/\\/g, '/');
        logger.debug(`Nettoyage chemin: "${windowsPath}" -> "${unixPath}"`);
        return unixPath;
    }
    
    /**
     * Convertit un chemin WSL vers Windows
     * /mnt/c/Users/... -> C:\Users\...
     * @param {string} wslPath - Chemin WSL
     * @returns {string} Chemin Windows
     */
    wslToWindows(wslPath) {
        if (!wslPath) return '';
        
        // Si déjà un chemin Windows, le retourner tel quel
        if (/^[A-Za-z]:/.test(wslPath)) {
            return wslPath;
        }
        
        // Convertir /mnt/c/path/to/dir vers C:\path\to\dir
        const match = wslPath.match(/^\/mnt\/([a-z])\/(.*)$/);
        if (match) {
            const [, driveLetter, restPath] = match;
            const windowsPath = `${driveLetter.toUpperCase()}:\\${restPath.replace(/\//g, '\\')}`;
            logger.debug(`Conversion chemin: "${wslPath}" -> "${windowsPath}"`);
            return windowsPath;
        }
        
        // Si pas de match /mnt/, retourner tel quel
        return wslPath;
    }
    
    /**
     * Normalise un chemin pour l'environnement cible
     * @param {string} inputPath - Chemin d'entrée
     * @param {string} targetEnv - 'windows' ou 'wsl'
     * @returns {string} Chemin normalisé
     */
    normalize(inputPath, targetEnv = 'wsl') {
        if (!inputPath) return '';
        
        // Nettoyer les guillemets
        let cleanPath = inputPath.trim();
        if ((cleanPath.startsWith('"') && cleanPath.endsWith('"')) ||
            (cleanPath.startsWith("'") && cleanPath.endsWith("'"))) {
            cleanPath = cleanPath.slice(1, -1);
        }
        
        if (targetEnv === 'wsl') {
            return this.windowsToWSL(cleanPath);
        } else {
            return this.wslToWindows(cleanPath);
        }
    }
    
    /**
     * Vérifie si un chemin est un chemin Windows
     * @param {string} path - Chemin à vérifier
     * @returns {boolean} True si chemin Windows
     */
    isWindowsPath(path) {
        return /^[A-Za-z]:/.test(path);
    }
    
    /**
     * Vérifie si un chemin est un chemin WSL
     * @param {string} path - Chemin à vérifier
     * @returns {boolean} True si chemin WSL
     */
    isWSLPath(path) {
        return path.startsWith('/mnt/');
    }
    
    /**
     * Échappe un chemin pour utilisation dans une commande shell
     * @param {string} path - Chemin à échapper
     * @returns {string} Chemin échappé
     */
    escapePath(path) {
        // Échapper les espaces et caractères spéciaux
        return path.replace(/ /g, '\\ ').replace(/'/g, "\\'");
    }
}

// Export d'une instance singleton
export const pathConverter = new PathConverter();