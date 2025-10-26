import simpleGit from 'simple-git';
import { dirname, join, resolve } from 'path';
import { access, constants } from 'fs/promises';
import { getLogger } from '../../utils/logger.js';

const logger = getLogger();

/**
 * Service pour détecter les fichiers modifiés via Git
 */
export class GitDetectionService {
  constructor(repositoryPath) {
    this.repositoryPath = resolve(repositoryPath);
    this.git = simpleGit(this.repositoryPath);
  }

  /**
   * Vérifie si le répertoire est un repository Git
   * @returns {Promise<boolean>}
   */
  async isGitRepository() {
    try {
      await this.git.status();
      return true;
    } catch (error) {
      logger.debug(`Not a git repository: ${this.repositoryPath}`);
      return false;
    }
  }

  /**
   * Trouve la racine du repository Git en remontant l'arborescence
   * @param {string} startPath - Chemin de départ
   * @returns {Promise<string|null>} Chemin de la racine Git ou null
   */
  static async findGitRoot(startPath) {
    let currentPath = resolve(startPath);
    const rootPath = resolve('/');

    // Remonter jusqu'à trouver .git ou atteindre la racine du système
    while (currentPath !== rootPath) {
      try {
        const gitPath = join(currentPath, '.git');
        await access(gitPath, constants.F_OK);
        logger.info(`Git root found: ${currentPath}`);
        return currentPath;
      } catch {
        // .git n'existe pas ici, remonter d'un niveau
        currentPath = dirname(currentPath);
      }
    }

    logger.debug(`No git root found from: ${startPath}`);
    return null;
  }

  /**
   * Récupère tous les fichiers modifiés
   * @returns {Promise<Object>} Objet avec fichiers catégorisés
   */
  async getModifiedFiles() {
    try {
      const status = await this.git.status();

      const result = {
        // Fichiers staged (git add)
        staged: status.staged || [],

        // Fichiers modifiés non staged
        modified: status.modified || [],

        // Nouveaux fichiers non trackés
        untracked: status.not_added || [],

        // Fichiers en conflit
        conflicted: status.conflicted || [],

        // Fichiers supprimés
        deleted: status.deleted || [],

        // Tous les fichiers avec changements
        allChanged: status.files.map(f => ({
          path: f.path,
          workingDir: f.working_dir,  // M = modified, D = deleted, ?? = untracked
          index: f.index              // M = staged, A = added, D = deleted
        })),

        // Informations générales
        isClean: status.isClean(),
        currentBranch: status.current,
        tracking: status.tracking
      };

      logger.info(`Git status: ${result.allChanged.length} files changed, clean=${result.isClean}`);
      return result;

    } catch (error) {
      logger.error('Error getting git status:', error);
      throw new Error(`Failed to detect git changes: ${error.message}`);
    }
  }

  /**
   * Récupère uniquement les fichiers avec changements non committés
   * (staged + modified, excluant untracked)
   * @returns {Promise<string[]>}
   */
  async getUncommittedFiles() {
    const status = await this.getModifiedFiles();
    return [...status.staged, ...status.modified];
  }

  /**
   * Récupère tous les fichiers changés incluant untracked
   * @returns {Promise<string[]>}
   */
  async getAllChangedFiles() {
    const status = await this.getModifiedFiles();
    return [
      ...status.staged,
      ...status.modified,
      ...status.untracked
    ];
  }

  /**
   * Récupère les fichiers changés dans les N derniers commits
   * @param {number} commitCount - Nombre de commits à analyser
   * @returns {Promise<string[]>}
   */
  async getRecentlyChangedFiles(commitCount = 1) {
    try {
      const log = await this.git.log(['--name-only', `-n${commitCount}`]);
      const files = new Set();

      log.all.forEach(commit => {
        if (commit.diff && commit.diff.files) {
          commit.diff.files.forEach(file => {
            files.add(file.file);
          });
        }
      });

      logger.info(`Found ${files.size} files in last ${commitCount} commits`);
      return Array.from(files);

    } catch (error) {
      logger.error('Error getting recent changes:', error);
      return [];
    }
  }

  /**
   * Récupère la branche courante
   * @returns {Promise<string>}
   */
  async getCurrentBranch() {
    try {
      const status = await this.git.status();
      return status.current;
    } catch (error) {
      logger.error('Error getting current branch:', error);
      return 'unknown';
    }
  }
}
