# Node.js Backend API Template

This project is a comprehensive Node.js backend API template with Firebase integration, authentication, data management, and AI capabilities. It provides a solid foundation for building modern web applications with a robust backend structure.

## Features

- **Firebase Integration**
  - Firestore database operations
  - Firebase Authentication
  - Multiple configuration options (service account, environment variables, default credentials)

- **Authentication System**
  - Token verification
  - Role-based access control
  - Middleware for protecting routes

- **Data Management**
  - CRUD operations for Firestore collections
  - Configurable filtering and sorting
  - Data validation

- **AI Capabilities**
  - Content classification
  - Entity extraction
  - Text summarization
  - Integration with Google's Generative AI

- **Utility Functions**
  - System health checks
  - Cache management
  - System information

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm (Node package manager)
- Firebase account and project
- Google Cloud Generative AI API key (for AI features)

### Installation

1. Clone the repository:

   ```
   git clone https://github.com/yourusername/nodejs-backend-template.git
   ```

2. Navigate to the project directory:

   ```
   cd nodejs-backend-template
   ```

3. Install the dependencies:

   ```
   npm install
   ```

4. Create a `.env` file from the example:

   ```
   cp .env.example .env
   ```

5. Configure the environment variables in the `.env` file.

### Configuration

This template supports multiple Firebase configuration methods:

1. **Service Account File** (development)
   - Set `FIREBASE_SERVICE_ACCOUNT_PATH` in .env

2. **Environment Variables** (production)
   - Set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`

3. **Default Credentials** (cloud environments)
   - No configuration needed if running on Google Cloud with appropriate permissions

For AI features, set:
- `AI_API_KEY` - Your Google Generative AI API key
- `AI_MODEL_NAME` - Model to use (defaults to "gemini-1.5-flash-latest")

### Running the Application

To start the server, run:

```
npm start
```

For development with automatic reloading, use:

```
npm run dev
```

## API Endpoints

All endpoints use POST requests (regardless of operation type) with JSON payloads.

### Authentication Routes (`/api/auth`)

- `/api/auth/verify-token` - Verify a Firebase token
- `/api/auth/check-permissions` - Check if a user has specific permissions
- `/api/auth/user-info` - Get information about the current user

### Data Routes (`/api/data`)

- `/api/data/get-items` - Get multiple items with optional filtering
- `/api/data/get-item` - Get a single item by ID
- `/api/data/create-item` - Create a new item (requires authentication)
- `/api/data/update-item` - Update an existing item (requires authentication)
- `/api/data/delete-item` - Delete an item (requires admin role)
- `/api/data/get-config` - Get configuration data

### AI Routes (`/api/ai`)

- `/api/ai/classify` - Classify content into categories
- `/api/ai/extract-entities` - Extract entities from content
- `/api/ai/generate-summary` - Generate a summary of content

### Utility Routes (`/api/utility`)

- `/api/utility/health-check` - Check system health
- `/api/utility/refresh-cache` - Refresh cache (admin only)
- `/api/utility/system-info` - Get system information (admin only)

## Project Structure

```
nodejs-backend/
├── src/                    # Source code
│   ├── config/             # Configuration files
│   ├── controllers/        # Request handlers
│   ├── routes/             # API routes
│   ├── services/           # Business logic
│   └── app.js              # Express app setup
├── .env                    # Environment variables
└── server.js               # Entry point
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for details.