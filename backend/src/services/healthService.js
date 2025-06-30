/**
 * Health Check Service
 * Provides comprehensive health checks for all system components
 */
import { getFirebaseAuth, getFirebaseFirestore } from '../config/firebase.js';
import { getRedisClient, getRedisStatus } from '../config/redis.js';
import { getQueueStatus } from '../config/queues.js';
import { isDeepSeekConfigured } from '../config/deepseek.js';
import { isStripeConfigured } from '../config/stripe.js';
import { isStorageConfigured, getStorageClient } from '../config/storage.js';
import { getEnvironmentSummary } from '../utils/validateEnv.js';
import logger from '../utils/logger.js';

/**
 * Health check status levels
 */
export const HealthStatus = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy'
};

/**
 * Perform basic health check
 * @returns {Object} Basic health status
 */
export const basicHealthCheck = () => {
  return {
    status: HealthStatus.HEALTHY,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0'
  };
};

/**
 * Check Firebase health
 * @returns {Promise<Object>} Firebase health status
 */
const checkFirebaseHealth = async () => {
  const check = {
    service: 'firebase',
    status: HealthStatus.HEALTHY,
    details: {}
  };
  
  try {
    // Test Auth
    const auth = getFirebaseAuth();
    check.details.auth = auth ? 'connected' : 'not initialized';
    
    // Test Firestore with a simple read
    const firestore = getFirebaseFirestore();
    const testDoc = await firestore.collection('_health').doc('test').get();
    check.details.firestore = 'connected';
    check.details.canRead = true;
    
  } catch (error) {
    check.status = HealthStatus.UNHEALTHY;
    check.error = error.message;
    logger.error('Firebase health check failed:', error);
  }
  
  return check;
};

/**
 * Check Redis health
 * @returns {Promise<Object>} Redis health status
 */
const checkRedisHealth = async () => {
  const check = {
    service: 'redis',
    status: HealthStatus.HEALTHY,
    details: {}
  };
  
  try {
    const redis = getRedisClient();
    const pong = await redis.ping();
    
    if (pong !== 'PONG') {
      throw new Error('Redis ping failed');
    }
    
    const status = getRedisStatus();
    check.details = {
      ...status,
      connected: true,
      responseTime: 'fast'
    };
    
    // Test write/read
    const testKey = '_health:test';
    await redis.set(testKey, Date.now(), 'EX', 60);
    const testValue = await redis.get(testKey);
    check.details.canWrite = true;
    check.details.canRead = !!testValue;
    
  } catch (error) {
    check.status = HealthStatus.UNHEALTHY;
    check.error = error.message;
    logger.error('Redis health check failed:', error);
  }
  
  return check;
};

/**
 * Check Queue health
 * @returns {Promise<Object>} Queue health status
 */
const checkQueueHealth = async () => {
  const check = {
    service: 'queues',
    status: HealthStatus.HEALTHY,
    details: {}
  };
  
  try {
    const queueStatus = await getQueueStatus();
    check.details = queueStatus;
    
    // Check if any queue has too many failed jobs
    for (const [queueName, status] of Object.entries(queueStatus)) {
      if (status.failed > 100) {
        check.status = HealthStatus.DEGRADED;
        check.warning = `High failed job count in ${queueName} queue`;
      }
    }
    
  } catch (error) {
    check.status = HealthStatus.UNHEALTHY;
    check.error = error.message;
    logger.error('Queue health check failed:', error);
  }
  
  return check;
};

/**
 * Check DeepSeek health
 * @returns {Promise<Object>} DeepSeek health status
 */
const checkDeepSeekHealth = async () => {
  const check = {
    service: 'deepseek',
    status: HealthStatus.HEALTHY,
    details: {}
  };
  
  try {
    const configured = isDeepSeekConfigured();
    check.details.configured = configured;
    
    if (!configured) {
      check.status = HealthStatus.DEGRADED;
      check.details.message = 'DeepSeek not configured - AI features disabled';
      return check;
    }
    
    check.details.hasApiKey = !!process.env.DEEPSEEK_API_KEY;
    
  } catch (error) {
    check.status = HealthStatus.UNHEALTHY;
    check.error = error.message;
    logger.error('DeepSeek health check failed:', error);
  }
  
  return check;
};

/**
 * Check Stripe health
 * @returns {Promise<Object>} Stripe health status
 */
const checkStripeHealth = async () => {
  const check = {
    service: 'stripe',
    status: HealthStatus.HEALTHY,
    details: {}
  };
  
  try {
    const configured = isStripeConfigured();
    check.details.configured = configured;
    
    if (!configured) {
      check.status = HealthStatus.DEGRADED;
      check.details.message = 'Stripe not configured - Payment features disabled';
      return check;
    }
    
    // Could add a test API call here
    check.details.webhookConfigured = !!process.env.STRIPE_WEBHOOK_SECRET;
    
  } catch (error) {
    check.status = HealthStatus.UNHEALTHY;
    check.error = error.message;
    logger.error('Stripe health check failed:', error);
  }
  
  return check;
};

