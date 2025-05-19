import historyService from '../services/historyService.js';

class HistoryController {
    constructor(service) {
        this.historyService = service;
    }

    async saveConversation(req, res) {
        try {
            const userId = req.user.uid; // Extracted by 'protect' middleware
            const conversationData = req.body;
            const savedConversation = await this.historyService.saveConversation(userId, conversationData);
            res.status(201).json({ success: true, data: savedConversation, message: 'Conversation saved.' });
        } catch (error) {
            console.error('Error in HistoryController saveConversation:', error);
            res.status(500).json({ success: false, message: error.message || 'Failed to save conversation.' });
        }
    }

    async listConversations(req, res) {
        try {
            const userId = req.user.uid;
            const { page, limit, sortBy, sortOrder } = req.body; // Pagination options from POST body
            const result = await this.historyService.listConversations(userId, { page, limit, sortBy, sortOrder });
            res.status(200).json({ success: true, ...result });
        } catch (error) {
            console.error('Error in HistoryController listConversations:', error);
            res.status(500).json({ success: false, message: error.message || 'Failed to list conversations.' });
        }
    }

    async getConversationMessages(req, res) {
        try {
            const userId = req.user.uid;
            // Updated to expect OpenAI specific pagination params
            const { conversationId, limit, order, after, before } = req.body; 
            if (!conversationId) {
                return res.status(400).json({ success: false, message: 'Conversation ID is required.' });
            }
            // Pass the new pagination params to the service
            const result = await this.historyService.getConversationMessages(userId, conversationId, { limit, order, after, before });
            res.status(200).json({ success: true, ...result });
        } catch (error) {
            console.error('Error in HistoryController getConversationMessages:', error);
            // Check if the error has a status code (e.g., from aiService)
            if (error.status) {
                return res.status(error.status).json({ success: false, message: error.message });
            }
            res.status(500).json({ success: false, message: error.message || 'Failed to retrieve messages.' });
        }
    }

    async deleteConversation(req, res) {
        try {
            const userId = req.user.uid;
            const { conversationId } = req.body; // conversationId from POST body
            if (!conversationId) {
                return res.status(400).json({ success: false, message: 'Conversation ID is required.' });
            }
            await this.historyService.deleteConversation(userId, conversationId);
            res.status(200).json({ success: true, message: 'Conversation deleted successfully.' });
        } catch (error) {
            console.error('Error in HistoryController deleteConversation:', error);
            res.status(500).json({ success: false, message: error.message || 'Failed to delete conversation.' });
        }
    }
}

export default new HistoryController(historyService);
