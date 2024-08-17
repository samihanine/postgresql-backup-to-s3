# Build Stage
FROM alpine:latest AS build

WORKDIR /root

# Install Node.js, npm and PostgreSQL client
RUN apk add --update --no-cache nodejs npm

# Copy package files and install all dependencies including devDependencies
COPY package*.json ./
RUN npm install

# Copy application code
COPY ./ /root

# Compile TypeScript to JavaScript
RUN npm run build

# Prune devDependencies
RUN npm prune --production

# Final Stage
FROM alpine:latest

WORKDIR /root

# Copy only necessary node_modules from the build stage
COPY --from=build /root/node_modules ./node_modules

# Copy compiled JavaScript files from build stage
COPY --from=build /root/dist ./dist

# Install MySQL and MongoDB clients, and necessary runtime libraries
RUN apk add --update --no-cache postgresql-client nodejs npm

# Set the entry point to the compiled JavaScript file
ENTRYPOINT ["node", "dist/index.js"]
