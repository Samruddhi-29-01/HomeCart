# Use the official Node.js 20 Alpine image for smaller size
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install curl for container health checks
RUN apk add --no-cache curl

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Expose the port the app runs on
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/ || exit 1

# Start the application
CMD ["npm", "start"]