/**
 * Check Storage health
 * @returns {Promise<Object>} Storage health status
 */
const checkStorageHealth = async () => {
  const check = {
    service: 'storage',
    status: HealthStatus.HEALTHY,
    details: {}
  };
  
  try {
    const configured = isStorageConfigured();
    check.details.configured = configured;
    
    if (!configured) {
      check.status = HealthStatus.DEGRADED;
      check.details.message = 'Storage not configured - Media features disabled';
      return check;
    }
    
    // Test bucket access
    const storage = getStorageClient();
    if (storage && process.env.STORAGE_BUCKET) {
      const bucket = storage.bucket(process.env.STORAGE_BUCKET);
      const [exists] = await bucket.exists();
      check.details.bucketExists = exists;
      
      if (!exists) {
        check.status = HealthStatus.UNHEALTHY;
        check.error = 'Storage bucket does not exist';
      }
    }
    
  } catch (error) {
    check.status = HealthStatus.UNHEALTHY;
    check.error = error.message;
    logger.error('Storage health check failed:', error);
  }
  
  return check;
};

/**
 * Perform detailed health check
 * @returns {Promise<Object>} Detailed health status
 */
export const detailedHealthCheck = async () => {
  const startTime = Date.now();
  const health = {
    ...basicHealthCheck(),
    services: {},
    summary: {
      totalServices: 0,
      healthyServices: 0,
      degradedServices: 0,
      unhealthyServices: 0
    }
  };
  
  // Run all health checks in parallel
  const checks = await Promise.allSettled([
    checkFirebaseHealth(),
    checkRedisHealth(),
    checkQueueHealth(),
    checkDeepSeekHealth(),
    checkStripeHealth(),
    checkStorageHealth()
  ]);
  
  // Process results
  for (const result of checks) {
    if (result.status === 'fulfilled') {
      const check = result.value;
      health.services[check.service] = check;
      health.summary.totalServices++;
      
      switch (check.status) {
        case HealthStatus.HEALTHY:
          health.summary.healthyServices++;
          break;
        case HealthStatus.DEGRADED:
          health.summary.degradedServices++;
          break;
        case HealthStatus.UNHEALTHY:
          health.summary.unhealthyServices++;
          break;
      }
    } else {
      // Check promise rejected
      health.services.unknown = {
        status: HealthStatus.UNHEALTHY,
        error: result.reason.message
      };
      health.summary.totalServices++;
      health.summary.unhealthyServices++;
    }
  }
  
  // Determine overall health
  if (health.summary.unhealthyServices > 0) {
    health.status = HealthStatus.UNHEALTHY;
  } else if (health.summary.degradedServices > 0) {
    health.status = HealthStatus.DEGRADED;
  }
  
  // Add environment summary
  health.environment = getEnvironmentSummary();
  
  // Add performance metrics
  health.performance = {
    checkDuration: Date.now() - startTime,
    memory: process.memoryUsage(),
    cpu: process.cpuUsage()
  };
  
  return health;
};

/**
 * Check if system is ready to handle requests
 * @returns {Promise<Object>} Readiness status
 */
export const readinessCheck = async () => {
  const checks = {
    ready: true,
    checks: {}
  };
  
  try {
    // Firebase must be ready
    const firebaseHealth = await checkFirebaseHealth();
    checks.checks.firebase = firebaseHealth.status === HealthStatus.HEALTHY;
    if (!checks.checks.firebase) checks.ready = false;
    
    // Redis must be ready
    const redisHealth = await checkRedisHealth();
    checks.checks.redis = redisHealth.status === HealthStatus.HEALTHY;
    if (!checks.checks.redis) checks.ready = false;
    
    // Queues should be ready
    const queueHealth = await checkQueueHealth();
    checks.checks.queues = queueHealth.status !== HealthStatus.UNHEALTHY;
    
  } catch (error) {
    checks.ready = false;
    checks.error = error.message;
  }
  
  return checks;
};

/**
 * Simple liveness check
 * @returns {Object} Liveness status
 */
export const livenessCheck = () => {
  return {
    alive: true,
    timestamp: new Date().toISOString(),
    pid: process.pid
  };
};

/**
 * Get system metrics
 * @returns {Object} System metrics
 */
export const getSystemMetrics = () => {
  const os = require('os');
  
  const metrics = {
    timestamp: new Date().toISOString(),
    process: {
      uptime: process.uptime(),
      pid: process.pid,
      version: process.version,
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    },
    system: {
      platform: process.platform,
      arch: process.arch,
      loadavg: process.platform !== 'win32' ? os.loadavg() : [0, 0, 0],
      freemem: os.freemem(),
      totalmem: os.totalmem()
    }
  };
  
  return metrics;
};

export default {
  basicHealthCheck,
  detailedHealthCheck,
  readinessCheck,
  livenessCheck,
  getSystemMetrics,
  HealthStatus
}; 