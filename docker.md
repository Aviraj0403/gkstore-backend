Dockerizing the MERN Stack Project
1. Dockerfile for Node.js (Backend)

Inside your backend folder, create a Dockerfile:

# Use official Node.js image as the base image
FROM node:18

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all other files
COPY . .

# Expose port (replace with the port your app uses)
EXPOSE 4000

# Command to run your application
CMD ["npm", "start"]

2. Dockerfile for React (Frontend)

Inside your frontend folder, create a Dockerfile:

# Use official Node.js image as the base image
FROM node:16 AS build

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all other files
COPY . .

# Build the React app
RUN npm run build

# Serve the React app using a simple server
FROM nginx:alpine

# Copy the React app build files into nginx
COPY --from=build /app/build /usr/share/nginx/html

# Expose port
EXPOSE 80

3. Docker Compose for Managing Both Containers

In the root of your project, create a docker-compose.yml file:

version: '3'

services:
  backend:
    build:
      context: ./backend
    ports:
      - "4000:4000"
    depends_on:
      - mongo
    environment:
      - MONGO_URI=mongodb://mongo:27017/your_db_name

  frontend:
    build:
      context: ./frontend
    ports:
      - "80:80"

  mongo:
    image: mongo:latest
    volumes:
      - ./data/db:/data/db
    ports:
      - "27017:27017"

4. Build and Run with Docker Compose

To build and start the containers, run the following command:

docker-compose up --build


This will start all services: the backend (Node.js), frontend (React), and MongoDB.

Final Thoughts

CI/CD Pipeline:

The GitHub Actions workflow helps automate testing and deployment of your MERN stack project to your VPS using SSH.

Docker:

Dockerizing the project ensures consistent environments across development, testing, and production.

Deployment:

This setup allows you to deploy both frontend and backend on your Hostinger VPS and scale them with Docker.

You can automate this entire process using GitHub Actions to push changes to your VPS, ensuring your code is always up to date.