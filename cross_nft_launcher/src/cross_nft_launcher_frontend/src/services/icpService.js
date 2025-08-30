import { HttpAgent } from "@dfinity/agent";
import { Secp256k1KeyIdentity } from "@dfinity/identity-secp256k1";

// ICP Configuration - Force local development network
const ICP_NETWORK = 'http://127.0.0.1:4943';

// Canister ID - you'll need to replace this with your actual canister ID
const CANISTER_ID = 'lqy7q-dh777-77777-aaaaq-cai'; // Local backend canister ID

// Check if canister ID is configured
console.log('ICP Network:', ICP_NETWORK);
console.log('ICP Canister ID from environment:', CANISTER_ID);
if (!CANISTER_ID || CANISTER_ID === 'your-canister-id-here') {
  console.warn('ICP Canister ID not configured. Please set REACT_APP_CANISTER_ID in your .env file');
}

// Create identity (for testing - in production, use proper identity management)
const createIdentity = async () => {
  try {
    // For testing purposes - replace with proper identity in production
    const seed = "test test test test test test test test test test test test";
    return await Secp256k1KeyIdentity.fromSeedPhrase(seed);
  } catch (error) {
    console.error('Error creating identity:', error);
    throw error;
  }
};

// Create agent
const createAgent = async () => {
  try {
    const identity = await createIdentity();
    const agent = new HttpAgent({
      identity,
      host: ICP_NETWORK,
    });
    
    // For local development, always fetch root key
    await agent.fetchRootKey();
    
    return agent;
  } catch (error) {
    console.error('Error creating agent:', error);
    throw error;
  }
};

// Import the proper interface factory from declarations
let idlFactory = null;
let createActor = null;

// Dynamically import the declarations
const loadDeclarations = async () => {
  try {
    // Try to import from the declarations folder
    const declarations = await import('../declarations/cross_nft_launcher_backend/index.js');
    idlFactory = declarations.idlFactory;
    createActor = declarations.createActor;
    return true;
  } catch (error) {
    console.error('Error loading declarations:', error);
    return false;
  }
};

// Create actor for the canister using proper declarations
const createCanisterActor = async () => {
  try {
    // Check if canister ID is configured
    if (!CANISTER_ID || CANISTER_ID === 'your-canister-id-here') {
      throw new Error('ICP Canister ID not configured. Please set REACT_APP_CANISTER_ID in your .env file');
    }
    
    const agent = await createAgent();
    
    if (!idlFactory || !createActor) {
      const loaded = await loadDeclarations();
      if (!loaded) {
        throw new Error('Failed to load canister declarations');
      }
    }
    
    // Use the proper createActor function from declarations
    const actor = createActor(CANISTER_ID, {
      agent,
    });
    
    return actor;
  } catch (error) {
    console.error('Error creating actor:', error);
    throw error;
  }
};

// Function to update block number on ICP
export const updateBlockNumberOnICP = async (blockNumber) => {
  try {
    console.log(`Updating block number on ICP: ${blockNumber}`);
    
    const actor = await createCanisterActor();
    
    // Debug: Check available functions
    console.log('Available actor functions:', Object.keys(actor));
    console.log('update_block_number function exists:', typeof actor.update_block_number);
    
    // Call the update_block_number function with BigInt (nat64)
    // eslint-disable-next-line no-undef
    const result = await actor.update_block_number(BigInt(blockNumber));
    
    console.log('ICP update result:', result);
    return result;
  } catch (error) {
    console.error('Error updating block number on ICP:', error);
    throw error;
  }
};

// Function to call holesky_txn on ICP (returns Result)
export const callHoleskyTxnOnICP = async () => {
  try {
    const actor = await createCanisterActor();
    // Debug: Check available functions
    console.log('Available actor functions:', Object.keys(actor));
    if (typeof actor.holesky_txn !== 'function') {
      console.error('holesky_txn is not a function. Available functions:', Object.keys(actor));
      throw new Error('holesky_txn is not a function on the canister actor');
    }
    const result = await actor.holesky_txn();
    console.log('ICP holesky_txn result:', result);
    // Handle candid Result type
    if (result && result.Ok) {
      return result.Ok;
    } else if (result && result.Err) {
      // Don't throw error for "No transaction hash stored" - this is expected during polling
      if (result.Err === "No transaction hash stored.") {
        return null; // Return null to indicate transaction not ready yet
      }
      throw new Error(result.Err);
    }
    return result;
  } catch (error) {
    // Don't log "No transaction hash stored" as an error - it's expected during polling
    if (error.message && error.message.includes("No transaction hash stored")) {
      return null;
    }
    console.error('Error calling holesky_txn on ICP:', error);
    throw error;
  }
};

