import { spawn } from 'child_process';
import path from 'path';
import { sshCommander } from '../../utils/remote/ssh-commander.js';
import { pathConverter } from '../../utils/remote/path-converter.js';
import { getLogger } from '../../utils/logger.js';

const logger = getLogger('toolbox.rsync-executor');

/**
 * Exécuteur rsync pour la synchronisation de fichiers
 */
export class RsyncExecutor {
    
    constructor() {
        this.defaultRsyncOptions = [
            '-a',           // Archive mode (permissions, liens, etc.)
            '-z',           // Compression
            '--partial',    // Reprendre les transferts interrompus
            '--info=progress2', // Progress info
            '--no-perms',   // Pas de propagation perms Unix
            '--no-owner',   // Pas de propagation propriétaire
            '--no-group',   // Pas de propagation groupe
            '--delete-excluded' // Supprimer les fichiers exclus
        ];
    }
    
    /**
     * Effectue un dry-run pour estimer le transfert
     * @param {Object} sshConnection - Configuration SSH
     * @param {string} remotePath - Chemin distant
     * @param {string} cachePath - Chemin cache local
     * @param {Object} syncOptions - Options de synchronisation
     * @returns {Promise<Object>} Estimation du transfert
     */
    async performDryRun(sshConnection, remotePath, cachePath, syncOptions = {}) {
        logger.debug('Début dry-run rsync');
        
        const rsyncCommand = await this._buildRsyncCommand(
            sshConnection, 
            remotePath, 
            cachePath, 
            syncOptions,
            true // dry-run
        );
        
        return new Promise((resolve, reject) => {
            let stdout = '';
            let stderr = '';
            
            const childProcess = spawn(rsyncCommand.command, rsyncCommand.args, {
                env: { ...process.env, ...rsyncCommand.env }
            });
            
            childProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            childProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            childProcess.on('close', (code) => {
                if (code === 0) {
                    const fileCount = this._parseFileCount(stdout);
                    resolve({
                        estimatedFiles: fileCount,
                        stdout: stdout,
                        stderr: stderr
                    });
                } else {
                    reject(new Error(`Dry-run échoué: ${stderr}`));
                }
            });
            
            // Timeout pour dry-run
            const timeout = setTimeout(() => {
                childProcess.kill('SIGTERM');
                reject(new Error('Timeout dry-run (30s)'));
            }, 30000);
            
            childProcess.on('close', () => {
                clearTimeout(timeout);
            });
        });
    }
    
    /**
     * Effectue la synchronisation complète
     * @param {Object} sshConnection - Configuration SSH
     * @param {string} remotePath - Chemin distant
     * @param {string} cachePath - Chemin cache local
     * @param {Object} syncOptions - Options de synchronisation
     * @param {string} syncId - ID de synchronisation pour logs
     * @returns {Promise<Object>} Résultat de la synchronisation
     */
    async performSync(sshConnection, remotePath, cachePath, syncOptions = {}, syncId) {
        logger.info(`[${syncId}] Début synchronisation rsync`);
        
        const rsyncCommand = await this._buildRsyncCommand(
            sshConnection, 
            remotePath, 
            cachePath, 
            syncOptions,
            false // pas de dry-run
        );
        
        return new Promise((resolve, reject) => {
            let stdout = '';
            let stderr = '';
            let filesTransferred = 0;
            
            const syncProcess = spawn(rsyncCommand.command, rsyncCommand.args, {
                env: { ...process.env, ...rsyncCommand.env }
            });
            
            syncProcess.stdout.on('data', (data) => {
                const output = data.toString();
                stdout += output;
                
                // Parser le progrès si possible
                this._parseProgress(output, syncId);
                
                // Compter les fichiers transférés
                filesTransferred += this._countTransferredFiles(output);
            });
            
            syncProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            syncProcess.on('close', (code) => {
                if (code === 0) {
                    logger.info(`[${syncId}] Synchronisation terminée: ${filesTransferred} fichiers`);
                    resolve({
                        filesTransferred,
                        stdout,
                        stderr,
                        exitCode: code
                    });
                } else {
                    logger.error(`[${syncId}] Rsync échoué (code ${code}): ${stderr}`);
                    reject(new Error(`Rsync échoué (code ${code}): ${stderr}`));
                }
            });
            
            // Timeout de 30 minutes pour la sync complète
            const timeout = setTimeout(() => {
                logger.warning(`[${syncId}] Timeout synchronisation`);
                syncProcess.kill('SIGTERM');
                reject(new Error('Timeout synchronisation (30 minutes)'));
            }, 30 * 60 * 1000);
            
            syncProcess.on('close', () => {
                clearTimeout(timeout);
            });
        });
    }
    
