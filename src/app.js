import express from 'express';
import bodyParser from 'body-parser';
import cors from "cors";
import dotenv from 'dotenv';
import admin from 'firebase-admin';

// Load environment variables first
dotenv.config();

// Import Firebase (which will initialize immediately)
import './config/firebase.js';

// Import routes
import dataRoutes from './routes/data.routes.js';
import authRoutes from './routes/auth.routes.js';
import aiRoutes from './routes/ai.routes.js';
import utilityRoutes from './routes/utility.routes.js';
import stripeRoutes from './routes/stripe.routes.js'; // Add this import
import historyRoutes from './routes/history.routes.js'; // <-- Add this import for history

// Function to initialize database statistics on app startup
async function initializeAppStats() {
  try {
    console.log('Initializing app statistics...');
    
    const db = admin.firestore();
    
    // Example of getting total count from a collection
    const totalItemsSnapshot = await db.collection('items').count().get();
    const totalItems = totalItemsSnapshot.data().count;
    
    // Example of getting filtered count from a collection
    const activeItemsSnapshot = await db.collection('items')
      .where('status', '==', 'active')
      .count()
      .get();
    const totalActiveItems = activeItemsSnapshot.data().count;
    
    // Update stats document
    await db.collection('stats').doc('app-metrics').set({
      totalItems,
      totalActiveItems,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    console.log(`App metrics initialized: ${totalItems} total items, ${totalActiveItems} active items`);
  } catch (error) {
    console.error('Error initializing app statistics:', error);
  }
}

// Initialize app statistics on startup
initializeAppStats();

const app = express();

app.use(cors());

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Mount routes - all using consistent REST endpoints
app.use('/data', dataRoutes);
app.use('/auth', authRoutes);
app.use('/ai', aiRoutes);
app.use('/utility', utilityRoutes);
app.use('/payments', stripeRoutes); // Add this route
app.use('/history', historyRoutes); // <-- Add this route for history

export default app;