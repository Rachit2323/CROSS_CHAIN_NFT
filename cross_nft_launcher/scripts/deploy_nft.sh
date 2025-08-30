#!/bin/bash

# Cross NFT Launcher Deployment Script
echo "🚀 Starting Cross NFT Launcher deployment..."

# Stop any existing dfx processes
echo "🛑 Stopping any existing dfx processes..."
dfx stop 2>/dev/null || true

# Start the Internet Computer local replica
echo "📡 Starting local IC replica..."
dfx start --background --clean

# Wait for the replica to be ready
echo "⏳ Waiting for replica to be ready..."
sleep 5

# Get the current principal to use as the minting account
PRINCIPAL=$(dfx identity get-principal)
echo "👤 Deployer Principal: $PRINCIPAL"

# Build the project
echo "🔨 Building the project..."
dfx build

# Deploy the backend canister with proper initialization
echo "🎯 Deploying backend canister..."
dfx deploy cross_nft_launcher_backend

if [ $? -eq 0 ]; then
    echo "✅ Backend deployed successfully!"
    echo "🔧 Setting up minting account..."
    dfx canister call cross_nft_launcher_backend set_minting_account_manual "(\"$PRINCIPAL\")"
else
    echo "❌ Backend deployment failed!"
    exit 1
fi

# Deploy the frontend canister
echo "🎨 Deploying frontend canister..."
dfx deploy cross_nft_launcher_frontend

if [ $? -ne 0 ]; then
    echo "❌ Frontend deployment failed!"
    exit 1
fi

echo "✅ Deployment successful!"

# Test basic functionality
echo "🧪 Testing basic functionality..."

echo "📋 Collection Information:"
dfx canister call cross_nft_launcher_backend icrc7_name
dfx canister call cross_nft_launcher_backend icrc7_symbol
dfx canister call cross_nft_launcher_backend icrc7_description
dfx canister call cross_nft_launcher_backend icrc7_total_supply
dfx canister call cross_nft_launcher_backend icrc7_supply_cap

echo "🎭 Minting test NFTs..."

# Mint first NFT
echo "🎨 Minting NFT #1..."
dfx canister call cross_nft_launcher_backend icrc7_mint "(
  vec {
    record {
      to = record { owner = principal \"$PRINCIPAL\"; subaccount = null };
      token_id = 1 : nat;
      metadata = vec {
        record { \"name\"; variant { Text = \"Genesis NFT\" } };
        record { \"description\"; variant { Text = \"The first NFT in the Cross NFT Collection\" } };
        record { \"image\"; variant { Text = \"https://example.com/nft1.png\" } };
        record { \"attributes\"; variant { Text = \"[{\\\"trait_type\\\": \\\"Rarity\\\", \\\"value\\\": \\\"Legendary\\\"}]\" } };
      };
      memo = null;
      created_at_time = null;
    }
  }
)"

# Mint second NFT
echo "🎨 Minting NFT #2..."
dfx canister call cross_nft_launcher_backend icrc7_mint "(
  vec {
    record {
      to = record { owner = principal \"$PRINCIPAL\"; subaccount = null };
      token_id = 2 : nat;
      metadata = vec {
        record { \"name\"; variant { Text = \"Alpha NFT\" } };
        record { \"description\"; variant { Text = \"The second NFT in the Cross NFT Collection\" } };
        record { \"image\"; variant { Text = \"https://example.com/nft2.png\" } };
        record { \"attributes\"; variant { Text = \"[{\\\"trait_type\\\": \\\"Rarity\\\", \\\"value\\\": \\\"Rare\\\"}]\" } };
      };
      memo = null;
      created_at_time = null;
    }
  }
)"

echo "✅ NFT minting completed!"

# Check collection status
echo "📊 Updated Collection Status:"
dfx canister call cross_nft_launcher_backend icrc7_total_supply

# Check user balance
echo "💰 Your NFT Balance:"
dfx canister call cross_nft_launcher_backend icrc7_balance_of "(
  vec { record { owner = principal \"$PRINCIPAL\"; subaccount = null } }
)"

# List tokens owned by user
echo "🎯 Your NFT Token IDs:"
dfx canister call cross_nft_launcher_backend icrc7_tokens_of "(
  record { owner = principal \"$PRINCIPAL\"; subaccount = null },
  null,
  null
)"

# Get token metadata
echo "🎨 Token Metadata:"
dfx canister call cross_nft_launcher_backend icrc7_token_metadata "(vec { 1 : nat; 2 : nat })"

echo ""
echo "🎉 Deployment and testing completed successfully!"
echo "🌐 Frontend URL: http://$(dfx canister id cross_nft_launcher_frontend).localhost:4943"
echo "🔗 Backend Canister ID: $(dfx canister id cross_nft_launcher_backend)"
echo "🔗 Frontend Canister ID: $(dfx canister id cross_nft_launcher_frontend)"

echo ""
echo "📚 You can now:"
echo "  • View your NFT collection in the frontend"
echo "  • Test transfer functionality"
echo "  • Test approval mechanisms (use test_approvals.sh)"
echo "  • Explore the ICRC-7 and ICRC-37 API"
echo ""
echo "🔧 Available commands to test:"
echo "  dfx canister call cross_nft_launcher_backend icrc7_name"
echo "  dfx canister call cross_nft_launcher_backend icrc7_total_supply"
echo "  dfx canister call cross_nft_launcher_backend icrc7_tokens '(null, opt 10)'" 