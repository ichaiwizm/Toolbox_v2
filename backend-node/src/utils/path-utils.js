import path from 'path';
import fs from 'fs';
import { normalizePath, isValidDirectoryCrossPlatformSync } from './cross-platform-paths.js';

/**
 * Nettoie et normalise un chemin d'accès avec support cross-platform
 * @param {string} pathStr - Chemin à nettoyer
 * @returns {string} Chemin normalisé et sécurisé
 */
export function sanitizePath(pathStr) {
    if (!pathStr) {
        return "";
    }
    
    // Utiliser le système de normalisation cross-platform
    const normalizedPath = normalizePath(pathStr);
    
    // Retirer les caractères potentiellement dangereux
    const unsafeChars = /[<>"|?*]/g;
    const sanitized = normalizedPath.replace(unsafeChars, '_');
    
    console.log(`[SANITIZE] "${pathStr}" → "${sanitized}"`);
    return sanitized;
}

/**
 * Vérifie si un répertoire existe et est accessible avec support cross-platform
 * @param {string} directory - Chemin du répertoire à vérifier
 * @returns {boolean} True si le répertoire est valide, False sinon
 */
export function isValidDirectory(directory) {
    return isValidDirectoryCrossPlatformSync(directory);
}

/**
 * Formate une erreur liée à un chemin de fichier
 * @param {string} pathStr - Chemin qui a causé l'erreur
 * @param {string} errorType - Type d'erreur
 * @returns {Object} Dictionnaire contenant les détails de l'erreur
 */
export function formatPathError(pathStr, errorType) {
    if (!pathStr) {
        return {
            original_path: "",
            clean_path: "",
            error_type: errorType,
            message: "Chemin vide ou non spécifié"
        };
    }
    
    const cleanPath = sanitizePath(pathStr);
    
    let errorMessage = "";
    if (errorType === "not_found") {
        errorMessage = `Le chemin '${cleanPath}' n'existe pas`;
    } else if (errorType === "permission") {
        errorMessage = `Accès refusé au chemin '${cleanPath}'`;
    } else {
        errorMessage = `Erreur avec le chemin '${cleanPath}': ${errorType}`;
    }
    
    return {
        original_path: pathStr,
        clean_path: cleanPath,
        error_type: errorType,
        message: errorMessage
    };
}