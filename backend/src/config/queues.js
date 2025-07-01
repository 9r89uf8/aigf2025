/**
 * Queue configuration using Bull
 * Manages background job processing
 */
import Queue from 'bull';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter.js';
import { ExpressAdapter } from '@bull-board/express';
import { config } from './environment.js';
import logger from '../utils/logger.js';

// Queue instances storage
const queues = {};

/**
 * Create or get a queue instance
 * @param {string} name - Queue name
 * @param {Object} options - Queue options
 * @returns {Queue} Bull queue instance
 */
export const createQueue = (name, options = {}) => {
  if (queues[name]) {
    return queues[name];
  }

  const defaultOptions = {
    redis: {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db
    },
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    },
    ...options
  };

  const queue = new Queue(name, defaultOptions);

  // Queue event handlers
  queue.on('error', (error) => {
    logger.error(`Queue ${name} error:`, error);
  });

  queue.on('failed', (job, err) => {
    logger.error(`Job ${job.id} in queue ${name} failed:`, {
      jobId: job.id,
      error: err.message,
      data: job.data
    });
  });

  queue.on('completed', (job, result) => {
    logger.debug(`Job ${job.id} in queue ${name} completed`, {
      jobId: job.id,
      processingTime: Date.now() - job.timestamp
    });
  });

  queue.on('stalled', (job) => {
    logger.warn(`Job ${job.id} in queue ${name} stalled`);
  });

  queues[name] = queue;
  return queue;
};

/**
 * Get all queue instances
 * @returns {Object} All queues
 */
export const getAllQueues = () => queues;

/**
 * Close all queues
 * @returns {Promise<void>}
 */
export const closeAllQueues = async () => {
  const queueList = Object.values(queues);
  await Promise.all(queueList.map(q => q.close()));
  logger.info('All queues closed');
};

/**
 * Create Bull Board for queue monitoring
 * @returns {Object} Express router and UI path
 */
export const createQueueMonitor = () => {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  const queueAdapters = Object.entries(queues).map(
    ([name, queue]) => new BullAdapter(queue, { readOnlyMode: false })
  );

  createBullBoard({
    queues: queueAdapters,
    serverAdapter
  });

  return {
    router: serverAdapter.getRouter(),
    path: '/admin/queues'
  };
};

/**
 * Initialize standard queues
 */
export const initializeQueues = () => {
  // Message processing queue
  const messageQueue = createQueue('messages', {
    defaultJobOptions: {
      removeOnComplete: 50,
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 1000
      }
    }
  });

  // AI response queue
  const aiQueue = createQueue('ai-responses', {
    defaultJobOptions: {
      removeOnComplete: 20,
      attempts: 3,
      timeout: 30000 // 30 seconds timeout
    }
  });

  // Media processing queue
  const mediaQueue = createQueue('media-processing', {
    defaultJobOptions: {
      removeOnComplete: 10,
      attempts: 2,
      timeout: 60000 // 1 minute timeout
    }
  });

  // Analytics queue
  const analyticsQueue = createQueue('analytics', {
    defaultJobOptions: {
      removeOnComplete: 100,
      attempts: 1,
      delay: 5000 // Process after 5 seconds
    }
  });

  // Email queue
  const emailQueue = createQueue('emails', {
    defaultJobOptions: {
      removeOnComplete: 50,
      attempts: 3,
      backoff: {
        type: 'fixed',
        delay: 5000
      }
    }
  });

  // Stats sync queue (Phase 2 optimization)
  const statsSyncQueue = createQueue('stats-sync', {
    defaultJobOptions: {
      removeOnComplete: 100,
      attempts: 2,
      repeat: {
        every: 60000 // Run every 60 seconds
      }
    }
  });

  // Batch write queue (Phase 1 optimization)
  const batchWriteQueue = createQueue('batch-writes', {
    defaultJobOptions: {
      removeOnComplete: 50,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    }
  });

  logger.info('Standard queues initialized');

  return {
    messageQueue,
    aiQueue,
    mediaQueue,
    analyticsQueue,
    emailQueue,
    statsSyncQueue,
    batchWriteQueue
  };
};

/**
 * Queue helper functions
 */
export const queueHelpers = {
  /**
   * Add job with priority
   * @param {Queue} queue - Queue instance
   * @param {string} name - Job name
   * @param {Object} data - Job data
   * @param {Object} options - Job options
   * @returns {Promise<Job>} Created job
   */
  addPriorityJob: async (queue, name, data, options = {}) => {
    const priority = options.priority || 0;
    delete options.priority;
    
    return queue.add(name, data, {
      priority,
      ...options
    });
  },

  /**
   * Add delayed job
   * @param {Queue} queue - Queue instance
   * @param {string} name - Job name
   * @param {Object} data - Job data
   * @param {number} delayMs - Delay in milliseconds
   * @param {Object} options - Additional options
   * @returns {Promise<Job>} Created job
   */
  addDelayedJob: async (queue, name, data, delayMs, options = {}) => {
    return queue.add(name, data, {
      delay: delayMs,
      ...options
    });
  },

  /**
   * Get queue metrics
   * @param {Queue} queue - Queue instance
   * @returns {Promise<Object>} Queue metrics
   */
  getQueueMetrics: async (queue) => {
    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.getPausedCount()
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused,
      total: waiting + active + completed + failed + delayed + paused
    };
  }
};

/**
 * Get status of all queues
 * @returns {Promise<Object>} Status of all queues
 */
export const getQueueStatus = async () => {
  const status = {};
  
  for (const [name, queue] of Object.entries(queues)) {
    try {
      status[name] = await queueHelpers.getQueueMetrics(queue);
    } catch (error) {
      logger.error(`Failed to get status for queue ${name}:`, error);
      status[name] = {
        error: error.message,
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: 0,
        total: 0
      };
    }
  }
  
  return status;
};

export default {
  createQueue,
  getAllQueues,
  closeAllQueues,
  createQueueMonitor,
  initializeQueues,
  queueHelpers,
  getQueueStatus
}; 