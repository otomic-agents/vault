# Stage 1: Build the application
FROM node:18 AS builder

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and yarn.lock to the working directory
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy the necessary application code to the working directory
COPY src ./src
COPY tsconfig.json ./

# Build the TypeScript code
RUN yarn build

# Stage 2: Create the final image
FROM node:18-slim

# Set the working directory inside the container
WORKDIR /app

# Copy only the necessary files from the builder stage
COPY --from=builder /app/package.json /app/yarn.lock ./
COPY --from=builder /app/dist ./dist

# Install only production dependencies
RUN yarn install --production --frozen-lockfile

# Define the entrypoint to allow passing different commands
ENTRYPOINT ["yarn"]