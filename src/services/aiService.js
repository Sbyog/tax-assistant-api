import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { getConfigData } from './dataService.js';
import OpenAI from 'openai';

// --- Configuration ---
const AI_API_KEY = process.env.AI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // New
const OPENAI_ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID; // New
const AI_MODEL_NAME = process.env.AI_MODEL_NAME || "gemini-1.5-flash-latest";

// if (!AI_API_KEY) {
//   console.error("Error: AI_API_KEY environment variable is not set.");
// }
if (!OPENAI_API_KEY) { // New
  console.error("Error: OPENAI_API_KEY environment variable is not set."); // New
}
if (!OPENAI_ASSISTANT_ID) { // New
  console.error("Error: OPENAI_ASSISTANT_ID environment variable is not set."); // New
}

const genAI = new GoogleGenerativeAI(AI_API_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY }); // New

// Default safety settings - adjust as needed
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// --- Prompt Templates ---
// These would be stored in Firestore in a real application
const PROMPT_TEMPLATES = {
  classify: `
You are tasked with classifying content based on its attributes into one of the following categories:
{categories}
I will provide you with content, and you must assign it to one of the categories from the list.
Respond only with the category name, nothing else.
Content to classify: {content}
`,
  extract_entities: `
Extract the key entities from the following content.
Focus only on important entities like locations, organizations, people, products, etc.
Return only a JSON array of entities, with no additional text.
Example: ["entity1", "entity2", "entity3"]
Content: {content}
`,
  summarize: `
Summarize the following content in a concise way.
Keep only the most important information.
Content: {content}
`
};

// --- Helper Function for AI Model Call ---
async function callAIModel(prompt, generationConfig, isJson = false) {
  if (!AI_API_KEY) {
    console.error("AI API Key not configured. Cannot call AI model.");
    return null;
  }
  
  try {
    const modelConfig = {
      model: AI_MODEL_NAME,
      generationConfig,
      safetySettings,
    };
    
    // Add responseMimeType if JSON output is expected
    if (isJson) {
      modelConfig.generationConfig.responseMimeType = "application/json";
    }

    const model = genAI.getGenerativeModel(modelConfig);
    const result = await model.generateContent(prompt);
    const response = await result.response;

    // Basic check for blocked content
    if (!response || !response.candidates || response.candidates.length === 0 || !response.candidates[0].content) {
      console.warn('AI response was blocked or empty. Finish Reason:', response?.candidates?.[0]?.finishReason);
      console.warn('Prompt Safety Ratings:', response?.promptFeedback?.safetyRatings);
      return null;
    }

    return response.text();
  } catch (error) {
    console.error(`Error calling AI model (${AI_MODEL_NAME}):`, error);
    return null;
  }
}

// --- OpenAI Assistant Interaction ---
/**
 * Interacts with the OpenAI assistant.
 * @param {string} userInput The user's message to the assistant.
 * @param {string} threadId Optional thread ID for continuing a conversation.
 * @returns {Promise<{threadId: string, messages: Array<object>}|null>} The thread ID and assistant's messages or null on error.
 */
const interactWithAssistant = async (userInput, threadId = null) => {
  if (!OPENAI_API_KEY || !OPENAI_ASSISTANT_ID) {
    console.error("OpenAI API Key or Assistant ID not configured.");
    return null;
  }

  try {
    // Create a new thread if no threadId is provided
    if (!threadId) {
      const thread = await openai.beta.threads.create();
      threadId = thread.id;
    }

    // Add user's message to the thread
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: userInput,
    });

    // Run the assistant on the thread
    let run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: OPENAI_ASSISTANT_ID,
    });

    // Poll for the run to complete
    while (run.status === "queued" || run.status === "in_progress") {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 1 second
      run = await openai.beta.threads.runs.retrieve(threadId, run.id);
    }

    if (run.status === "completed") {
      const messages = await openai.beta.threads.messages.list(threadId);
      // Filter for assistant messages and return them
      const assistantMessages = messages.data
        .filter(msg => msg.role === 'assistant')
        .map(msg => msg.content.map(contentItem => contentItem.text.value).join('\n')) // Extract text from content array
        .reverse(); // Chronological order

      return { threadId, messages: assistantMessages };
    } else {
      console.error(`OpenAI run failed with status: ${run.status}`);
      console.error('Run details:', run);
      if (run.last_error) {
        console.error('Last error:', run.last_error.message);
      }
      return null;
    }
  } catch (error) {
    console.error("Error interacting with OpenAI Assistant:", error);
    return null;
  }
}

