#!/bin/bash
# start-prod.sh: Build React app and start backend for local production

set -e

# 1. Build the React app
npm run build

# 2. Start the backend server (serves API and frontend)
echo "\nStarting backend server on http://localhost:4000 ..."
node server.js 