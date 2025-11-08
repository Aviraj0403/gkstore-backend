CI/CD with GitHub Actions for MERN Stack Project
1. Setup GitHub Actions Workflow for CI/CD

Create a .github/workflows/main.yml file inside your GitHub repository with the following content:


name: CI/CD Pipeline

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - name: Checkout code
      uses: actions/checkout@v2

    - name: Set up Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '16'

    - name: Install Dependencies
      run: npm install

    - name: Run Tests
      run: npm test

    - name: Build Backend
      run: npm run build  # Adjust if you have a build step for backend

    - name: Build Frontend
      run: |
        cd frontend
        npm install
        npm run build  # Adjust if needed for your React frontend

    - name: Deploy to VPS (Hostinger)
      env:
        SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
        VPS_IP: ${{ secrets.VPS_IP }}
      run: |
        echo "$SSH_PRIVATE_KEY" > private_key.pem
        chmod 600 private_key.pem
        ssh -o StrictHostKeyChecking=no -i private_key.pem root@$VPS_IP <<EOF
          cd /var/www/your-repo/backend
          git pull origin main
          npm install
          pm2 restart server.js
          
          cd /var/www/your-repo/frontend
          git pull origin main
          npm install
          npm run build
          # Optional: Restart any frontend server if running in production (e.g., using pm2 or nginx)
        EOF


2. Add SSH Key to GitHub Secrets

For GitHub Actions to SSH into your VPS, you need to:

Generate an SSH key pair:

ssh-keygen -t rsa -b 4096 -C "your_email@example.com"


Copy the private key (id_rsa) and add it to GitHub Secrets as SSH_PRIVATE_KEY.

Add your VPS IP address to the repository secrets as VPS_IP.


3. Final Checklist

Before running the CI/CD pipeline, make sure of the following:

GitHub Actions Workflow:
Ensure that the .github/workflows/main.yml file is created with the correct configuration.

Secrets Setup:
Make sure that SSH_PRIVATE_KEY and VPS_IP are properly added to your repository's secrets.

VPS Setup:
Ensure your VPS allows SSH access with the private key, and that your backend and frontend servers are properly set up (e.g., using pm2 for backend, and serving frontend with a process manager like pm2 or nginx).

-----------------------------------------------------
4. Useful Resources

GitHub Actions Documentation

How to Add SSH Keys to GitHub

PM2 Documentation