import express from 'express';
import Joi from 'joi';
import { SmartAutoService } from '../services/smartauto/smart-auto-service.js';
import { GitDetectionService } from '../services/smartauto/git-detection-service.js';
import { getLogger } from '../utils/logger.js';
import { sanitizePath } from '../utils/path-utils.js';

const router = express.Router();
const logger = getLogger();

// Schémas de validation Joi
const analyzeGitSchema = Joi.object({
  projectPath: Joi.string().required(),
  depth: Joi.number().integer().min(1).max(3).default(1),
  includeTests: Joi.boolean().default(true),
  includeStyles: Joi.boolean().default(true)
});

const analyzeFilesSchema = Joi.object({
  projectPath: Joi.string().required(),
  files: Joi.array().items(Joi.string()).min(1).required(),
  depth: Joi.number().integer().min(1).max(3).default(1),
  includeTests: Joi.boolean().default(true),
  includeStyles: Joi.boolean().default(true)
});

const detectGitRootSchema = Joi.object({
  startPath: Joi.string().required()
});

/**
 * POST /api/v1/smartauto/analyze-git
 * Analyse depuis les fichiers Git modifiés
 */
router.post('/analyze-git', async (req, res) => {
  const requestId = Date.now();
  logger.info(`[${requestId}] SmartAuto analyze-git request`);

  try {
    // Validation
    const { error, value } = analyzeGitSchema.validate(req.body);
    if (error) {
      logger.warn(`[${requestId}] Validation error:`, error.details[0].message);
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: error.details[0].message
      });
    }

    // Sanitize path
    const projectPath = sanitizePath(value.projectPath);
    if (!projectPath) {
      return res.status(400).json({
        success: false,
        error: 'Invalid project path'
      });
    }

    // Créer le service et analyser
    const service = new SmartAutoService(projectPath);
    const results = await service.analyzeFromGit({
      depth: value.depth,
      includeTests: value.includeTests,
      includeStyles: value.includeStyles
    });

    logger.info(`[${requestId}] Analysis complete: ${results.stats.totalFiles} files`);

    res.json({
      success: true,
      data: results
    });

  } catch (err) {
    logger.error(`[${requestId}] SmartAuto analyze-git error:`, err);
    res.status(500).json({
      success: false,
      error: err.message,
      details: err.stack
    });
  }
});

/**
 * POST /api/v1/smartauto/analyze-files
 * Analyse depuis une liste de fichiers
 */
router.post('/analyze-files', async (req, res) => {
  const requestId = Date.now();
  logger.info(`[${requestId}] SmartAuto analyze-files request`);

  try {
    // Validation
    const { error, value } = analyzeFilesSchema.validate(req.body);
    if (error) {
      logger.warn(`[${requestId}] Validation error:`, error.details[0].message);
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: error.details[0].message
      });
    }

    // Sanitize path
    const projectPath = sanitizePath(value.projectPath);
    if (!projectPath) {
      return res.status(400).json({
        success: false,
        error: 'Invalid project path'
      });
    }

    // Créer le service et analyser
    const service = new SmartAutoService(projectPath);
    const results = await service.analyzeFromFiles(value.files, {
      depth: value.depth,
      includeTests: value.includeTests,
      includeStyles: value.includeStyles
    });

    logger.info(`[${requestId}] Analysis complete: ${results.stats.totalFiles} files`);

    res.json({
      success: true,
      data: results
    });

  } catch (err) {
    logger.error(`[${requestId}] SmartAuto analyze-files error:`, err);
    res.status(500).json({
      success: false,
      error: err.message,
      details: err.stack
    });
  }
});

/**
 * POST /api/v1/smartauto/detect-git-root
 * Détecte la racine Git d'un projet
 */
router.post('/detect-git-root', async (req, res) => {
  const requestId = Date.now();
  logger.info(`[${requestId}] SmartAuto detect-git-root request`);

  try {
    // Validation
    const { error, value } = detectGitRootSchema.validate(req.body);
    if (error) {
      logger.warn(`[${requestId}] Validation error:`, error.details[0].message);
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: error.details[0].message
      });
    }

    // Sanitize path
    const startPath = sanitizePath(value.startPath);
    if (!startPath) {
      return res.status(400).json({
        success: false,
        error: 'Invalid start path'
      });
    }

    // Détecter la racine Git
    const gitRoot = await GitDetectionService.findGitRoot(startPath);

    if (gitRoot) {
      logger.info(`[${requestId}] Git root found: ${gitRoot}`);
      res.json({
        success: true,
        data: {
          gitRoot,
          isGitRepository: true
        }
      });
    } else {
      logger.info(`[${requestId}] No Git root found`);
      res.json({
        success: true,
        data: {
          gitRoot: null,
          isGitRepository: false
        }
      });
    }

  } catch (err) {
    logger.error(`[${requestId}] SmartAuto detect-git-root error:`, err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * GET /api/v1/smartauto/health
 * Health check
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'smartauto',
    version: '1.0.0'
  });
});

export default router;
