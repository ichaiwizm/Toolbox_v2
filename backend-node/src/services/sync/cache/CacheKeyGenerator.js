import crypto from 'crypto';
import { getLogger } from '../../../utils/logger.js';

const logger = getLogger('toolbox.cache-key-generator');

/**
 * Générateur de clés de cache pour la synchronisation distante
 */
export class CacheKeyGenerator {
    /**
     * Génère une clé de cache unique basée sur la configuration
     * @param {Object} sshConnection - Configuration SSH
     * @param {string} remotePath - Chemin distant
     * @param {Object} syncOptions - Options de synchronisation
     * @returns {string} Clé de cache
     */
    static generateCacheKey(sshConnection, remotePath, syncOptions = {}) {
        const keyData = {
            host: sshConnection.host,
            port: sshConnection.port || 22,
            username: sshConnection.username,
            remotePath: remotePath,
            recursive: syncOptions.recursive !== false,
            excludePatterns: (syncOptions.excludePatterns || []).sort(),
            excludeExtensions: (syncOptions.excludeExtensions || []).sort(),
            excludeDirectories: (syncOptions.excludeDirectories || []).sort()
        };
        
        const keyString = JSON.stringify(keyData, Object.keys(keyData).sort());
        const hash = crypto.createHash('sha256').update(keyString).digest('hex').substring(0, 16);
        
        logger.debug(`Clé cache générée: ${hash} pour ${sshConnection.host}:${remotePath}`);
        return hash;
    }
}