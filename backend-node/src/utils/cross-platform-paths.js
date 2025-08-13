import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Détecte l'environnement d'exécution (usage interne)
 */
function detectEnvironment() {
    // Meilleure détection WSL : vérifier si on est vraiment DANS WSL
    const isRealWSL = process.platform === 'linux' && 
                     !!(process.env.WSL_DISTRO_NAME || process.env.WSLENV);
    
    // Alternative : vérifier le hostname ou /proc/version (Linux seulement)
    let isWSLFromSystem = false;
    if (process.platform === 'linux') {
        try {
            const version = fs.readFileSync('/proc/version', 'utf8');
            isWSLFromSystem = version.toLowerCase().includes('microsoft') || 
                             version.toLowerCase().includes('wsl');
        } catch (e) {
            // Pas grave si ça échoue
        }
    }
    
    const env = {
        platform: process.platform,
        isWSL: isRealWSL || isWSLFromSystem,
        isWindows: process.platform === 'win32',
        isLinux: process.platform === 'linux',
        nodeVersion: process.version,
        // Debug info
        WSL_DISTRO_NAME: process.env.WSL_DISTRO_NAME,
        WSLENV: process.env.WSLENV,
        realPlatform: process.platform
    };
    
    console.log(`[ENV] Détection environnement:`, env);
    return env;
}

/**
 * Convertit un chemin Windows vers WSL
 * C:\Users → /mnt/c/Users
 */
function windowsToWSL(windowsPath) {
    const match = windowsPath.match(/^([a-zA-Z]):(\\|\/)(.*)/);
    if (!match) return windowsPath;
    
    const [, driveLetter, , restPath] = match;
    const wslPath = `/mnt/${driveLetter.toLowerCase()}/${restPath.replace(/\\/g, '/')}`;
    return wslPath.replace(/\/+/g, '/'); // Nettoyer les doubles slashes
}

/**
 * Convertit un chemin WSL vers Windows  
 * /mnt/c/Users → C:\Users
 */
function wslToWindows(wslPath) {
    const match = wslPath.match(/^\/mnt\/([a-z])\/(.*)$/);
    if (!match) return wslPath;
    
    const [, driveLetter, restPath] = match;
    const windowsPath = `${driveLetter.toUpperCase()}:\\${restPath.replace(/\//g, '\\')}`;
    return windowsPath;
}


/**
 * Normalise un chemin pour l'environnement courant
 */
export function normalizePath(inputPath) {
    if (!inputPath) return "";
    
    // Nettoyer les guillemets
    let cleanPath = inputPath.trim();
    if ((cleanPath.startsWith('"') && cleanPath.endsWith('"')) ||
        (cleanPath.startsWith("'") && cleanPath.endsWith("'"))) {
        cleanPath = cleanPath.slice(1, -1);
    }
    
    const env = detectEnvironment();
    
    // Dans WSL (Linux avec variables WSL), convertir les chemins Windows vers WSL
    if (env.isWSL && /^[a-zA-Z]:/.test(cleanPath)) {
        const converted = windowsToWSL(cleanPath);
        console.log(`[PATH] WSL: Conversion Windows→WSL: "${cleanPath}" → "${converted}"`);
        return converted;
    }
    
    // Dans Windows natif, convertir les chemins WSL vers Windows
    if (env.isWindows && !env.isWSL && cleanPath.startsWith('/mnt/')) {
        const converted = wslToWindows(cleanPath);
        console.log(`[PATH] Windows: Conversion WSL→Windows: "${cleanPath}" → "${converted}"`);
        return converted;
    }
    
    // Dans Windows natif, pas de conversion des chemins Windows
    if (env.isWindows && !env.isWSL && /^[a-zA-Z]:/.test(cleanPath)) {
        console.log(`[PATH] Windows natif: Pas de conversion nécessaire: "${cleanPath}"`);
        return cleanPath;
    }
    
    // Normalisation standard
    try {
        const normalized = path.normalize(cleanPath);
        console.log(`[PATH] Normalisation standard: "${cleanPath}" → "${normalized}"`);
        return normalized;
    } catch (error) {
        console.log(`[PATH] Erreur normalisation: ${error.message}`);
        return cleanPath;
    }
}


/**
 * Version synchrone pour compatibilité
 */
export function isValidDirectoryCrossPlatformSync(directory) {
    try {
        const env = detectEnvironment();
        const candidates = [directory];
        
        // Si on est dans WSL et qu'on reçoit un chemin Windows
        if (env.isWSL && /^[a-zA-Z]:/.test(directory)) {
            candidates.push(windowsToWSL(directory));
        }
        
        // Si on est dans Windows natif (pas WSL) et qu'on reçoit un chemin WSL
        if (env.isWindows && !env.isWSL && directory.startsWith('/mnt/')) {
            candidates.push(wslToWindows(directory));
        }
        
        // Retirer les doublons
        const uniqueCandidates = [...new Set(candidates)];
        
        for (const candidate of uniqueCandidates) {
            try {
                const stats = fs.statSync(candidate);
                if (stats.isDirectory()) {
                    return true;
                }
            } catch (error) {
                continue;
            }
        }
        
        return false;
    } catch (error) {
        return false;
    }
}

