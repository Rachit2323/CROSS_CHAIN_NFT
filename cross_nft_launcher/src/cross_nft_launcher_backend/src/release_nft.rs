use candid::Nat;
use ethabi::{Address, Function, Param, ParamType, Token};
use ethabi::ethereum_types::{H160, U256};
use ethers_core::types::{Bytes, Eip1559TransactionRequest, U64};
use hex;
use ic_cdk::api::call::call_with_payment128;
use ic_cdk::update;
use k256::PublicKey;
use sha2::Digest;
use std::str::FromStr;

use crate::{evm_rpc_bindings, Account, MetadataValue};
use crate::evm_nft_indexer::ChainService;
use crate::evm_rpc_bindings::{EthSepoliaService, GetTransactionCountArgs, MultiSendRawTransactionResult, RpcApi, SendRawTransactionStatus};
use crate::evm_rpc_bindings::MultiGetTransactionCountResult;
use crate::evm_rpc_bindings::{BlockTag, RpcServices};
use ic_cdk::api::management_canister::ecdsa::{ecdsa_public_key, EcdsaCurve, EcdsaKeyId, EcdsaPublicKeyArgument, SignWithEcdsaArgument};
use crate::evm_rpc_bindings::GetTransactionCountResult;
use ic_cdk::api::management_canister::ecdsa::SignWithEcdsaResponse;
use ic_cdk::api::management_canister::ecdsa::EcdsaPublicKeyResponse;
use ic_cdk::api::management_canister::ecdsa::sign_with_ecdsa;
use crate::evm_rpc_bindings::SendRawTransactionResult;
use num_traits::ToPrimitive;

use std::sync::RwLock;
use once_cell::sync::Lazy;

static TX_HASH: Lazy<RwLock<Option<String>>> = Lazy::new(|| RwLock::new(None));
// Network-specific transaction hash storage
static HOLESKY_TX_HASH: Lazy<RwLock<Option<String>>> = Lazy::new(|| RwLock::new(None));
static SEPOLIA_TX_HASH: Lazy<RwLock<Option<String>>> = Lazy::new(|| RwLock::new(None));


const NFT_CONTRACT_ADDRESS_HEX: &str = "0x027315bad2c06b0ab2a4f31c6b4b162f798a3b31";
const EIP1559_TX_ID: u8 = 2;
const NFT_SEPOLIA_ADDRESS_HEX:&str="0x800e11fb1f4c9b33eab0dd7aae19c2ae741be30c";

impl ChainService {

    async fn pubkey_and_signature(&self, tx_hash: Vec<u8>) -> Result<(Vec<u8>, SignWithEcdsaResponse), String> {
        let public_key_response = get_ecdsa_public_key().await?; // now a Result
        
        let (signature_response,) = sign_with_ecdsa(SignWithEcdsaArgument {
            message_hash: tx_hash,
            key_id: key_id(),
            ..Default::default()
        })
        .await
        .map_err(|e| format!("Failed to generate signature {:?}", e))?;
    
        Ok((public_key_response.public_key, signature_response))
    }
     
