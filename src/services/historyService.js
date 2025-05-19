import admin from 'firebase-admin';
import { listThreadMessages } from './aiService.js'; // <-- Import the new AI service function

const db = admin.firestore();
const HISTORY_COLLECTION = 'conversationHistory';

class HistoryService {
    /**
     * Saves a conversation to history.
     * @param {string} userId - The ID of the user.
     * @param {object} conversationData - Data for the conversation.
     * @returns {Promise<object>} The saved conversation summary.
     */
    async saveConversation(userId, conversationData) {
        try {
            const { threadId, title, firstMessagePreview, lastMessagePreview, modelUsed } = conversationData;
            if (!userId || !threadId || !title) {
                throw new Error('User ID, thread ID, and title are required to save conversation.');
            }

            const historyRef = db.collection(HISTORY_COLLECTION).doc();
            const newHistoryEntry = {
                userId,
                threadId,
                title,
                firstMessagePreview: firstMessagePreview || '',
                lastMessagePreview: lastMessagePreview || '',
                modelUsed: modelUsed || 'unknown',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            await historyRef.set(newHistoryEntry);
            return { id: historyRef.id, ...newHistoryEntry };
        } catch (error) {
            console.error('Error saving conversation to history:', error);
            throw error;
        }
    }

    /**
     * Retrieves a paginated list of conversations for a user.
     * @param {string} userId - The ID of the user.
     * @param {object} paginationOptions - Options for pagination (page, limit, sortBy, sortOrder).
     * @returns {Promise<object>} Paginated list of conversations.
     */
    async listConversations(userId, paginationOptions = {}) {
        try {
            const { page = 1, limit = 15, sortBy = 'updatedAt', sortOrder = 'desc' } = paginationOptions;
            if (!userId) {
                throw new Error('User ID is required to list conversations.');
            }

            let query = db.collection(HISTORY_COLLECTION)
                .where('userId', '==', userId)
                .orderBy(sortBy, sortOrder);

            const totalItemsSnapshot = await query.count().get();
            const totalItems = totalItemsSnapshot.data().count;
            const totalPages = Math.ceil(totalItems / limit);

            if (page > 0) {
                query = query.limit(limit).offset((page - 1) * limit);
            } else {
                 query = query.limit(limit); // For page 0 or invalid, just get first page
            }
            
            const snapshot = await query.get();
            const conversations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            return {
                data: conversations,
                pagination: {
                    currentPage: page,
                    limit,
                    totalPages,
                    totalItems,
                },
            };
        } catch (error) {
            console.error('Error listing conversations:', error);
            throw error;
        }
    }

    /**
     * Retrieves messages for a specific conversation.
     * Fetches actual conversation messages from OpenAI using the listThreadMessages function.
     * @param {string} userId - The ID of the user.
     * @param {string} conversationId - The ID of the conversation history record.
     * @param {object} paginationOptions - Options for pagination.
     * @returns {Promise<object>} Conversation messages.
     */
    async getConversationMessages(userId, conversationId, paginationOptions = {}) {
        try {
            const { limit, order, after, before } = paginationOptions; // OpenAI specific pagination params
            if (!userId || !conversationId) {
                throw new Error('User ID and Conversation ID are required.');
            }

            const historyDoc = await db.collection(HISTORY_COLLECTION).doc(conversationId).get();
            if (!historyDoc.exists || historyDoc.data().userId !== userId) {
                throw new Error('Conversation not found or access denied.');
            }
            
            const conversationData = historyDoc.data();
            const { threadId } = conversationData;

            if (!threadId) {
                throw new Error('Thread ID not found for this conversation.');
            }

            // Call the aiService to get messages from OpenAI
            const openAiMessagesData = await listThreadMessages(threadId, { limit, order, after, before });

            return {
                conversationId,
                threadId,
                messages: openAiMessagesData.messages, // Messages from OpenAI
                pagination: { // Pagination info from OpenAI
                    hasMore: openAiMessagesData.hasMore,
                    firstIdInBatch: openAiMessagesData.firstIdInBatch,
                    lastIdInBatch: openAiMessagesData.lastIdInBatch,
                    // You might want to include the cursors for next/prev page requests
                    nextPageAfter: openAiMessagesData.hasMore ? openAiMessagesData.lastIdInBatch : undefined,
                    // Note: OpenAI's `before` and `after` are for message IDs, not page numbers
                }
            };
        } catch (error) {
            console.error('Error getting conversation messages in HistoryService:', error);
            // If the error came from aiService with a status, preserve it
            if (error.status) {
                const serviceError = new Error(error.message);
                serviceError.status = error.status;
                throw serviceError;
            }
            throw error; // Re-throw other errors
        }
    }

    /**
     * Deletes a conversation from history.
     * @param {string} userId - The ID of the user.
     * @param {string} conversationId - The ID of the conversation to delete.
     * @returns {Promise<void>}
     */
    async deleteConversation(userId, conversationId) {
        try {
            if (!userId || !conversationId) {
                throw new Error('User ID and Conversation ID are required for deletion.');
            }
            const docRef = db.collection(HISTORY_COLLECTION).doc(conversationId);
            const doc = await docRef.get();

            if (!doc.exists) {
                throw new Error('Conversation not found.');
            }

            if (doc.data().userId !== userId) {
                throw new Error('User not authorized to delete this conversation.');
            }

            await docRef.delete();
        } catch (error) {
            console.error('Error deleting conversation:', error);
            throw error;
        }
    }
}

export default new HistoryService();