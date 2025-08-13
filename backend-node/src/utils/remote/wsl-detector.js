import { promisify } from 'util';
import { exec } from 'child_process';
import { getLogger } from '../logger.js';

const execAsync = promisify(exec);
const logger = getLogger('toolbox.wsl-detector');

/**
 * Utilitaire de détection et vérification WSL
 */
export class WSLDetector {
    
    /**
     * Détecte l'environnement d'exécution
     * @returns {Promise<Object>} Informations sur l'environnement
     */
    async detectEnvironment() {
        const env = {
            platform: process.platform,
            hasWSL: false,
            wslVersion: null,
            defaultDistro: null,
            availableDistros: []
        };
        
        try {
            logger.debug('Test détection WSL...');
            const { stdout } = await execAsync('wsl.exe --list --quiet', { timeout: 5000 });
            const distros = stdout.trim().split('\n').filter(d => d.length > 0);
            logger.debug(`WSL distros trouvées: ${JSON.stringify(distros)}`);
            
            if (distros.length > 0) {
                env.hasWSL = true;
                env.defaultDistro = distros[0];
                env.availableDistros = distros;
                
                // Obtenir la version WSL
                try {
                    const { stdout: versionOutput } = await execAsync('wsl.exe --version');
                    const versionMatch = versionOutput.match(/WSL version: ([\d.]+)/);
                    if (versionMatch) {
                        env.wslVersion = versionMatch[1];
                    }
                } catch (e) {
                    env.wslVersion = '1.x'; // WSL1 n'a pas --version
                }
            }
            
        } catch (error) {
            logger.debug('WSL non détecté ou non disponible');
        }
        
        logger.info('Environnement WSL détecté:', {
            hasWSL: env.hasWSL,
            version: env.wslVersion,
            distros: env.availableDistros.length
        });
        
        return env;
    }
    
    /**
     * Vérifie si un package est installé dans WSL
     * @param {string} packageName - Nom du package
     * @returns {Promise<boolean>} True si installé
     */
    async isPackageInstalled(packageName) {
        try {
            const { stdout } = await execAsync(`wsl.exe which ${packageName}`);
            return stdout.trim().length > 0;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Installe un package dans WSL (Ubuntu/Debian)
     * @param {string} packageName - Nom du package
     * @returns {Promise<boolean>} True si succès
     */
    async installPackage(packageName) {
        try {
            logger.info(`Installation automatique de ${packageName} dans WSL...`);
            
            // Essayer d'abord sans sudo (au cas où)
            try {
                await execAsync(`wsl.exe bash -c "apt update && apt install ${packageName} -y"`, {
                    timeout: 120000
                });
                return true;
            } catch (nonSudoError) {
                // Si échec, essayer avec sudo
                logger.info('Tentative avec sudo...');
                await execAsync(`wsl.exe bash -c "sudo apt update && sudo apt install ${packageName} -y"`, {
                    timeout: 120000
                });
                return true;
            }
        } catch (error) {
            logger.error(`Échec installation ${packageName}: ${error.message}`);
            
            // Instructions manuelles
            logger.info(`Installation manuelle requise:`);
            logger.info(`  wsl sudo apt update`);
            logger.info(`  wsl sudo apt install ${packageName} -y`);
            
            return false;
        }
    }
    
    /**
     * Vérifie et installe automatiquement sshpass si nécessaire
     * @returns {Promise<boolean>} True si sshpass disponible
     */
    async ensureSSHPassAvailable() {
        const isInstalled = await this.isPackageInstalled('sshpass');
        
        if (isInstalled) {
            logger.debug('sshpass déjà installé');
            return true;
        }
        
        logger.info('sshpass non trouvé, installation automatique...');
        return await this.installPackage('sshpass');
    }
    
    /**
     * Exécute une commande dans WSL
     * @param {string} command - Commande à exécuter
     * @param {Object} options - Options d'exécution
     * @returns {Promise<Object>} Résultat de la commande
     */
    async executeInWSL(command, options = {}) {
        const { timeout = 30000, env = {} } = options;
        
        const fullCommand = `wsl.exe ${command}`;
        logger.debug(`Exécution WSL: ${fullCommand}`);
        
        try {
            const result = await execAsync(fullCommand, {
                timeout,
                env: { ...process.env, ...env }
            });
            
            return {
                success: true,
                stdout: result.stdout,
                stderr: result.stderr
            };
        } catch (error) {
            return {
                success: false,
                stdout: error.stdout || '',
                stderr: error.stderr || '',
                error: error.message
            };
        }
    }
}

// Export d'une instance singleton
export const wslDetector = new WSLDetector();