    /// Fetch transaction count (nonce) for your IC Ethereum address (from secp256k1 pubkey)
    pub async fn fetch_tx_nonce(&self) -> Result<Nat, String> {
        let block_tag = BlockTag::Latest;
        let (canister_address, _ecdsa_key) =get_network_config();
         ic_cdk::println!("canister_address {}",canister_address);
        let get_transaction_count_args = GetTransactionCountArgs {
            address: canister_address.to_string(),
            block: block_tag,
        };

        // Prepare cycles amount to pay for the call (adjust as necessary)
        let cycles: u128 = 200_000_000_000u128;

        // The principal (canister ID) of the EVM RPC canister
        let evm_canister_id = self.evm_rpc.0;

        // Make cross-canister call with cycles payment
        let (transaction_result,) = call_with_payment128::<
            (RpcServices, Option<crate::evm_rpc_bindings::RpcConfig>, GetTransactionCountArgs),
            (MultiGetTransactionCountResult,),
        >(
            evm_canister_id,
            "eth_getTransactionCount",
            (
                RpcServices::Custom {
                    chainId: 17000,
                    services: vec![
                        RpcApi {
                            url: "https://eth-holesky.g.alchemy.com/v2/OLoCeG14N_MLxJ5tFvD-k67DHU4Xc-ig".to_string(),  // Primary: Alchemy
                            headers: None,
                        },
                        RpcApi {
                            url: "https://holesky.drpc.org".to_string(),  // Backup: DRPC
                            headers: None,
                        },
                    ],
                },
                None,
                get_transaction_count_args.clone(),
            ),
            cycles,
        )
        .await
        .map_err(|e| format!("Failed to get transaction count: {:?}", e))?;

        // Handle possible result variants
        let transaction_count = match transaction_result {
            MultiGetTransactionCountResult::Consistent(consistent_result) => match consistent_result {
                GetTransactionCountResult::Ok(count) => count,
                GetTransactionCountResult::Err(error) => {
                    return Err(format!(
                        "failed to get transaction count for {:?}, error: {:?}",
                        get_transaction_count_args,
                        error
                    ));
                }
            },
            MultiGetTransactionCountResult::Inconsistent(inconsistent_results) => {
                return Err(format!(
                    "inconsistent results when retrieving transaction count for {:?}. Received results: {:?}",
                    get_transaction_count_args,
                    inconsistent_results
                ));
            }
        };
        
        Ok(transaction_count)
    }



