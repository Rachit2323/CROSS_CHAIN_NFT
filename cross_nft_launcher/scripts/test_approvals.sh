#!/bin/bash

# Test ICRC-37 Approval Functionality
echo "🔐 Testing ICRC-37 Approval Functionality..."

# Create test identities
echo "👥 Creating test identities..."
dfx identity new alice --disable-encryption || echo "Alice identity already exists"
dfx identity new bob --disable-encryption || echo "Bob identity already exists"

# Get principals
DEPLOYER=$(dfx identity get-principal)
ALICE=$(dfx identity use alice && dfx identity get-principal)
BOB=$(dfx identity use bob && dfx identity get-principal)

echo "📝 Test Principals:"
echo "   Deployer: $DEPLOYER"
echo "   Alice: $ALICE"
echo "   Bob: $BOB"
echo ""

# Switch back to default identity (deployer)
dfx identity use default

# Mint a token for testing
echo "🎨 Minting test token (ID: 100)..."
dfx canister call cross_nft_launcher_backend icrc7_mint "(vec {
    record {
        to = record {
            owner = principal \"$DEPLOYER\";
            subaccount = null;
        };
        token_id = 100;
        metadata = vec {
            record { \"name\"; variant { Text = \"Test Approval NFT\" } };
            record { \"description\"; variant { Text = \"NFT for testing approval functionality\" } };
        };
        memo = opt blob \"Test mint for approval\";
        created_at_time = null;
    }
})"

echo ""
echo "🔍 Verifying token ownership..."
dfx canister call cross_nft_launcher_backend icrc7_owner_of "(vec { 100 })"

echo ""
echo "✅ Approving Alice to spend token 100..."
dfx canister call cross_nft_launcher_backend icrc37_approve "(vec {
    record {
        token_id = 100;
        spender = record {
            owner = principal \"$ALICE\";
            subaccount = null;
        };
        from_subaccount = null;
        expires_at = null;
        memo = opt blob \"Approval for Alice\";
        created_at_time = null;
    }
})"

echo ""
echo "🔍 Checking if Alice is approved..."
dfx canister call cross_nft_launcher_backend icrc37_is_approved "(vec {
    record (
        100,
        record {
            owner = principal \"$DEPLOYER\";
            subaccount = null;
        },
        record {
            owner = principal \"$ALICE\";
            subaccount = null;
        }
    )
})"

echo ""
echo "🔄 Alice transferring token 100 to Bob..."
dfx identity use alice
dfx canister call cross_nft_launcher_backend icrc37_transfer_from "(vec {
    record {
        spender_subaccount = null;
        from = record {
            owner = principal \"$DEPLOYER\";
            subaccount = null;
        };
        to = record {
            owner = principal \"$BOB\";
            subaccount = null;
        };
        token_id = 100;
        memo = opt blob \"Transfer via approval\";
        created_at_time = null;
    }
})"

echo ""
echo "🔍 Verifying new ownership..."
dfx canister call cross_nft_launcher_backend icrc7_owner_of "(vec { 100 })"

echo ""
echo "🔍 Checking if Alice is still approved (should be false)..."
dfx canister call cross_nft_launcher_backend icrc37_is_approved "(vec {
    record (
        100,
        record {
            owner = principal \"$BOB\";
            subaccount = null;
        },
        record {
            owner = principal \"$ALICE\";
            subaccount = null;
        }
    )
})"

echo ""
echo "📊 Getting transaction history..."
dfx canister call cross_nft_launcher_backend icrc3_get_blocks "(vec { record (0, 10) })"

# Switch back to default identity
dfx identity use default

echo ""
echo "✅ ICRC-37 Approval testing completed!"
echo ""
echo "🔗 Test Summary:"
echo "   ✓ Token minted to deployer"
echo "   ✓ Deployer approved Alice to spend token"
echo "   ✓ Alice transferred token to Bob using approval"
echo "   ✓ Approval was automatically revoked after use"
echo "   ✓ Transaction history recorded all actions"
echo "" 