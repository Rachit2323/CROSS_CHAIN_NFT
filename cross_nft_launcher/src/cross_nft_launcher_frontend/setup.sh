#!/bin/bash

echo "🚀 Setting up NFT Marketplace React Frontend..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v16 or higher."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully!"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
# React App Environment Variables
REACT_APP_DEFAULT_NETWORK=sepolia
# Add your Infura project ID if needed
# REACT_APP_INFURA_PROJECT_ID=your_infura_project_id
EOF
    echo "✅ .env file created"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update contract addresses in src/config/contract.js"
echo "2. Ensure MetaMask is installed and connected to Sepolia/Holesky"
echo "3. Run 'npm start' to start the development server"
echo "4. Open http://localhost:3000 in your browser"
echo ""
echo "Happy minting! 🪙" 