// Function to call sepolia_txn on ICP (returns Result) - for Holesky to Sepolia flow
export const callSepoliaTxnOnICP = async () => {
  try {
    const actor = await createCanisterActor();
    // Debug: Check available functions
    console.log('Available actor functions:', Object.keys(actor));
    if (typeof actor.sepolia_txn !== 'function') {
      console.error('sepolia_txn is not a function. Available functions:', Object.keys(actor));
      throw new Error('sepolia_txn is not a function on the canister actor');
    }
    const result = await actor.sepolia_txn();
    console.log('ICP sepolia_txn result:', result);
    // Handle candid Result type
    if (result && result.Ok) {
      return result.Ok;
    } else if (result && result.Err) {
      // Don't throw error for "No transaction hash stored" - this is expected during polling
      if (result.Err === "No transaction hash stored.") {
        return null; // Return null to indicate transaction not ready yet
      }
      throw new Error(result.Err);
    }
    return result;
  } catch (error) {
    // Don't log "No transaction hash stored" as an error - it's expected during polling
    if (error.message && error.message.includes("No transaction hash stored")) {
      return null;
    }
    console.error('Error calling sepolia_txn on ICP:', error);
    throw error;
  }
};

// Function to call mint_nft_release on Sepolia contract via ICP
export const callMintNftReleaseSepoliaOnICP = async (owner, name, description, image, price) => {
  try {
    const actor = await createCanisterActor();
    // Debug: Check available functions
    console.log('Available actor functions:', Object.keys(actor));
  
    const result = await actor.monitor_evm_nft_reverse(owner, name, description, image, price);
    console.log('ICP monitor_evm_nft_reverse result:', result);
    // Handle candid Result type
    if (result && result.Ok) {
      return result.Ok;
    } else if (result && result.Err) {
      throw new Error(result.Err);
    }
    return result;
  } catch (error) {
    console.error('Error calling call_mint_nft_release_sepolia on ICP:', error);
    throw error;
  }
};

// Function to call monitor_evm_nft on ICP
export const callMonitorEvmNftOnICP = async () => {
  try {
    const actor = await createCanisterActor();
    // Debug: Check available functions
    console.log('Available actor functions:', Object.keys(actor));
    if (typeof actor.monitor_evm_nft !== 'function') {
      throw new Error('monitor_evm_nft is not a function on the canister actor');
    }
    const result = await actor.monitor_evm_nft();
    console.log('ICP monitor_evm_nft result:', result);
    return result;
  } catch (error) {
    console.error('Error calling monitor_evm_nft on ICP:', error);
    throw error;
  }
};

// Function to call monitor_evm_nft_reverse on ICP (for Holesky to Sepolia)
export const callMonitorEvmNftReverseOnICP = async () => {
  try {
    const actor = await createCanisterActor();
    // Debug: Check available functions
    console.log('Available actor functions:', Object.keys(actor));
    if (typeof actor.monitor_evm_nft_reverse !== 'function') {
      throw new Error('monitor_evm_nft_reverse is not a function on the canister actor');
    }
    const result = await actor.monitor_evm_nft_reverse();
    console.log('ICP monitor_evm_nft_reverse result:', result);
    return result;
  } catch (error) {
    console.error('Error calling monitor_evm_nft_reverse on ICP:', error);
    throw error;
  }
};

// Test function to verify ICP connection
export const testICPConnection = async () => {
  try {
    await createCanisterActor();
    console.log('ICP connection test successful');
    return true;
  } catch (error) {
    console.error('ICP connection test failed:', error);
    return false;
  }
}; 