    /// Fixed version of the ABI encoding
    pub async fn call_mint_nft_release(
    &self,
    owner: String,
    name: String,
    description: String,
    image: String,
    price: u64,
) -> Result<String, String> {
    // 1. Prepare the function ABI for mint_nft_release(address,string,string,string,uint256)
    let function = Function {
        name: "mint_nft_release".to_string(),
        inputs: vec![
            Param { 
                name: "owner".to_string(), 
                kind: ParamType::Address, 
                internal_type: None 
            },
            Param { 
                name: "name".to_string(), 
                kind: ParamType::String, 
                internal_type: None 
            },
            Param { 
                name: "description".to_string(), 
                kind: ParamType::String, 
                internal_type: None 
            },
            Param { 
                name: "image".to_string(), 
                kind: ParamType::String, 
                internal_type: None 
            },
            Param { 
                name: "price".to_string(), 
                kind: ParamType::Uint(256), 
                internal_type: None 
            },
        ],
        outputs: vec![],
        constant: None,
        state_mutability: ethabi::StateMutability::NonPayable,
    };

    // 2. FIXED: Properly decode and validate the owner address
    let owner_address = if owner.starts_with("0x") {
        owner.clone()
    } else {
        format!("0x{}", owner)
    };
    
    let owner_bytes = hex::decode(owner_address.trim_start_matches("0x"))
        .map_err(|e| format!("Invalid owner address: {}", e))?;
    
    if owner_bytes.len() != 20 {
        return Err(format!("Owner address must be 20 bytes, got {}", owner_bytes.len()));
    }

    // 3. FIXED: Create tokens with proper validation
    ic_cdk::println!("Encoding parameters - Name: '{}', Desc: '{}', Image: '{}', Price: {}", 
                     name, description, image, price);

    let tokens = vec![
        Token::Address(ethabi::Address::from_slice(&owner_bytes)),
        Token::String(name.clone()),
        Token::String(description.clone()),
        Token::String(image.clone()),
        Token::Uint(U256::from(price)),
    ];

    // 4. FIXED: Add debug logging for ABI encoding
    let call_data = function.encode_input(&tokens)
        .map_err(|e| format!("Failed to encode input: {}", e))?;
    
    ic_cdk::println!("Encoded call data length: {} bytes", call_data.len());
    ic_cdk::println!("Call data (first 100 bytes): 0x{}", 
                     hex::encode(&call_data[..std::cmp::min(100, call_data.len())]));

    // 5. Get public key and derive address
    let public_key_hex = generate_key_pair_evm().await?;
    ic_cdk::println!("Using public key: {}", public_key_hex);

    // 6. Get nonce
    let nonce = self.fetch_tx_nonce().await?;
    ic_cdk::println!("Using nonce: {}", nonce);

    // 7. FIXED: Use more reasonable gas settings
    let gas_limit = 500_000u64;  // Increased gas limit
    let max_fee_per_gas = 20_000_000_000u64;  // 20 Gwei
    let max_priority_fee_per_gas = 2_000_000_000u64;  // 2 Gwei
    
    ic_cdk::println!("Gas settings - Limit: {}, MaxFee: {}, MaxPriority: {}", 
                     gas_limit, max_fee_per_gas, max_priority_fee_per_gas);

    // 8. Build the EIP-1559 transaction request  
    let tx = Eip1559TransactionRequest {
        from: None,
        to: Some(H160::from_str(NFT_CONTRACT_ADDRESS_HEX).unwrap().into()),
        nonce: Some(U256::from(nonce.0.to_u64().unwrap())),
        gas: Some(U256::from(gas_limit)),
        max_fee_per_gas: Some(U256::from(max_fee_per_gas)),
        max_priority_fee_per_gas: Some(U256::from(max_priority_fee_per_gas)),
        value: Some(U256::zero()),
        data: Some(Bytes::from(call_data.clone())),
        access_list: vec![].into(),
        chain_id: Some(U64::from(17000u64))
    };

    // Rest of the signing and sending logic remains the same...
    
    let mut unsigned_tx = tx.rlp().to_vec();
    unsigned_tx.insert(0, EIP1559_TX_ID);

    let tx_hash = ethers_core::utils::keccak256(&unsigned_tx);
    let (public_key_bytes, signature) = self.pubkey_and_signature(tx_hash.to_vec()).await?;
    let y_parity = y_parity(&tx_hash, &signature.signature, &public_key_bytes);

    let sig = ethers_core::types::Signature {
        r: U256::from_big_endian(&signature.signature[0..32]),
        s: U256::from_big_endian(&signature.signature[32..64]),
        v: y_parity as u64,
    };

    let mut signed_tx = tx.rlp_signed(&sig).to_vec();
    signed_tx.insert(0, EIP1559_TX_ID);

    let raw_tx_hex = format!("0x{}", hex::encode(&signed_tx));
    ic_cdk::println!("Raw signed transaction hex: {}", raw_tx_hex);

    let cycles_to_pay: u128 = 600_000_000_000;

    // Send transaction
    let (send_result,) = call_with_payment128::<
        (RpcServices, Option<crate::evm_rpc_bindings::RpcConfig>, String),
        (MultiSendRawTransactionResult,),
    >(
        self.evm_rpc.0,
        "eth_sendRawTransaction", 
        (
            RpcServices::Custom {
                chainId: 17000,
                services: vec![
                    RpcApi {
                        url: "https://eth-holesky.g.alchemy.com/v2/OLoCeG14N_MLxJ5tFvD-k67DHU4Xc-ig".to_string(),  // Primary: Alchemy
                        headers: None,
                    },
                    RpcApi {
                        url: "https://holesky.drpc.org".to_string(),  // Backup: DRPC
                        headers: None,
                    },
                ],
            },
            None,
            raw_tx_hex,
        ),
        cycles_to_pay,
    )
    .await
    .map_err(|e| format!("Failed to send raw transaction: {:?}", e))?;

    // Parse result
    match send_result {
        MultiSendRawTransactionResult::Consistent(send_status) => match send_status {
            SendRawTransactionResult::Ok(SendRawTransactionStatus::Ok(opt_tx_hash)) => {
                if let Some(tx_hash) = opt_tx_hash {
                    {
                        let mut hash = HOLESKY_TX_HASH.write().unwrap();
                        *hash = Some(tx_hash.clone());
                    }
                    ic_cdk::println!("✅ Transaction sent successfully, tx hash: {:?}", tx_hash);
                    Ok(tx_hash)
                } else {
                    Err("Error: transaction hash not found in the response".to_string())
                }
            }
            SendRawTransactionResult::Ok(SendRawTransactionStatus::NonceTooLow) =>
                Err("Error: nonce too low".to_string()),
            SendRawTransactionResult::Ok(SendRawTransactionStatus::NonceTooHigh) =>
                Err("Error: nonce too high".to_string()),
            SendRawTransactionResult::Ok(SendRawTransactionStatus::InsufficientFunds) =>
                Err("Error: insufficient funds".to_string()),
            SendRawTransactionResult::Err(rpc_error) =>
                Err(format!("RPC error sending transaction: {:?}", rpc_error)),
        },
        MultiSendRawTransactionResult::Inconsistent(_) => {
            Err("Inconsistent send raw transaction results".to_string())
        }
    }
}

