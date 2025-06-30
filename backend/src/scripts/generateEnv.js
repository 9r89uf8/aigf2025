/**
 * Generate Environment File Script
 * Creates an example .env file with all required and optional variables
 */
import fs from 'fs';
import path from 'path';
import { generateExampleEnv } from '../utils/validateEnv.js';

const generateEnvFile = () => {
  try {
    const envContent = generateExampleEnv();
    const envPath = path.join(process.cwd(), '.env.example');
    
    fs.writeFileSync(envPath, envContent);
    
    console.log('✅ Generated .env.example file successfully!');
    console.log(`📁 Location: ${envPath}`);
    console.log('\nNext steps:');
    console.log('1. Copy .env.example to .env');
    console.log('2. Fill in your actual values');
    console.log('3. Never commit .env to version control');
    
  } catch (error) {
    console.error('❌ Error generating .env file:', error.message);
    process.exit(1);
  }
};

// Run the script
generateEnvFile(); 