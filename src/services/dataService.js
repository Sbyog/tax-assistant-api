import admin from 'firebase-admin';

/**
 * Get configuration data from Firestore
 */
const getConfigData = async (configName) => {
  try {
    const configDoc = await admin.firestore()
      .collection('config')
      .doc(configName)
      .get();

    if (!configDoc.exists) {
      return { success: false, error: `Config '${configName}' not found` };
    }

    const data = configDoc.data();
    return { success: true, data };
  } catch (error) {
    console.error(`Error fetching config '${configName}':`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Create a new item in the specified collection
 */
const createItem = async (collection, data) => {
  try {
    const db = admin.firestore();
    const docRef = await db.collection(collection).add({
      ...data,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return { 
      success: true, 
      data: { 
        id: docRef.id,
        ...data
      }
    };
  } catch (error) {
    console.error(`Error creating item in ${collection}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Get items from a collection with optional filtering
 */
const getItems = async (collection, filters = {}, limit = 50, orderBy = 'createdAt', direction = 'desc') => {
  try {
    const db = admin.firestore();
    let query = db.collection(collection);
    
    // Apply filters if provided
    Object.entries(filters).forEach(([field, value]) => {
      if (value !== undefined && value !== null) {
        query = query.where(field, '==', value);
      }
    });
    
    // Apply sorting
    query = query.orderBy(orderBy, direction);
    
    // Apply limit
    if (limit > 0) {
      query = query.limit(limit);
    }
    
    const snapshot = await query.get();
    const items = [];
    
    snapshot.forEach(doc => {
      items.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return { success: true, data: items };
  } catch (error) {
    console.error(`Error fetching items from ${collection}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Update an item in a collection
 */
const updateItem = async (collection, id, data) => {
  try {
    const db = admin.firestore();
    const docRef = db.collection(collection).doc(id);
    
    // Check if document exists
    const doc = await docRef.get();
    if (!doc.exists) {
      return { success: false, error: 'Item not found' };
    }
    
    // Update the document
    await docRef.update({
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return { success: true, data: { id, ...data } };
  } catch (error) {
    console.error(`Error updating item ${id} in ${collection}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete an item from a collection
 */
const deleteItem = async (collection, id) => {
  try {
    const db = admin.firestore();
    const docRef = db.collection(collection).doc(id);
    
    // Check if document exists
    const doc = await docRef.get();
    if (!doc.exists) {
      return { success: false, error: 'Item not found' };
    }
    
    // Delete the document
    await docRef.delete();
    
    return { success: true, data: { id } };
  } catch (error) {
    console.error(`Error deleting item ${id} from ${collection}:`, error);
    return { success: false, error: error.message };
  }
};

export { 
  getConfigData,
  createItem,
  getItems,
  updateItem,
  deleteItem
};