    /// Enhanced Sepolia version: prepares, signs, and sends the Ethereum transaction to call mint_nft_release on Sepolia
pub async fn call_mint_nft_release_sepolia(
    &self,
    owner: String,
    name: String,
    description: String,
    image: String,
    price: u64,
) -> Result<String, String> {
    ic_cdk::println!("call_mint_nft_release_sepolia - Starting transaction preparation");
    
    // ENHANCED: Input validation against contract requirements
    if name.len() > 32 {
        return Err(format!("Name too long: {} bytes (contract max: 32)", name.len()));
    }
    if description.len() > 200 {
        return Err(format!("Description too long: {} bytes (contract max: 200)", description.len()));
    }
    if image.len() > 200 {
        return Err(format!("Image URL too long: {} bytes (contract max: 200)", image.len()));
    }
    
    ic_cdk::println!("✅ Input validation passed - Name: {} bytes, Desc: {} bytes, Image: {} bytes", 
                     name.len(), description.len(), image.len());
    ic_cdk::println!("Parameters - Name: '{}', Description: '{}', Price: {}", 
                     name, description, price);

    // Build function ABI
    let function = ethabi::Function {
        name: "mint_nft_release".to_string(),
        inputs: vec![
            ethabi::Param { 
                name: "owner".to_string(), 
                kind: ethabi::ParamType::Address, 
                internal_type: None 
            },
            ethabi::Param { 
                name: "name".to_string(), 
                kind: ethabi::ParamType::String, 
                internal_type: None 
            },
            ethabi::Param { 
                name: "description".to_string(), 
                kind: ethabi::ParamType::String, 
                internal_type: None 
            },
            ethabi::Param { 
                name: "image".to_string(), 
                kind: ethabi::ParamType::String, 
                internal_type: None 
            },
            ethabi::Param { 
                name: "price".to_string(), 
                kind: ethabi::ParamType::Uint(256), 
                internal_type: None 
            },
        ],
        outputs: vec![],
        constant: None,
        state_mutability: ethabi::StateMutability::NonPayable,
    };

    // ENHANCED: Improved owner address handling
    let owner_address = if owner.starts_with("0x") {
        owner.clone()
    } else {
        format!("0x{}", owner)
    };
    
    let owner_hex = owner_address.trim_start_matches("0x");
    let owner_bytes = hex::decode(owner_hex)
        .map_err(|e| format!("Failed to decode owner address hex '{}': {}", owner_hex, e))?;
    
    if owner_bytes.len() != 20 {
        return Err(format!("Owner address invalid length: {} bytes (expected 20)", owner_bytes.len()));
    }
    
    ic_cdk::println!("Owner address validated: {}", owner_address);

    // ENHANCED: Create tokens with detailed logging
    let tokens = vec![
        ethabi::Token::Address(ethabi::Address::from_slice(&owner_bytes)),
        ethabi::Token::String(name.clone()),
        ethabi::Token::String(description.clone()),
        ethabi::Token::String(image.clone()),
        ethabi::Token::Uint(U256::from(price)),
    ];

    ic_cdk::println!("ABI tokens prepared - Address: {}, Strings: [{}, {}, {}], Price: {}", 
                     owner_address, name, description, 
                     if image.len() > 50 { format!("{}...", &image[..50]) } else { image.clone() }, 
                     price);

    // ENHANCED: Encode with error details
    let call_data = function.encode_input(&tokens)
        .map_err(|e| format!("Failed to encode input data: {}. Tokens: {:?}", e, tokens))?;
    
    ic_cdk::println!("✅ ABI encoding successful - Call data length: {} bytes", call_data.len());
    ic_cdk::println!("Call data preview (first 64 bytes): 0x{}", 
                     hex::encode(&call_data[..std::cmp::min(64, call_data.len())]));

    // ENHANCED: Better nonce handling with validation
    let nonce_u128 = self.fetch_tx_nonce_sepolia().await
        .map_err(|e| format!("Failed fetching Sepolia nonce: {:?}", e))?;
    
    let nonce_u64 = nonce_u128.0.to_u64()
        .ok_or_else(|| format!("Nonce too large for u64: {}", nonce_u128.0))?;
    
    ic_cdk::println!("✅ Sepolia nonce retrieved: {}", nonce_u64);

    // ENHANCED: Improved gas estimation with safety margins
    let (base_gas_limit, max_fee_per_gas, max_priority_fee_per_gas) = estimate_transaction_fees().await;
    
    // Add safety margin to gas limit for complex NFT minting
    let gas_limit = std::cmp::max(base_gas_limit, 500_000u128); // Minimum 500k gas
    
    ic_cdk::println!("Gas settings - Limit: {} (base: {}), MaxFee: {} Gwei, MaxPriority: {} Gwei",
                     gas_limit, base_gas_limit, 
                     max_fee_per_gas / 1_000_000_000, 
                     max_priority_fee_per_gas / 1_000_000_000);

    // ENHANCED: Validate contract address
    let contract_address = H160::from_str(NFT_SEPOLIA_ADDRESS_HEX)
        .map_err(|e| format!("Invalid NFT_SEPOLIA_ADDRESS_HEX '{}': {:?}", NFT_SEPOLIA_ADDRESS_HEX, e))?;
    
    ic_cdk::println!("Target contract: {}", NFT_SEPOLIA_ADDRESS_HEX);

    // Build EIP-1559 request
    let tx = Eip1559TransactionRequest {
        from: None,
        to: Some(contract_address.into()),
        nonce: Some(U256::from(nonce_u64)),
        gas: Some(U256::from(gas_limit)),
        max_fee_per_gas: Some(U256::from(max_fee_per_gas)),
        max_priority_fee_per_gas: Some(U256::from(max_priority_fee_per_gas)),
        value: Some(U256::zero()),
        data: Some(Bytes::from(call_data.clone())),
        access_list: vec![].into(),
        chain_id: Some(U64::from(11155111u64)), // Sepolia chain ID
    };

    // Create typed payload bytes for signing
    let mut unsigned_rlp = tx.rlp().to_vec();
    unsigned_rlp.insert(0, EIP1559_TX_ID);

    ic_cdk::println!("Unsigned typed tx prepared (len={})", unsigned_rlp.len());
    
    // ENHANCED: Log transaction hash for debugging
    let signing_hash = ethers_core::utils::keccak256(&unsigned_rlp);
    ic_cdk::println!("Transaction signing hash: 0x{}", hex::encode(&signing_hash));

    // ENHANCED: Better signature handling with validation
    let (public_key_bytes, signature) = self.pubkey_and_signature(signing_hash.to_vec()).await
        .map_err(|e| format!("Failed to generate pubkey/signature: {:?}", e))?;

    if signature.signature.len() != 64 {
        return Err(format!("Invalid signature length: {} bytes (expected 64)", signature.signature.len()));
    }
    
    ic_cdk::println!("✅ Signature generated successfully");

    // Compute recovery id with validation
    let recovery_id = y_parity(&signing_hash, &signature.signature, &public_key_bytes);
    if recovery_id > 1 {
        return Err(format!("Invalid recovery id: {} (expected 0 or 1)", recovery_id));
    }
    
    ic_cdk::println!("Recovery id (y parity): {}", recovery_id);

    // Build ethers Signature
    let sig = ethers_core::types::Signature {
        r: U256::from_big_endian(&signature.signature[0..32]),
        s: U256::from_big_endian(&signature.signature[32..64]),
        v: recovery_id as u64,
    };

    // Create signed transaction
    let mut signed_rlp = tx.rlp_signed(&sig).to_vec();
    signed_rlp.insert(0, EIP1559_TX_ID);

    let raw_tx_hex = format!("0x{}", hex::encode(&signed_rlp));
    
    ic_cdk::println!("✅ Transaction signed successfully");
    ic_cdk::println!("Signed tx length: {} bytes", signed_rlp.len());
    ic_cdk::println!("Raw transaction (first 100 chars): {}...", 
                     if raw_tx_hex.len() > 100 { &raw_tx_hex[..100] } else { &raw_tx_hex });

    // ENHANCED: Send with better error context
    let cycles_to_pay: u128 = 600_000_000_000u128;
    
    ic_cdk::println!("Sending transaction to Sepolia network...");
    
    let (send_result,) = call_with_payment128::<
        (RpcServices, Option<crate::evm_rpc_bindings::RpcConfig>, String),
        (MultiSendRawTransactionResult,),
    >(
        self.evm_rpc.0,
        "eth_sendRawTransaction",
        (
            RpcServices::Custom {
                chainId: 11155111,
                services: vec![
                    RpcApi {
                        url: "https://ethereum-sepolia-rpc.publicnode.com".to_string(),  // Primary: Most reliable
                        headers: None,
                    },
                    RpcApi {
                        url: "https://sepolia.infura.io/v3/5149c676c7f9427eb71d094efdb9788b".to_string(),  // Backup: Infura
                        headers: None,
                    },
                ],
            },
            None,
            raw_tx_hex.clone(),
        ),
        cycles_to_pay,
    )
    .await
    .map_err(|e| format!("RPC call failed: {:?}", e))?;

    ic_cdk::println!("✅ RPC call completed, processing response...");

    // ENHANCED: Better response handling with detailed error messages
    match send_result {
        MultiSendRawTransactionResult::Consistent(result) => match result {
            SendRawTransactionResult::Ok(status) => match status {
                SendRawTransactionStatus::Ok(opt_tx_hash) => {
                    if let Some(tx_hash) = opt_tx_hash {
                        // Store transaction hash
                        {
                            let mut sepolia_tx_hash = SEPOLIA_TX_HASH.write().unwrap();
                            *sepolia_tx_hash = Some(tx_hash.clone());
                        }
                        
                        ic_cdk::println!("🎉 Sepolia transaction sent successfully!");
                        ic_cdk::println!("Transaction hash: {}", tx_hash);
                        ic_cdk::println!("Sepolia explorer: https://sepolia.etherscan.io/tx/{}", tx_hash);
                        
                        Ok(tx_hash)
                    } else {
                        let error_msg = "Transaction was sent but no hash was returned".to_string();
                        ic_cdk::println!("❌ Error: {}", error_msg);
                        Err(error_msg)
                    }
                }
                SendRawTransactionStatus::NonceTooLow => {
                    let error_msg = format!("Nonce too low (used: {}). Try increasing nonce.", nonce_u64);
                    ic_cdk::println!("❌ Error: {}", error_msg);
                    Err(error_msg)
                }
                SendRawTransactionStatus::NonceTooHigh => {
                    let error_msg = format!("Nonce too high (used: {}). Check current nonce.", nonce_u64);
                    ic_cdk::println!("❌ Error: {}", error_msg);
                    Err(error_msg)
                }
                SendRawTransactionStatus::InsufficientFunds => {
                    let estimated_cost = (gas_limit as u128) * (max_fee_per_gas as u128);
                    let error_msg = format!("Insufficient funds. Estimated cost: {} wei ({} ETH)", 
                                          estimated_cost, estimated_cost as f64 / 1e18);
                    ic_cdk::println!("❌ Error: {}", error_msg);
                    Err(error_msg)
                }
            },
            SendRawTransactionResult::Err(rpc_error) => {
                let error_msg = format!("RPC error: {:?}", rpc_error);
                ic_cdk::println!("❌ Error: {}", error_msg);
                Err(error_msg)
            }
        },
        MultiSendRawTransactionResult::Inconsistent(responses) => {
            let error_msg = format!("Inconsistent responses from RPC providers: {:?}", responses);
            ic_cdk::println!("❌ Error: {}", error_msg);
            Err(error_msg)
        }
    }
}

