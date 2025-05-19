import { classifyContent, extractEntities, generateSummary, interactWithAssistant, transcribeAudio } from '../services/aiService.js';

class AIController {
  async classifyContent(req, res) {
    const { content, categoryType } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Content is required'
      });
    }

    try {
      const classification = await classifyContent(content, categoryType);

      return res.status(200).json({
        success: true,
        data: {
          classification
        }
      });
    } catch (error) {
      console.error('Error in classifyContent:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to classify content'
      });
    }
  }

  async extractEntities(req, res) {
    try {
      const { content } = req.body;
      if (!content) {
        return res.status(400).json({ success: false, error: 'Content is required' });
      }

      const entities = await extractEntities(content);
      res.json({ success: true, data: { entities } });

    } catch (error) {
      console.error('Error in extractEntities:', error);
      res.status(500).json({ success: false, error: 'Failed to extract entities' });
    }
  }

  async generateSummary(req, res) {
    try {
      const { content, maxLength } = req.body;
      if (!content) {
        return res.status(400).json({ success: false, error: 'Content is required' });
      }

      const summary = await generateSummary(content, maxLength);
      res.json({ success: true, data: { summary } });

    } catch (error) {
      console.error('Error in generateSummary:', error);
      res.status(500).json({ success: false, error: 'Failed to generate summary' });
    }
  }

  async handleAssistantInteraction(req, res) {
    const { userInput, threadId } = req.body;

    if (!userInput) {
      return res.status(400).json({
        success: false,
        error: 'userInput is required'
      });
    }

    try {
      const result = await interactWithAssistant(userInput, threadId);

      if (!result) {
        return res.status(500).json({
          success: false,
          error: 'Failed to interact with OpenAI Assistant'
        });
      }

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error in handleAssistantInteraction:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to interact with OpenAI Assistant'
      });
    }
  }

  async handleSpeechToText(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No audio file uploaded.'
        });
      }

      const audioFileBuffer = req.file.buffer;
      const { language } = req.body; // Optional: language hint from client

      const transcription = await transcribeAudio(audioFileBuffer, language);

      if (transcription === null) {
        return res.status(500).json({
          success: false,
          error: 'Failed to transcribe audio. Check server logs for details.'
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          text: transcription
        }
      });

    } catch (error) {
      console.error('Error in handleSpeechToText:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to process speech-to-text request'
      });
    }
  }
}

export default AIController;