    /**
     * Construit la commande rsync complète
     * @private
     */
    async _buildRsyncCommand(sshConnection, remotePath, cachePath, syncOptions, isDryRun = false) {
        // Helper pour échapper les ' dans une chaîne bash-quotée
        const shQ = (s = '') => String(s).replace(/'/g, `'\"'\"'`);

        // Construire la commande SSH (chemins absolus + options)
        const port = sshConnection.port || 22;
        const sshBase = `/usr/bin/ssh -o ConnectTimeout=10 -o ServerAliveInterval=30 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p ${port}`;

        const rsh = (sshConnection.password && sshConnection.password.trim())
            ? `/usr/bin/sshpass -p '${shQ(sshConnection.password)}' ${sshBase}`
            : sshBase;

        // Arguments rsync adaptés selon le type (fichier vs répertoire)
        let rsyncArgs;
        if (syncOptions.isFile) {
            // Pour un fichier : pas d'option récursive, juste les options de base
            rsyncArgs = [
                '-z',           // Compression
                '--partial',    // Reprendre les transferts interrompus
                '--info=progress2', // Progress info
                '--no-perms',   // Pas de propagation perms Unix
                '--no-owner',   // Pas de propagation propriétaire
                '--no-group'    // Pas de propagation groupe
                // PAS de -a (qui inclut -r récursif) ni --delete-excluded pour les fichiers
            ];
        } else {
            // Pour un répertoire : options complètes avec récursivité
            rsyncArgs = [
                ...this.defaultRsyncOptions
            ];
        }
        
        if (isDryRun) {
            rsyncArgs.push('--dry-run');
        }

        // Exclusions
        this._addExclusionRules(rsyncArgs, syncOptions);

        // Source et destination (traitement différent pour fichiers vs répertoires)
        let source, wslCachePath;
        
        if (syncOptions.isFile) {
            // Pour un fichier : pas de / final, et la destination doit être le répertoire parent
            source = `${sshConnection.username}@${sshConnection.host}:${remotePath}`;
            // Créer le répertoire parent dans le cache et copier le fichier dedans
            const wslBaseCache = pathConverter.windowsToWSL(cachePath);
            const fileName = path.basename(remotePath);
            wslCachePath = wslBaseCache.replace(/\/?$/, '/');
            
            // Pour rsync avec un fichier source, il faut juste spécifier le répertoire de destination
            logger.debug(`Mode fichier: ${source} -> ${wslCachePath}`);
        } else {
            // Pour un répertoire : avec / final
            source = `${sshConnection.username}@${sshConnection.host}:${remotePath.replace(/\/?$/, '/')}`;
            wslCachePath = pathConverter.windowsToWSL(cachePath).replace(/\/?$/, '/');
            
            logger.debug(`Mode répertoire: ${source} -> ${wslCachePath}`);
        }

        // Construire une ligne unique exécutée par bash -lc
        // 1) on exporte RSYNC_RSH='...'
        // 2) on lance rsync avec les args, la source et la destination
        const rsyncLine =
            `export RSYNC_RSH='${shQ(rsh)}'; ` +
            `rsync ${rsyncArgs.join(' ')} ${source} ${wslCachePath}`;

        logger.debug('Commande rsync construite:', {
            source,
            destination: wslCachePath,
            isDryRun,
            rsyncLine
        });

        return {
            command: 'wsl.exe',
            args: ['bash', '-lc', rsyncLine],
            env: { LANG: 'en_US.UTF-8' }
        };
    }
    
    /**
     * Ajoute les règles d'exclusion aux arguments rsync
     * @private
     */
    _addExclusionRules(rsyncArgs, syncOptions) {
        const { excludePatterns = [], excludeExtensions = [], excludeDirectories = [] } = syncOptions;
        
        // Exclure les patterns
        for (const pattern of excludePatterns) {
            rsyncArgs.push('--exclude', pattern);
        }
        
        // Exclure les extensions
        for (const ext of excludeExtensions) {
            rsyncArgs.push('--exclude', `*.${ext}`);
        }
        
        // Exclure les dossiers
        for (const dir of excludeDirectories) {
            rsyncArgs.push('--exclude', dir);
        }
    }
    
    /**
     * Parse le nombre de fichiers depuis la sortie rsync
     * @private
     */
    _parseFileCount(stdout) {
        // Compter les lignes de fichiers (pas de dossiers)
        const fileLines = stdout.split('\n').filter(line => {
            return line.trim() && !line.startsWith('d') && !line.includes('total size');
        });
        
        return fileLines.length;
    }
    
    /**
     * Parse et affiche le progrès depuis la sortie rsync
     * @private
     */
    _parseProgress(output, syncId) {
        const progressMatch = output.match(/(\d+)%/);
        if (progressMatch) {
            const percentage = parseInt(progressMatch[1]);
            if (percentage > 0 && percentage % 10 === 0) { // Log tous les 10%
                logger.info(`[${syncId}] Progression: ${percentage}%`);
            }
        }
    }
    
    /**
     * Compte les fichiers transférés depuis la sortie
     * @private
     */
    _countTransferredFiles(output) {
        // Rechercher les lignes indiquant des transferts de fichiers
        const fileMatches = output.match(/^[^d]/gm);
        return fileMatches ? fileMatches.length : 0;
    }
}

// Export d'une instance singleton
export const rsyncExecutor = new RsyncExecutor();