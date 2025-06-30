/**
 * Seed Data Script
 * Populates the database with test data for development and testing
 */
import { initializeFirebase, getFirebaseAuth, getFirebaseFirestore } from '../config/firebase.js';
import { initializeRedis } from '../config/redis.js';
import { createUser } from '../services/userService.js';
import { createCharacter } from '../services/characterService.js';
import logger from '../utils/logger.js';

// Test data
const TEST_USERS = [
  {
    email: 'testuser1@example.com',
    password: 'TestPassword123!',
    username: 'testuser1',
    displayName: 'Test User 1'
  },
  {
    email: 'testadmin@example.com',
    password: 'AdminPassword123!',
    username: 'testadmin',
    displayName: 'Test Admin',
    isAdmin: true
  },
  {
    email: 'premium@example.com',
    password: 'PremiumPassword123!',
    username: 'premiumuser',
    displayName: 'Premium User',
    isPremium: true
  }
];

const TEST_CHARACTERS = [
  {
    name: 'Luna',
    description: 'A cheerful and energetic AI companion who loves to chat about everything!',
    bio: 'Luna is a vibrant and enthusiastic companion who brings joy and energy to every conversation. She loves exploring new topics, sharing stories, and making friends. Her curiosity knows no bounds, and she approaches life with infectious optimism.',
    avatar: 'https://api.dicebear.com/7.x/anime/svg?seed=Luna',
    personality: {
      traits: ['adventurous', 'analytical', 'artistic', 'caring', 'charismatic'],
      tone: 'upbeat'
    },
    tags: ['friendly', 'energetic', 'conversation', 'fun'],
    gallery: [
      {
        id: 'luna1',
        type: 'image',
        url: 'https://api.dicebear.com/7.x/anime/svg?seed=Luna1',
        thumbnailUrl: 'https://api.dicebear.com/7.x/anime/svg?seed=Luna1&size=150',
        caption: 'Luna enjoying the sunshine'
      }
    ],
    aiSettings: {
      model: 'gpt-3.5-turbo',
      temperature: 0.8,
      maxTokens: 150,
      systemPrompt: 'You are Luna, a cheerful and energetic AI companion.'
    }
  },
  {
    name: 'Sophia',
    description: 'An intellectual and thoughtful AI who enjoys deep conversations about life, philosophy, and science.',
    bio: 'Sophia is a wise and contemplative soul with a deep love for knowledge and understanding. She enjoys exploring complex ideas, philosophical questions, and scientific discoveries. Her thoughtful nature and empathetic approach make her an excellent companion for meaningful discussions.',
    avatar: 'https://api.dicebear.com/7.x/anime/svg?seed=Sophia',
    personality: {
      traits: ['adventurous', 'analytical', 'artistic', 'caring', 'charismatic'],
      tone: 'calm'
    },
    tags: ['intellectual', 'philosophy', 'science', 'deep-conversations'],
    gallery: [
      {
        id: 'sophia1',
        type: 'image',
        url: 'https://api.dicebear.com/7.x/anime/svg?seed=Sophia1',
        thumbnailUrl: 'https://api.dicebear.com/7.x/anime/svg?seed=Sophia1&size=150',
        caption: 'Sophia in her library'
      }
    ],
    aiSettings: {
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 200,
      systemPrompt: 'You are Sophia, an intellectual and thoughtful AI companion.'
    }
  },
  {
    name: 'Aria',
    description: 'A creative and artistic soul who loves discussing music, art, and creative projects.',
    bio: 'Aria is a passionate artist with a soul that resonates with all forms of creative expression. From music to painting, poetry to dance, she finds beauty in every artistic endeavor. Her warm and expressive nature makes her the perfect companion for exploring creativity and imagination.',
    avatar: 'https://api.dicebear.com/7.x/anime/svg?seed=Aria',
    personality: {
      traits: ['adventurous', 'analytical', 'artistic', 'caring', 'charismatic'],
      tone: 'warm'
    },
    tags: ['creative', 'artistic', 'music', 'art'],
    gallery: [
      {
        id: 'aria1',
        type: 'image',
        url: 'https://api.dicebear.com/7.x/anime/svg?seed=Aria1',
        thumbnailUrl: 'https://api.dicebear.com/7.x/anime/svg?seed=Aria1&size=150',
        caption: 'Aria at her piano'
      }
    ],
    aiSettings: {
      model: 'gpt-3.5-turbo',
      temperature: 0.9,
      maxTokens: 150,
      systemPrompt: 'You are Aria, a creative and artistic AI companion.'
    }
  }
];

