import os from 'os';
import admin from 'firebase-admin';

class UtilityController {
  async healthCheck(req, res) {
    try {
      // Check Firebase connection
      const timestamp = admin.firestore.Timestamp.now();
      
      return res.status(200).json({
        success: true,
        data: {
          status: 'healthy',
          timestamp: timestamp.toDate().toISOString(),
          serverTime: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Health check failed:', error);
      return res.status(500).json({
        success: false,
        error: 'Service unhealthy',
        details: error.message
      });
    }
  }
  
  async refreshCache(req, res) {
    try {
      // This is a placeholder for cache refresh logic
      // In a real app, you might clear Redis cache, invalidate memory cache, etc.
      
      console.log('Cache refresh requested by admin');
      
      // Simulate cache refresh with a delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return res.status(200).json({
        success: true,
        data: {
          message: 'Cache refreshed successfully',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Cache refresh failed:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to refresh cache',
        details: error.message
      });
    }
  }
  
  async getSystemInfo(req, res) {
    try {
      // Collect basic system information
      const systemInfo = {
        platform: os.platform(),
        arch: os.arch(),
        nodejs: process.version,
        uptime: Math.floor(os.uptime()),
        memory: {
          total: Math.round(os.totalmem() / (1024 * 1024)),
          free: Math.round(os.freemem() / (1024 * 1024)),
          usage: Math.round((1 - os.freemem() / os.totalmem()) * 100)
        },
        cpu: {
          cores: os.cpus().length,
          model: os.cpus()[0].model
        },
        env: process.env.NODE_ENV || 'development'
      };
      
      return res.status(200).json({
        success: true,
        data: systemInfo
      });
    } catch (error) {
      console.error('Error retrieving system info:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve system information',
        details: error.message
      });
    }
  }
}

export default UtilityController;
