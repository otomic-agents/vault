# Use the official Node.js image as the base image
FROM node:18-slim

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and yarn.lock to the working directory
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn

# Copy the necessary application code to the working directory
COPY src ./src
COPY tsconfig.json ./

RUN yarn global add ts-node

# Build the TypeScript code
RUN yarn build

# Define the entrypoint to allow passing different commands
ENTRYPOINT ["yarn"]