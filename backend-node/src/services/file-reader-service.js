import fs from 'fs';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('toolbox.file-reader');

/**
 * Service de lecture des fichiers
 * Gère la lecture sécurisée des fichiers avec détection d'encodage
 */
export class FileReaderService {
    constructor() {
        this.maxFileSize = 5 * 1024 * 1024; // 5MB par défaut
    }
    
    /**
     * Configure la taille maximale des fichiers
     * @param {number} maxSize - Taille max en octets
     */
    setMaxFileSize(maxSize) {
        this.maxFileSize = maxSize;
    }
    
    /**
     * Lit le contenu d'un fichier de manière sécurisée
     * @param {string} filePath - Chemin du fichier à lire
     * @returns {string} Contenu du fichier ou message d'erreur
     */
    readFileContent(filePath) {
        logger.debug(`Lecture du fichier: ${filePath}`);
        
        try {
            // Vérifier que le fichier existe
            const stats = fs.statSync(filePath);
            
            if (!stats.isFile()) {
                const errorMsg = `Le chemin ${filePath} n'est pas un fichier`;
                logger.warning(errorMsg);
                return `[Erreur - ${errorMsg}]`;
            }
            
            // Vérifier la taille
            if (stats.size > this.maxFileSize) {
                const errorMsg = `Le fichier ${filePath} est trop volumineux (${stats.size} octets)`;
                logger.warning(errorMsg);
                return `[Erreur - ${errorMsg}]`;
            }
            
            // Tenter la lecture avec détection d'encodage
            const content = this._readWithEncodingDetection(filePath, stats.size);
            
            if (content.success) {
                logger.debug(`Fichier lu avec succès (${content.encoding}): ${filePath}`);
                return content.data;
            } else {
                return content.error;
            }
            
        } catch (error) {
            const errorMsg = `Erreur lors de la lecture de ${filePath}: ${error.message}`;
            logger.error(errorMsg);
            return `[Erreur - ${errorMsg}]`;
        }
    }
    
    /**
     * Lit un fichier avec plusieurs tentatives d'encodage
     * @private
     */
    _readWithEncodingDetection(filePath, fileSize) {
        // Essayer UTF-8 en premier
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Vérifier s'il y a des caractères de remplacement (indication d'encoding incorrect)
            if (!content.includes('\ufffd')) {
                return { success: true, data: content, encoding: 'utf-8' };
            }
        } catch (encodingError) {
            logger.debug(`Échec lecture UTF-8: ${encodingError.message}`);
        }
        
        // Essayer latin1 en cas d'échec UTF-8
        try {
            const content = fs.readFileSync(filePath, 'latin1');
            return { success: true, data: content, encoding: 'latin1' };
        } catch (latin1Error) {
            logger.debug(`Échec lecture latin1: ${latin1Error.message}`);
        }
        
        // Si aucun encodage ne fonctionne, considérer comme binaire
        const errorMsg = `Contenu binaire - Taille: ${fileSize} octets`;
        logger.debug(`Fichier binaire détecté: ${filePath}`);
        return { 
            success: false, 
            error: `[${errorMsg}]`,
            encoding: 'binary'
        };
    }
    
    /**
     * Vérifie si un fichier est potentiellement binaire
     * @param {string} filePath - Chemin du fichier
     * @returns {boolean} True si le fichier semble binaire
     */
    isBinaryFile(filePath) {
        try {
            // Lire les premiers 512 octets pour détecter les caractères binaires
            const buffer = Buffer.alloc(512);
            const fd = fs.openSync(filePath, 'r');
            const bytesRead = fs.readSync(fd, buffer, 0, 512, 0);
            fs.closeSync(fd);
            
            // Vérifier la présence de caractères nuls (indicateur de fichier binaire)
            for (let i = 0; i < bytesRead; i++) {
                if (buffer[i] === 0) {
                    return true;
                }
            }
            
            // Vérifier le ratio de caractères de contrôle
            let controlChars = 0;
            for (let i = 0; i < bytesRead; i++) {
                const byte = buffer[i];
                if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
                    controlChars++;
                }
            }
            
            // Si plus de 30% de caractères de contrôle, probablement binaire
            return (controlChars / bytesRead) > 0.3;
            
        } catch (error) {
            logger.warning(`Erreur détection binaire pour ${filePath}: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Obtient des informations sur un fichier
     * @param {string} filePath - Chemin du fichier
     * @returns {Object} Informations sur le fichier
     */
    getFileInfo(filePath) {
        try {
            const stats = fs.statSync(filePath);
            
            return {
                path: filePath,
                size: stats.size,
                sizeFormatted: this._formatFileSize(stats.size),
                lastModified: stats.mtime,
                isFile: stats.isFile(),
                isDirectory: stats.isDirectory(),
                isBinary: this.isBinaryFile(filePath),
                readable: this._isReadable(filePath),
                tooBig: stats.size > this.maxFileSize
            };
            
        } catch (error) {
            return {
                path: filePath,
                error: error.message,
                exists: false
            };
        }
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
        } else if (size < 1024 * 1024 * 1024) {
            return `${(size / (1024 * 1024)).toFixed(1)} Mo`;
        } else {
            return `${(size / (1024 * 1024 * 1024)).toFixed(1)} Go`;
        }
    }
    
    /**
     * Vérifie si un fichier est lisible
     * @private
     */
    _isReadable(filePath) {
        try {
            fs.accessSync(filePath, fs.constants.R_OK);
            return true;
        } catch (error) {
            return false;
        }
    }
}

// Export d'une instance singleton
export const fileReaderService = new FileReaderService();