    /// Fetch transaction count (nonce) for Sepolia network
    pub async fn fetch_tx_nonce_sepolia(&self) -> Result<Nat, String> {
        let block_tag = BlockTag::Latest;
        let (canister_address, _ecdsa_key) = get_network_config();
        ic_cdk::println!("Sepolia canister_address {}", canister_address);
        let get_transaction_count_args = GetTransactionCountArgs {
            address: canister_address.to_string(),
            block: block_tag,
        };

        let cycles: u128 = 200_000_000_000u128;
        let evm_canister_id = self.evm_rpc.0;

        let (transaction_result,) = call_with_payment128::<
            (RpcServices, Option<crate::evm_rpc_bindings::RpcConfig>, GetTransactionCountArgs),
            (MultiGetTransactionCountResult,),
        >(
            evm_canister_id,
            "eth_getTransactionCount",
            (
                RpcServices::Custom {
                    chainId: 11155111,  // Sepolia chain ID
                    services: vec![
                        RpcApi {
                            url: "https://ethereum-sepolia-rpc.publicnode.com".to_string(),  // Primary: Most reliable
                            headers: None,
                        },
                        RpcApi {
                            url: "https://sepolia.infura.io/v3/5149c676c7f9427eb71d094efdb9788b".to_string(),  // Backup: Infura
                            headers: None,
                        },
                    ],
                },
                None,
                get_transaction_count_args.clone(),
            ),
            cycles,
        )
        .await
        .map_err(|e| format!("Failed to get Sepolia transaction count: {:?}", e))?;

        let transaction_count = match transaction_result {
            MultiGetTransactionCountResult::Consistent(consistent_result) => match consistent_result {
                GetTransactionCountResult::Ok(count) => count,
                GetTransactionCountResult::Err(error) => {
                    return Err(format!(
                        "failed to get Sepolia transaction count for {:?}, error: {:?}",
                        get_transaction_count_args,
                        error
                    ));
                }
            },
            MultiGetTransactionCountResult::Inconsistent(inconsistent_results) => {
                return Err(format!(
                    "inconsistent Sepolia results when retrieving transaction count for {:?}. Received results: {:?}",
                    get_transaction_count_args,
                    inconsistent_results
                ));
            }
        };
        
        Ok(transaction_count)
    }


}




