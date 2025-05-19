import { 
  getConfigData, 
  createItem, 
  getItems as fetchItems, 
  updateItem as updateItemService, 
  deleteItem as deleteItemService 
} from '../services/dataService.js';
import admin from 'firebase-admin';

class DataController {
  // Get multiple items with filters
  async getItems(req, res) {
    try {
      const { collection, filters, limit, orderBy, direction } = req.body;
      
      if (!collection) {
        return res.status(400).json({
          success: false,
          error: 'Collection name is required'
        });
      }
      
      const result = await fetchItems(collection, filters, limit, orderBy, direction);
      
      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(500).json(result);
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || 'Error retrieving items'
      });
    }
  }
  
  // Get a single item by ID
  async getItem(req, res) {
    try {
      const { collection, id } = req.body;
      
      if (!collection || !id) {
        return res.status(400).json({
          success: false,
          error: 'Collection name and item ID are required'
        });
      }
      
      const doc = await admin.firestore()
        .collection(collection)
        .doc(id)
        .get();
      
      if (!doc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Item not found'
        });
      }
      
      return res.status(200).json({
        success: true,
        data: {
          id: doc.id,
          ...doc.data()
        }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || 'Error retrieving item'
      });
    }
  }
  
  // Create a new item
  async createItem(req, res) {
    try {
      const { collection, data } = req.body;
      
      if (!collection || !data) {
        return res.status(400).json({
          success: false,
          error: 'Collection name and item data are required'
        });
      }
      
      // Add user info from auth middleware if available
      const userId = req.user?.uid;
      const itemData = {
        ...data,
        createdBy: userId || 'anonymous'
      };
      
      const result = await createItem(collection, itemData);
      
      if (result.success) {
        return res.status(201).json(result);
      } else {
        return res.status(500).json(result);
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || 'Error creating item'
      });
    }
  }
  
  // Update an existing item
  async updateItem(req, res) {
    try {
      const { collection, id, data } = req.body;
      
      if (!collection || !id || !data) {
        return res.status(400).json({
          success: false,
          error: 'Collection name, item ID, and update data are required'
        });
      }
      
      // Add user info from auth middleware
      const userId = req.user?.uid;
      const updateData = {
        ...data,
        updatedBy: userId || 'anonymous'
      };
      
      const result = await updateItemService(collection, id, updateData);
      
      if (result.success) {
        return res.status(200).json(result);
      } else if (result.error === 'Item not found') {
        return res.status(404).json(result);
      } else {
        return res.status(500).json(result);
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || 'Error updating item'
      });
    }
  }
  
  // Delete an item
  async deleteItem(req, res) {
    try {
      const { collection, id } = req.body;
      
      if (!collection || !id) {
        return res.status(400).json({
          success: false,
          error: 'Collection name and item ID are required'
        });
      }
      
      const result = await deleteItemService(collection, id);
      
      if (result.success) {
        return res.status(200).json(result);
      } else if (result.error === 'Item not found') {
        return res.status(404).json(result);
      } else {
        return res.status(500).json(result);
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || 'Error deleting item'
      });
    }
  }
  
  // Get configuration data
  async getConfig(req, res) {
    try {
      const { configName } = req.body;
      
      if (!configName) {
        return res.status(400).json({
          success: false,
          error: 'Config name is required'
        });
      }
      
      const result = await getConfigData(configName);
      
      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(404).json(result);
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || 'Error retrieving configuration'
      });
    }
  }
}

export default DataController;
