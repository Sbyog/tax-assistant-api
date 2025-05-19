import admin from 'firebase-admin';

/**
 * Verify Firebase authentication token
 */
const verifyToken = async (token) => {
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return { success: true, uid: decodedToken.uid, email: decodedToken.email };
  } catch (error) {
    console.error('Error verifying token:', error);
    return { success: false, error: 'Invalid token' };
  }
};

/**
 * Check if a user has a specific role
 */
const checkUserRole = async (uid, requiredRole) => {
  try {
    // Get user from Firestore users collection
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(uid)
      .get();
    
    if (!userDoc.exists) {
      return { success: false, error: 'User not found' };
    }
    
    const userData = userDoc.data();
    const userRole = userData.role || 'user'; // Default role if none specified
    
    // Check if user has required role
    let hasPermission = false;
    
    // Simple role hierarchy: admin > editor > user
    if (requiredRole === 'user') {
      hasPermission = ['user', 'editor', 'admin'].includes(userRole);
    } else if (requiredRole === 'editor') {
      hasPermission = ['editor', 'admin'].includes(userRole);
    } else if (requiredRole === 'admin') {
      hasPermission = userRole === 'admin';
    }
    
    return { 
      success: true, 
      hasPermission,
      userRole
    };
  } catch (error) {
    console.error('Error checking user role:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Create auth middleware to protect routes
 */
const authMiddleware = (requiredRole = null) => {
  return async (req, res, next) => {
    try {
      // Get token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'No valid authorization header' });
      }
      
      const token = authHeader.split(' ')[1];
      const verifyResult = await verifyToken(token);
      
      if (!verifyResult.success) {
        return res.status(401).json({ success: false, error: 'Invalid token' });
      }
      
      // Add user info to request
      req.user = { uid: verifyResult.uid, email: verifyResult.email };
      
      // Check role if required
      if (requiredRole) {
        const roleResult = await checkUserRole(verifyResult.uid, requiredRole);
        
        if (!roleResult.success || !roleResult.hasPermission) {
          return res.status(403).json({ success: false, error: 'Insufficient permissions' });
        }
      }
      
      // User is authenticated (and authorized if role was checked)
      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.status(500).json({ success: false, error: 'Authentication error' });
    }
  };
};

/**
 * Check if a user exists in Firestore
 */
const checkUserExists = async (userId) => {
  try {
    const userRef = admin.firestore().collection('users').doc(userId);
    const doc = await userRef.get();
    return doc.exists;
  } catch (error) {
    console.error('Error checking if user exists:', error);
    throw error; // Re-throw to be handled by controller
  }
};

/**
 * Create a new user in Firestore
 */
const createUser = async (uid, email, displayName, photoURL) => {
  try {
    const userRef = admin.firestore().collection('users').doc(uid);
    const doc = await userRef.get();

    if (doc.exists) {
      throw new Error('User already exists');
    }

    const userData = {
      uid,
      email,
      displayName: displayName || null,
      photoURL: photoURL || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLogin: null, // Initialize lastLogin
      stripeCustomerId: null, // Initialize stripeCustomerId
      // Add any other default fields here, e.g., role
      role: 'user' 
    };

    await userRef.set(userData);
    return userData; // Or just return success
  } catch (error) {
    console.error('Error creating user:', error);
    throw error; // Re-throw to be handled by controller
  }
};

/**
 * Update user's last login timestamp in Firestore
 */
const updateUserLastLogin = async (userId) => {
  try {
    const userRef = admin.firestore().collection('users').doc(userId);
    const doc = await userRef.get();

    if (!doc.exists) {
      return false; // User not found
    }

    await userRef.update({
      lastLogin: admin.firestore.FieldValue.serverTimestamp()
    });
    return true; // Success
  } catch (error) {
    console.error('Error updating user last login:', error);
    throw error; // Re-throw to be handled by controller
  }
};

/**
 * Get user data from Firestore
 */
const getUserData = async (userId) => {
  try {
    const userRef = admin.firestore().collection('users').doc(userId);
    const doc = await userRef.get();

    if (!doc.exists) {
      return null; // User not found
    }
    // Ensure all expected fields are present, even if null
    const data = doc.data();
    return {
        uid: data.uid,
        email: data.email,
        displayName: data.displayName || null,
        photoURL: data.photoURL || null,
        createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
        lastLogin: data.lastLogin ? data.lastLogin.toDate().toISOString() : null,
        stripeCustomerId: data.stripeCustomerId || null,
        role: data.role || 'user' // ensure role is returned
    };
  } catch (error) {
    console.error('Error getting user data:', error);
    throw error; // Re-throw to be handled by controller
  }
};

/**
 * Update specific user data fields in Firestore.
 * Only allows updating whitelisted fields.
 */
const updateUserData = async (userId, dataToUpdate) => {
  try {
    const userRef = admin.firestore().collection('users').doc(userId);
    const doc = await userRef.get();

    if (!doc.exists) {
      throw new Error('User not found');
    }

    const allowedFields = ['displayName', 'photoURL', 'tutorialCompleted']; // Add other updatable fields here
    const sanitizedData = {};
    let hasUpdates = false;

    for (const key in dataToUpdate) {
      if (allowedFields.includes(key)) {
        // Basic validation for tutorialCompleted
        if (key === 'tutorialCompleted' && typeof dataToUpdate[key] !== 'boolean') {
          console.warn(`Invalid type for tutorialCompleted: ${typeof dataToUpdate[key]}. Skipping.`);
          continue;
        }
        sanitizedData[key] = dataToUpdate[key];
        hasUpdates = true;
      } else {
        console.warn(`Attempted to update restricted or unknown field: ${key}. Skipping.`);
      }
    }

    if (!hasUpdates) {
      // If no valid fields were provided for update, consider it a no-op or slight error.
      // Depending on desired behavior, could return success or indicate no changes made.
      console.log(`No valid fields provided for update for user ${userId}.`);
      return { success: true, message: 'No valid fields to update.' };
    }

    await userRef.update({
      ...sanitizedData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp() // Keep track of updates
    });
    
    console.log(`User data updated for ${userId}:`, sanitizedData);
    return { success: true, message: 'User data updated successfully.' };
  } catch (error) {
    console.error('Error updating user data:', error);
    throw error; // Re-throw to be handled by controller
  }
};

export { 
  verifyToken, 
  checkUserRole, 
  authMiddleware,
  checkUserExists,
  createUser,
  updateUserLastLogin,
  getUserData,
  updateUserData // Add new function to exports
};
