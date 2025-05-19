class AuthController {
  constructor(authService) { // Modified constructor
    this.authService = authService;
  }

  async verifyUserToken(req, res) {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Token is required' });
    }

    try {
      // Use authService to call verifyToken
      const result = await this.authService.verifyToken(token);
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error verifying token:', error);
      // Assuming verifyToken service might return an error object with a specific status
      if (error.status) {
        return res.status(error.status).json({ success: false, message: error.message });
      }
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
  }
  
  async checkUserPermissions(req, res) {
    const { token, requiredRole } = req.body;

    if (!token || !requiredRole) {
      return res.status(400).json({ 
        success: false, 
        message: 'Token and required role are required' 
      });
    }

    try {
      // First verify the token using authService
      const verifyResult = await this.authService.verifyToken(token);
      
      if (!verifyResult.success) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
      }
      
      // Then check if user has the required role using authService
      const roleResult = await this.authService.checkUserRole(verifyResult.uid, requiredRole);
      return res.status(200).json(roleResult);
    } catch (error) {
      console.error('Error checking permissions:', error);
      // Assuming checkUserRole service might return an error object with a specific status
      if (error.status) {
        return res.status(error.status).json({ success: false, message: error.message });
      }
      return res.status(500).json({ success: false, message: 'Error checking permissions' });
    }
  }
  
  async getUserInfo(req, res) {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Token is required' });
    }

    try {
      // First verify the token using authService
      const verifyResult = await this.authService.verifyToken(token);
      
      if (!verifyResult.success) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
      }
      
      // Here you would normally fetch user data from database
      // For template purposes, we'll return dummy data
      return res.status(200).json({
        success: true,
        data: {
          uid: verifyResult.uid,
          email: 'user@example.com',
          displayName: 'Example User',
          role: 'user',
          createdAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error getting user info:', error);
      return res.status(500).json({ success: false, message: 'Error retrieving user information' });
    }
  }

  async checkUserExists(req, res) {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ message: 'userId is required' });
      }
      const exists = await this.authService.checkUserExists(userId);
      return res.status(200).json({ exists });
    } catch (error) {
      console.error('Error checking if user exists:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  async createUser(req, res) {
    try {
      const { uid, email, displayName, photoURL } = req.body;
      if (!uid || !email) {
        return res.status(400).json({ message: 'uid and email are required' });
      }
      await this.authService.createUser(uid, email, displayName, photoURL);
      return res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
      console.error('Error creating user:', error);
      if (error.message === 'User already exists') {
        return res.status(409).json({ message: 'User already exists' });
      }
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  async updateUserLastLogin(req, res) {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ message: 'userId is required' });
      }
      const success = await this.authService.updateUserLastLogin(userId);
      if (!success) {
        return res.status(404).json({ message: 'User not found' });
      }
      return res.status(200).send(); // Or 204 No Content
    } catch (error) {
      console.error('Error updating user last login:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  async getUserData(req, res) {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ message: 'userId is required' });
      }
      const userData = await this.authService.getUserData(userId);
      if (!userData) {
        return res.status(404).json({ message: 'User not found' });
      }
      return res.status(200).json(userData);
    } catch (error) {
      console.error('Error getting user data:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  async updateUserData(req, res) {
    try {
      const userId = req.user.uid; // Get userId from authenticated user
      const dataToUpdate = req.body;

      if (!userId) {
        // This case should ideally be caught by verifyFirebaseToken middleware
        return res.status(401).json({ success: false, message: 'User not authenticated.' });
      }

      if (Object.keys(dataToUpdate).length === 0) {
        return res.status(400).json({ success: false, message: 'No data provided for update.' });
      }

      const result = await this.authService.updateUserData(userId, dataToUpdate);
      
      // The service throws an error if user not found, or returns { success, message }
      return res.status(200).json(result);

    } catch (error) {
      console.error('Error updating user data in controller:', error);
      if (error.message === 'User not found') {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }
      // For other errors, like validation errors from service or unexpected issues
      return res.status(500).json({ success: false, message: error.message || 'Internal server error while updating user data.' });
    }
  }
}

export default AuthController;
