import admin from 'firebase-admin';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(import.meta.url);

// CONFIGURATION OPTIONS:
// 1. Use service account file (development)
// 2. Use environment variables (production)
// 3. Use Firebase Admin SDK with default credentials (cloud environments)

let firebaseConfig = {};

// Option 1: Local development with service account file
if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  try {
    const serviceAccount = require(path.resolve(serviceAccountPath));
    firebaseConfig.credential = admin.credential.cert(serviceAccount);
    console.log(`Using Firebase service account from: ${serviceAccountPath}`);
  } catch (error) {
    console.error(`Error loading Firebase service account from ${serviceAccountPath}: ${error.message}`);
    console.warn('Falling back to default credentials...');
    firebaseConfig.credential = admin.credential.applicationDefault();
  }
}
// Option 2: Using environment variables
else if (process.env.FIREBASE_PROJECT_ID) {
  firebaseConfig = {
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  };
}
// Option 3: Default credentials (for Google Cloud environments)
else {
  firebaseConfig.credential = admin.credential.applicationDefault();
}

// Check if we should use emulator
const useEmulator = process.env.USE_FIREBASE_EMULATOR === 'true';

// Initialize Firebase immediately
if (!admin.apps.length) {
  admin.initializeApp(firebaseConfig);

  // Connect to Firestore emulator if enabled
  if (useEmulator) {
    const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
    const authHost = process.env.AUTH_EMULATOR_HOST || 'localhost:9099';
    
    admin.firestore().settings({
      host: firestoreHost,
      ssl: false,
    });
    
    console.log(`🔥 Connected to Firebase emulators (Firestore: ${firestoreHost}, Auth: ${authHost})`);
  } else {
    console.log('🔥 Connected to Firebase production services');
  }
}

// Export the initialized admin SDK
export default admin;