/**
 * Create test users
 * @returns {Promise<Array>} Created users
 */
const createTestUsers = async () => {
  const auth = getFirebaseAuth();
  const createdUsers = [];
  
  for (const userData of TEST_USERS) {
    try {
      // Create Firebase Auth user
      const userRecord = await auth.createUser({
        email: userData.email,
        password: userData.password,
        displayName: userData.displayName
      });
      
      // Create user profile in Firestore
      const userProfile = await createUser(userRecord.uid, {
        email: userData.email,
        username: userData.username,
        displayName: userData.displayName,
        isAdmin: userData.isAdmin || false,
        isPremium: userData.isPremium || false,
        premiumExpiresAt: userData.isPremium 
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
          : null
      });
      
      createdUsers.push({
        ...userProfile,
        password: userData.password // For logging purposes only
      });
      
      logger.info('Test user created', {
        email: userData.email,
        username: userData.username,
        uid: userRecord.uid
      });
      
    } catch (error) {
      if (error.code === 'auth/email-already-exists') {
        logger.warn('User already exists', { email: userData.email });
      } else {
        logger.error('Error creating test user:', error);
      }
    }
  }
  
  return createdUsers;
};

/**
 * Create test characters
 * @returns {Promise<Array>} Created characters
 */
const createTestCharacters = async () => {
  const createdCharacters = [];
  
  for (const charData of TEST_CHARACTERS) {
    try {
      const character = await createCharacter(charData);
      createdCharacters.push(character);
      
      logger.info('Test character created', {
        name: charData.name,
        id: character.id
      });
      
    } catch (error) {
      logger.error('Error creating test character:', error);
    }
  }
  
  return createdCharacters;
};

/**
 * Main seed function
 */
const seedDatabase = async () => {
  try {
    logger.info('Starting database seeding...');
    
    // Initialize services
    initializeFirebase();
    initializeRedis();
    
    // Create test users
    logger.info('Creating test users...');
    const users = await createTestUsers();
    logger.info(`Created ${users.length} test users`);
    
    // Create test characters
    logger.info('Creating test characters...');
    const characters = await createTestCharacters();
    logger.info(`Created ${characters.length} test characters`);
    
    // Log credentials for testing
    logger.info('=== Test Credentials ===');
    users.forEach(user => {
      logger.info(`Email: ${user.email}, Password: ${user.password || 'Check TEST_USERS array'}`);
    });
    
    logger.info('Database seeding completed successfully!');
    
    // Output summary
    const summary = {
      users: users.map(u => ({
        email: u.email,
        username: u.username,
        isAdmin: u.isAdmin,
        isPremium: u.isPremium
      })),
      characters: characters.map(c => ({
        id: c.id,
        name: c.name,
        model: c.aiSettings.model
      }))
    };
    
    console.log('\n=== Seed Data Summary ===');
    console.log(JSON.stringify(summary, null, 2));
    
  } catch (error) {
    logger.error('Database seeding failed:', error);
    process.exit(1);
  }
};

/**
 * Clean database (remove all test data)
 */
const cleanDatabase = async () => {
  try {
    logger.info('Cleaning database...');
    
    const auth = getFirebaseAuth();
    const firestore = getFirebaseFirestore();
    
    // Delete test users
    for (const userData of TEST_USERS) {
      try {
        const userRecord = await auth.getUserByEmail(userData.email);
        await auth.deleteUser(userRecord.uid);
        await firestore.collection('users').doc(userRecord.uid).delete();
        logger.info('Deleted test user', { email: userData.email });
      } catch (error) {
        if (error.code !== 'auth/user-not-found') {
          logger.error('Error deleting user:', error);
        }
      }
    }
    
    // Delete test characters
    const charactersSnapshot = await firestore.collection('characters').get();
    const deletePromises = charactersSnapshot.docs
      .filter(doc => TEST_CHARACTERS.some(tc => tc.name === doc.data().name))
      .map(doc => doc.ref.delete());
    
    await Promise.all(deletePromises);
    logger.info(`Deleted ${deletePromises.length} test characters`);
    
    logger.info('Database cleaned successfully!');
    
  } catch (error) {
    logger.error('Database cleaning failed:', error);
    process.exit(1);
  }
};

// Parse command line arguments
const command = process.argv[2];

if (command === 'clean') {
  cleanDatabase().then(() => process.exit(0));
} else if (command === 'seed') {
  seedDatabase().then(() => process.exit(0));
} else {
  console.log('Usage: node seedData.js [seed|clean]');
  console.log('  seed  - Create test users and characters');
  console.log('  clean - Remove all test data');
  process.exit(1);
} 