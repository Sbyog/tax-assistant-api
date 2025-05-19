# Use the official Node.js 18 image as a parent image
FROM node:18-slim

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy the rest of the application code
COPY . ./

# Make port 8080 available (Cloud Run injects the PORT environment variable)
EXPOSE 8080

# Define the command to run the app
CMD [ "node", "server.js" ]
