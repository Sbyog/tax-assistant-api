import admin from 'firebase-admin';

/**
 * Middleware to verify Firebase authentication tokens
 * Extracts and verifies the Firebase token from the Authorization header
 */
const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: No valid authorization token provided'
    });
  }
  
  const token = authHeader.split('Bearer ')[1];
  
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken; // Store user info for potential use in controllers
    next();
  } catch (error) {
    console.error('Firebase token verification failed:', error);
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Invalid or expired authentication token'
    });
  }
};

export { verifyFirebaseToken };
