/**
 * Health check routes
 * Provides endpoints for monitoring server and service status
 */
import { Router } from 'express';
import { getFirebaseAuth, getFirebaseFirestore } from '../config/firebase.js';
import { checkRedisHealth } from '../config/redis.js';
import { getAllQueues, queueHelpers } from '../config/queues.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { 
  basicHealthCheck, 
  detailedHealthCheck, 
  readinessCheck, 
  livenessCheck, 
  getSystemMetrics 
} from '../services/healthService.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * Basic health check
 * GET /health
 */
router.get('/', (req, res) => {
  const health = basicHealthCheck();
  res.status(200).json({
    success: true,
    message: 'Server is running',
    ...health
  });
});

/**
 * Detailed health check with service status
 * GET /health/detailed
 */
router.get('/detailed', asyncHandler(async (req, res) => {
  const health = await detailedHealthCheck();
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
}));

/**
 * Readiness check for load balancers
 * GET /health/ready
 */
router.get('/ready', asyncHandler(async (req, res) => {
  const readiness = await readinessCheck();
  const statusCode = readiness.ready ? 200 : 503;
  res.status(statusCode).json({
    success: readiness.ready,
    ...readiness
  });
}));

/**
 * Liveness check for container orchestration
 * GET /health/live
 */
router.get('/live', (req, res) => {
  const liveness = livenessCheck();
  res.status(200).json({
    success: true,
    ...liveness
  });
});

/**
 * System metrics endpoint
 * GET /health/metrics
 */
router.get('/metrics', (req, res) => {
  const metrics = getSystemMetrics();
  res.json({
    success: true,
    ...metrics
  });
});

export default router; 