/**
 * Lists messages for a given OpenAI thread.
 * @param {string} threadId The ID of the thread.
 * @param {object} [options] Pagination options.
 * @param {number} [options.limit=20] Number of messages to retrieve.
 * @param {string} [options.order='desc'] Order of messages ('asc' or 'desc'). 'desc' is latest first.
 * @param {string} [options.after] A cursor for pagination (message ID to fetch messages after).
 * @param {string} [options.before] A cursor for pagination (message ID to fetch messages before).
 * @returns {Promise<{messages: Array<object>, hasMore: boolean, firstIdInBatch: string, lastIdInBatch: string}>} Formatted messages and pagination info.
 */
async function listThreadMessages(threadId, { limit = 20, order = 'desc', after = undefined, before = undefined } = {}) {
  if (!OPENAI_API_KEY) {
    console.error("OpenAI API Key not configured.");
    // Throw an error that can be caught and handled by the calling service/controller
    const error = new Error("OpenAI API Key not configured.");
    error.status = 500; // Internal Server Error or a specific configuration error code
    throw error;
  }
  try {
    const apiResponse = await openai.beta.threads.messages.list(threadId, {
      limit,
      order, // 'asc' (oldest first) or 'desc' (latest first)
      after,
      before,
    });

    const formattedMessages = apiResponse.data.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content
        .filter(contentItem => contentItem.type === 'text')
        .map(contentItem => contentItem.text.value)
        .join('\n'), // Join if there are multiple text content blocks, though rare
      createdAt: new Date(msg.created_at * 1000).toISOString(),
      // Future enhancements could include handling other content types like images
      // attachments: msg.attachments, // Example: if you store/handle attachments
      // metadata: msg.metadata,
    }));

    // If OpenAI's order was 'desc' (latest first), reverse to make it chronological (oldest first) for typical display.
    // If order was 'asc', it's already chronological.
    const chronologicalMessages = (order === 'desc') ? formattedMessages.reverse() : formattedMessages;

    return {
      messages: chronologicalMessages,
      hasMore: apiResponse.has_more,
      firstIdInBatch: apiResponse.first_id, // ID of the first message in OpenAI's returned list
      lastIdInBatch: apiResponse.last_id,   // ID of the last message in OpenAI's returned list
    };
  } catch (error) {
    console.error(`Error listing thread messages from OpenAI (thread ID: ${threadId}):`, error);
    // Re-throw the error to be handled by the caller, potentially with more context
    const serviceError = new Error(`Failed to retrieve messages from OpenAI: ${error.message}`);
    // serviceError.status = error.status || 500; // Preserve status if OpenAI error has one
    throw serviceError;
  }
}

// --- OpenAI Speech-to-Text (Whisper) ---
/**
 * Transcribes audio using OpenAI's Whisper model.
 * @param {Buffer} audioFileBuffer The audio file data as a Buffer.
 * @param {string} [language] Optional ISO-639-1 language code (e.g., 'en', 'es').
 * @returns {Promise<string|null>} The transcribed text or null on error.
 */
const transcribeAudio = async (audioFileBuffer, language = null) => {
  if (!OPENAI_API_KEY) {
    console.error("OpenAI API Key not configured for transcription.");
    return null;
  }
  if (!audioFileBuffer || audioFileBuffer.length === 0) {
    console.error("Audio file buffer is empty or not provided.");
    return null;
  }

  try {
    // Convert the buffer to a FileLike object that the SDK can use.
    // The filename extension (e.g., .webm, .mp3, .wav) is important for Whisper 
    // to correctly interpret the audio format.
    // Ensure this matches the format sent by the frontend.
    const audioFileForUpload = await OpenAI.toFile(audioFileBuffer, 'audio.webm');

    const response = await openai.audio.transcriptions.create({
      file: audioFileForUpload, // Use the FileLike object from OpenAI.toFile
      model: "whisper-1",
      language: language || undefined, // Pass language if provided, else undefined
    });

    return response.text;
  } catch (error) {
    console.error("Error transcribing audio with OpenAI Whisper:", error);
    // Log more detailed error information if available
    if (error.response && error.response.data) {
      console.error("OpenAI API Error details:", error.response.data);
    } else if (error.error) { // Sometimes the error object itself contains details
      console.error("OpenAI API Error details (from error.error):", error.error);
    }
    return null;
  }
};