#[update]
pub async fn generate_key_pair_evm() -> Result<String, String> {

    let (_, ecdsa_key) = get_network_config();

    let request = EcdsaPublicKeyArgument {
        key_id: EcdsaKeyId {
            curve: EcdsaCurve::Secp256k1,
            name: ecdsa_key.to_string(),
        },
        ..Default::default()
    };

    let (response,) = ecdsa_public_key(request)
        .await
        .map_err(|e| format!("ecdsa_public_key failed {:?}", e))?;

    ic_cdk::println!("ECDSA public key response: {:?}", response);

    let public_key_hex = hex::encode(&response.public_key);

    ic_cdk::println!("Derived public key hex: {}", public_key_hex);

       let ethereum_address = pubkey_bytes_to_address(&response.public_key);



        Ok(ethereum_address)
}
/// Derive Ethereum address from uncompressed secp256k1 public key bytes (65 bytes, 0x04 prefix)

fn pubkey_bytes_to_address(pubkey_bytes: &[u8]) -> String {
    use k256::elliptic_curve::sec1::ToEncodedPoint;
    use sha3::Keccak256;


    let key =
        PublicKey::from_sec1_bytes(pubkey_bytes).expect("failed to parse the public key as SEC1");
    let point = key.to_encoded_point(false);
    let point_bytes = point.as_bytes();
    assert_eq!(point_bytes[0], 0x04);

    let hash = Keccak256::digest(&point_bytes[1..]);

    let address = Address::from_slice(&hash[12..32]);
    ethers_core::utils::to_checksum(&address.into(), None)
}

