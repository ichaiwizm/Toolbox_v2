import { wslDetector } from './wsl-detector.js';
import { getLogger } from '../logger.js';

const logger = getLogger('toolbox.ssh-commander');

/**
 * Utilitaire pour les commandes SSH via WSL
 */
export class SSHCommander {
    
    constructor() {
        this.defaultSSHOptions = [
            '-o', 'ConnectTimeout=10',
            '-o', 'ServerAliveInterval=30',
            '-o', 'StrictHostKeyChecking=no',
            '-o', 'UserKnownHostsFile=/dev/null'
        ];
    }
    
    /**
     * Teste une connexion SSH
     * @param {Object} sshConnection - Configuration SSH
     * @returns {Promise<boolean>} True si connexion réussie
     */
    async testConnection(sshConnection) {
        logger.debug(`Test connexion SSH vers ${sshConnection.username}@${sshConnection.host}`);
        
        try {
            const command = await this._buildSSHCommand(sshConnection, 'echo "test"');
            const result = await wslDetector.executeInWSL(command, { timeout: 15000 });
            
            if (result.success && result.stdout.includes('test')) {
                logger.debug('Test SSH réussi');
                return true;
            } else {
                logger.warning('Test SSH échoué:', result.stderr);
                return false;
            }
        } catch (error) {
            logger.error(`Erreur test SSH: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Vérifie l'existence d'un chemin distant
     * @param {Object} sshConnection - Configuration SSH
     * @param {string} remotePath - Chemin à vérifier
     * @returns {Promise<boolean>} True si chemin existe
     */
    async checkRemotePath(sshConnection, remotePath) {
        logger.debug(`Vérification chemin distant: ${remotePath}`);
        
        try {
            const command = await this._buildSSHCommand(sshConnection, `test -e '${remotePath}'`);
            const result = await wslDetector.executeInWSL(command, { timeout: 10000 });
            
            return result.success;
        } catch (error) {
            logger.error(`Erreur vérification chemin: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Exécute une commande sur le serveur distant
     * @param {Object} sshConnection - Configuration SSH
     * @param {string} remoteCommand - Commande à exécuter
     * @param {Object} options - Options d'exécution
     * @returns {Promise<Object>} Résultat de la commande
     */
    async executeRemoteCommand(sshConnection, remoteCommand, options = {}) {
        const { timeout = 30000 } = options;
        
        try {
            const command = await this._buildSSHCommand(sshConnection, remoteCommand);
            return await wslDetector.executeInWSL(command, { timeout });
        } catch (error) {
            logger.error(`Erreur commande distante: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Construit une commande SSH appropriée
     * @private
     */
    async _buildSSHCommand(sshConnection, remoteCommand) {
        const { host, port = 22, username, password } = sshConnection;
        
        if (password) {
            // Avec mot de passe, utiliser sshpass
            const sshpassAvailable = await wslDetector.ensureSSHPassAvailable();
            if (!sshpassAvailable) {
                throw new Error('sshpass requis pour les connexions par mot de passe. Installation automatique échouée.');
            }
            
            const sshOptions = [...this.defaultSSHOptions];
            return `bash -c "sshpass -p '${password}' ssh ${sshOptions.join(' ')} -p ${port} ${username}@${host} '${remoteCommand}'"`;
        } else {
            // Sans mot de passe, utiliser clés SSH
            const sshOptions = [...this.defaultSSHOptions, '-o', 'BatchMode=yes'];
            return `ssh ${sshOptions.join(' ')} -p ${port} ${username}@${host} '${remoteCommand}'`;
        }
    }
    
    /**
     * Génère les options SSH pour rsync
     * @param {Object} sshConnection - Configuration SSH
     * @returns {Promise<string>} Options SSH formatées pour rsync
     */
    async buildRsyncSSHOptions(sshConnection) {
        const { port = 22, password } = sshConnection;
        
        const sshOptions = [...this.defaultSSHOptions, '-p', port.toString()];
        
        if (password) {
            // Avec mot de passe, utiliser sshpass
            const sshpassAvailable = await wslDetector.ensureSSHPassAvailable();
            if (!sshpassAvailable) {
                throw new Error('sshpass requis pour les connexions par mot de passe. Installation automatique échouée.');
            }
            
            return `"sshpass -p '${password}' ssh ${sshOptions.join(' ')}"`;
        } else {
            // Sans mot de passe, utiliser clés SSH
            sshOptions.push('-o', 'BatchMode=yes');
            return `"ssh ${sshOptions.join(' ')}"`;
        }
    }
}

// Export d'une instance singleton
export const sshCommander = new SSHCommander();