// --- Generic AI Functions ---
/**
 * Classify content into predefined categories
 */
const classifyContent = async (content, categoryType = 'default') => {
  try {
    // Get categories from configuration
    const configResult = await getConfigData('categories');
    if (!configResult.success) {
      console.error('Error fetching categories config:', configResult.error);
      return '';
    }

    const categoriesConfig = configResult.data;
    const categories = categoriesConfig[categoryType] || [];
    
    if (categories.length === 0) {
      console.error(`No categories found for type: ${categoryType}`);
      return '';
    }

    // Build the prompt
    const categoriesText = categories.map((cat, index) => `${index + 1}. ${cat}`).join('\n');
    const prompt = PROMPT_TEMPLATES.classify
      .replace('{categories}', categoriesText)
      .replace('{content}', content);

    // AI model parameters
    const generationConfig = {
      temperature: 0.3,
      maxOutputTokens: 50,
    };

    // Call the AI model
    const result = await callAIModel(prompt, generationConfig);

    if (result === null) {
      console.error("AI classification failed or returned null.");
      return "Other"; // Default fallback category
    }

    const classification = result.trim();
    
    // Validate the result is in our categories list
    if (categories.includes(classification)) {
      return classification;
    } else {
      console.warn(`Classification "${classification}" not found in valid categories. Using "Other" instead.`);
      return "Other";
    }
  } catch (error) {
    console.error('Error during content classification:', error);
    return '';
  }
};

/**
 * Extract entities from content
 */
const extractEntities = async (content) => {
  try {
    const prompt = PROMPT_TEMPLATES.extract_entities.replace('{content}', content);
    
    const generationConfig = {
      temperature: 0.2,
      maxOutputTokens: 150,
    };

    // Call the AI model expecting JSON
    const jsonResponse = await callAIModel(prompt, generationConfig, true);

    if (jsonResponse === null) {
      console.error("AI entity extraction failed or returned null.");
      return [];
    }

    try {
      // Parse the JSON response
      const entities = JSON.parse(jsonResponse);
      
      // Validate it's an array of strings
      if (Array.isArray(entities) && entities.every(item => typeof item === 'string')) {
        return entities;
      } else {
        console.error("AI response is not a valid JSON array of strings:", entities);
        return [];
      }
    } catch (parseError) {
      console.error("Failed to parse JSON response from AI:", parseError);
      console.error("Raw AI Response:", jsonResponse);
      return [];
    }
  } catch (error) {
    console.error('Error extracting entities:', error);
    return [];
  }
};

/**
 * Generate a summary of content
 */
const generateSummary = async (content, maxLength = 200) => {
  try {
    const prompt = PROMPT_TEMPLATES.summarize.replace('{content}', content);
    
    const generationConfig = {
      temperature: 0.4,
      maxOutputTokens: Math.min(maxLength * 2, 500), // Give some room but cap it
    };

    // Call the AI model
    const summaryResponse = await callAIModel(prompt, generationConfig);

    if (summaryResponse === null) {
      console.error("AI summarization failed or returned null.");
      return "";
    }

    // Trim and limit the summary length
    let summary = summaryResponse.trim();
    if (summary.length > maxLength) {
      summary = summary.substring(0, maxLength).trim() + '...';
    }
    
    return summary;
  } catch (error) {
    console.error('Error generating summary:', error);
    return "";
  }
};

export { 
  classifyContent, 
  extractEntities, 
  generateSummary, 
  interactWithAssistant,
  listThreadMessages,
  transcribeAudio // <-- Add new function to exports
};