pub async fn estimate_transaction_fees() -> (u128, u128, u128) {
    const GAS_LIMIT: u128 = 300_000;           // 300,000 gas units
    const MAX_FEE_PER_GAS: u128 = 25_000_000_000;       // 25 Gwei
    const MAX_PRIORITY_FEE_PER_GAS: u128 = 2_000_000_000; // 2 Gwei

    (GAS_LIMIT, MAX_FEE_PER_GAS, MAX_PRIORITY_FEE_PER_GAS)
}




fn y_parity(prehash: &[u8], sig: &[u8], pubkey: &[u8]) -> u64 {
    use k256::ecdsa::{RecoveryId, Signature, VerifyingKey};

    let orig_key = VerifyingKey::from_sec1_bytes(pubkey).expect("failed to parse the pubkey");
    let signature = Signature::try_from(sig).unwrap();
    for parity in [0u8, 1] {
        let recid = RecoveryId::try_from(parity).unwrap();
        let recovered_key = VerifyingKey::recover_from_prehash(prehash, &signature, recid)
            .expect("failed to recover key");
        if recovered_key == orig_key {
            return parity as u64;
        }
    }

    panic!(
        "failed to recover the parity bit from a signature; sig: {}, pubkey: {}",
        hex::encode(sig),
        hex::encode(pubkey)
    )
}



const NETWORK: &str = "local";
pub fn get_network_config() -> (&'static str, &'static str) {
    match NETWORK {
        "local" => (
            "0x6aa3a45c64B45BF5eb031A4Ae18059e36e674E9c", // address_local
            "dfx_test_key",                               // ecdsa_key_local
        ),
        "mainnet" => (
            "0xCe18A8128Bd68395d8C33E1B0279e54757448FAD", // address_main
            "test_key_1",                                 // ecdsa_key_main
        ),
        _ => panic!("Unknown network!"),
    }
}

pub async fn get_ecdsa_public_key() -> Result<EcdsaPublicKeyResponse, String> {
    let res = ecdsa_public_key(EcdsaPublicKeyArgument {
        key_id: key_id(),
        ..Default::default()
    })
    .await
    .map_err(|e| format!("Failed to get public key: {:?}", e))?;

    Ok(res.0)
}


fn key_id() -> EcdsaKeyId {
    EcdsaKeyId {
        curve: EcdsaCurve::Secp256k1,
        name: "dfx_test_key".to_string(), // use EcdsaKeyId::default() for mainnet use test_key_1 for testnet and test_key_1 for local deployment
    }
}



pub async fn holesky_txn() -> Result<String, String> {
    let hash = HOLESKY_TX_HASH.read().unwrap();
    if let Some(ref txn) = *hash {
        ic_cdk::println!("Returning latest Holesky tx hash: {}", txn);
        Ok(txn.clone())
    } else {
        Err("No transaction hash stored.".to_string())
    }
}


// New function for Holesky to Sepolia flow
pub async fn sepolia_txn() -> Result<String, String> {
    let hash = SEPOLIA_TX_HASH.read().unwrap();
    if let Some(ref txn) = *hash {
        ic_cdk::println!("Returning latest Sepolia tx hash: {}", txn);
        Ok(txn.clone())
    } else {
        Err("No transaction hash stored.".to_string())
    }
}


