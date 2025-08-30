use candid::Principal; // Import for Principal
use candid::{CandidType, Nat};

use ethabi::ethereum_types::H256;
use ethabi::{decode, LogParam, ParamType, Token};
use hex::decode as hex_decode;
use ic_cdk::api::call::call_with_payment128;
use ic_cdk::api::time;

use ic_cdk::{post_upgrade, update};
use ic_cdk_timers::{set_timer, set_timer_interval, TimerId};
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::{HashMap, HashSet};

use ethabi::{Event, EventParam, Log, RawLog};

use crate::evm_rpc_bindings::{
    BlockTag,
    GetBlockByNumberResult,
    GetLogsArgs,
    GetLogsResult,
    MultiGetBlockByNumberResult,
    MultiGetLogsResult,
    RpcApi,
    RpcConfig,
    RpcServices,
    Service as EvmRpcService, // This is your interface to the canister
};

use crate::{icrc7_mint, Account, MetadataValue, MintArgs};

#[derive(CandidType, Deserialize, Clone, Debug, Serialize)]
pub struct TransactionDetails {
    pub from: String,
    pub to: String,
    pub amount: u64,
    pub src_chain_id: u64,
    pub dest_chain_id: u64,
    pub block_number: u64,
}

#[derive(CandidType, Deserialize, Clone, Debug, Serialize)]
pub struct TransactionReleaseDetails {
    pub status: bool,
    pub releasetxn: Option<String>,
}

thread_local! {
    static TRANSACTION_MAP: RefCell<HashMap<String, TransactionDetails>> = RefCell::new(HashMap::new());
}

thread_local! {
    static TRANSACTION_MAP_RELEASE: RefCell<HashMap<String, TransactionReleaseDetails>> = RefCell::new(HashMap::new());
}

thread_local! {
    static BLOCK_NUMBER: RefCell<u64> = RefCell::new(8845457);
}

thread_local! {
    pub static CHAIN_SERVICE: RefCell<Option<ChainService>> = RefCell::new(None);
}

#[derive(Clone, Debug)]
pub struct ChainService {
    canister_id: String,
    pub evm_rpc: EvmRpcService,
    last_checked_time: RefCell<u64>,
    timer_id: RefCell<Option<TimerId>>,
    // 86871172
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct LogDetails {
    pub from: String,
    pub to: String,
    pub amount: u64,
    pub src_chain_id: u64,
    pub txn_hash: String,
    pub dest_chain_id: u64,
}

impl ChainService {
    pub fn new(canister_id: String) -> Self {
        let principal = Principal::from_text("7hfb6-caaaa-aaaar-qadga-cai").unwrap();
        let evm_rpc = EvmRpcService(principal);
        let last_checked_time = RefCell::new(time() / 1_000_000);
        let timer_id = RefCell::new(None);

        ChainService {
            canister_id,
            evm_rpc,
            last_checked_time,
            timer_id,
        }
    }

    pub async fn fetch_burn_logs(
        &self,
        from_block: u64,
        to_block: u64,
        address_filter: Option<String>,
    ) -> Result<Vec<String>, String> {
        ic_cdk::println!(
            "🚀 Starting fetch_burn_logs from block {} to {}",
            from_block,
            to_block
        );

        // Keccak256 hash of the event signature:
        // "NftBurned(uint256,address,string,string,string,uint256,bool,uint256,string,string,uint256)"
        // NOTE: You should replace the string below with the exact signature hash from your Solidity compile output
        // For example purposes, assume this is correct (please verify your exact event signature hash)
        let burn_event_signature =
            "0x07b32c84e3143702733f3d50b8967a78251a88f50e458d5255e81dc0158d1112".to_string();

        // Convert Option<String> to Vec<String> for filtering addresses
        let addresses: Vec<String> = address_filter.into_iter().collect();

        // Prepare logs filter - topics vector:
        // topic0 = event signature
        // topic1 = indexed tokenId (wildcard = None to get all)
        // topic2 = indexed owner (wildcard)
        let get_logs_args = GetLogsArgs {
            fromBlock: Some(BlockTag::Number(Nat::from(from_block))),
            toBlock: Some(BlockTag::Number(Nat::from(to_block))),
            addresses: addresses.clone(),
            topics: Some(vec![
                Some(burn_event_signature),
                None, // wildcard for tokenId indexed topic
                None, // wildcard for owner indexed topic
            ]),
        };

        let rpc_providers = RpcServices::Custom {
            chainId: 11155111, // Sepolia testnet chain id
            services: vec![
                RpcApi {
                    url: "https://ethereum-sepolia-rpc.publicnode.com".to_string(), // Primary: Most reliable
                    headers: None,
                },
                RpcApi {
                    url: "https://sepolia.infura.io/v3/5149c676c7f9427eb71d094efdb9788b"
                        .to_string(), // Backup: Infura
                    headers: None,
                },
            ],
        };

        let cycles = 100_000_000_000u128;

        // Call eth_getLogs RPC with payment cycles
        let (result,) = ic_cdk::api::call::call_with_payment128::<
            (RpcServices, Option<RpcConfig>, GetLogsArgs),
            (MultiGetLogsResult,),
        >(
            self.evm_rpc.0,
            "eth_getLogs",
            (rpc_providers, None, get_logs_args),
            cycles,
        )
        .await
        .map_err(|e| format!("🧨 Call failed: {:?}", e))?;

        let logs = match result {
            MultiGetLogsResult::Consistent(GetLogsResult::Ok(logs)) => logs,
            MultiGetLogsResult::Consistent(GetLogsResult::Err(e)) => {
                return Err(format!("❌ RPC error (burn logs): {:?}", e));
            }
            MultiGetLogsResult::Inconsistent(inc) => {
                return Err(format!("⚠ Inconsistent burn logs result: {:?}", inc));
            }
        };

        let mut burn_log_summaries = Vec::new();
        let mut failed_tx_hashes = HashSet::new();

        for log_entry in &logs {
            let tx_hash = log_entry
                .transactionHash
                .clone()
                .unwrap_or_else(|| "N/A".to_string());
            let block_num = log_entry
                .blockNumber
                .clone()
                .map(|n| n.to_string())
                .unwrap_or_else(|| "N/A".to_string());

            // Decode the event from topics and data (full expanded event)
            if let Some((
                token_id,
                owner,
                name,
                description,
                image,
                price,
                for_sale,
                created_at,
                destination_chain,
                destination_address,
                timestamp,
            )) = Self::decode_nft_burn_event_from_log(&log_entry.topics, &log_entry.data)
            {
                ic_cdk::println!("🔥 Burn Event Decoded:");
                ic_cdk::println!("  Tx Hash: {}", tx_hash);
                ic_cdk::println!("  Token ID: {}", token_id);
                ic_cdk::println!("  Owner: {}", owner);
                ic_cdk::println!("  Name: {}", name);
                ic_cdk::println!("  Description: {}", description);
                ic_cdk::println!("  Image: {}", image);
                ic_cdk::println!("  Price: {}", price);
                ic_cdk::println!("  For Sale: {}", for_sale);
                ic_cdk::println!("  Created At: {}", created_at);
                ic_cdk::println!("  Destination Chain: {}", destination_chain);
                ic_cdk::println!("  Destination Address: {}", destination_address);
                ic_cdk::println!("  Timestamp: {}", timestamp);

                // Automatically mint NFT on ICP (or bridge logic)
                ic_cdk::println!("🔥 Attempting to mint NFT from burn event...");

                // Use canister's own principal ID for minting (not destination address)
                let canister_principal = ic_cdk::api::id();
                ic_cdk::println!(
                    "🏭 Using canister principal for minting: {}",
                    canister_principal
                );

                // Create the account for minting (to canister itself)
                let to_account = Account {
                    owner: canister_principal,
                    subaccount: None,
                };

                // Create metadata for the bridged NFT, using all decoded metadata
                let metadata = vec![
                    ("name".to_string(), MetadataValue::Text(name.clone())),
                    (
                        "description".to_string(),
                        MetadataValue::Text(description.clone()),
                    ),
                    ("image".to_string(), MetadataValue::Text(image.clone())),
                    ("price".to_string(), MetadataValue::Text(price.to_string())),
                    (
                        "forSale".to_string(),
                        MetadataValue::Text(for_sale.to_string()),
                    ),
                    (
                        "createdAt".to_string(),
                        MetadataValue::Text(created_at.to_string()),
                    ),
                    (
                        "evm_token_id".to_string(),
                        MetadataValue::Text(token_id.to_string()),
                    ),
                    (
                        "evm_tx_hash".to_string(),
                        MetadataValue::Text(tx_hash.clone()),
                    ),
                    (
                        "bridge_timestamp".to_string(),
                        MetadataValue::Text(timestamp.to_string()),
                    ),
                    (
                        "source_chain".to_string(),
                        MetadataValue::Text("EVM".to_string()),
                    ),
                    (
                        "destination_chain".to_string(),
                        MetadataValue::Text(destination_chain.clone()),
                    ),
                    (
                        "to_address".to_string(),
                        MetadataValue::Text(destination_address.clone()),
                    ),
                    (
                        "original_recipient".to_string(),
                        MetadataValue::Text(destination_address.clone()),
                    ),
                ];

                // Construct MintArgs
                let mint_args = MintArgs {
                    to: to_account,
                    token_id: Nat::from(token_id),
                    metadata,
                    memo: Some(format!("Bridge from EVM: {}", tx_hash).into_bytes()),
                    created_at_time: Some(timestamp),
                };

                ic_cdk::println!("Minting NFTs {:?}", mint_args);

                // Call icrc7_mint function directly (your mint logic)
                match icrc7_mint(vec![mint_args]).await {
                    results => {
                        if let Some(result) = results.first() {
                            match result {
                                Ok(token_id) => {
                                    ic_cdk::println!(
                                        "✅ Successfully minted bridged NFT with token ID: {}",
                                        token_id
                                    );

                                    // Call mint_nft_release on your Solidity contract passing the required data
                                    // Assuming 'self' has the method call_mint_nft_release and you have access here
                                    // Also assuming 'destination_address', 'name', 'description', 'image', and 'price' are in scope

                                    let owner = destination_address.clone(); // from decoded event
                                                                             // price is u64 from the decoded burn event

                                    // Note: If you are inside an async context, await the call
                                    match self
                                        .call_mint_nft_release(
                                            owner,
                                            name,
                                            description,
                                            image,
                                            price,
                                        )
                                        .await
                                    {
                                        Ok(sol_token_id) => {
                                            ic_cdk::println!("✅ Called mint_nft_release successfully, Solidity minted token ID: {}", sol_token_id);
                                        }
                                        Err(err) => {
                                            ic_cdk::println!(
                                                "❌ Failed to call mint_nft_release: {}",
                                                err
                                            );
                                        }
                                    }
                                }
                                Err(e) => {
                                    ic_cdk::println!("❌ Failed to mint bridged NFT: {}", e);
                                }
                            }
                        }
                    }
                }

                burn_log_summaries.push(format!(
                    "Tx: {}, Block: {}, TokenID: {}, DestChain: {}, DestAddr: {}, Timestamp: {}",
                    tx_hash, block_num, token_id, destination_chain, owner, timestamp
                ));
            } else {
                if !failed_tx_hashes.contains(&tx_hash) {
                    ic_cdk::println!("❌ Failed to decode burn event for Tx: {}", tx_hash);
                    failed_tx_hashes.insert(tx_hash.clone());
                }
                burn_log_summaries.push(format!(
                    "Tx: {}, Block: {}, Failed to decode burn event",
                    tx_hash, block_num
                ));
            }
        }

        ic_cdk::println!(
            "✅ fetch_burn_logs completed with {} entries",
            burn_log_summaries.len()
        );

        Ok(burn_log_summaries)
    }

    pub async fn fetch_burn_logs_reverse(
        &self,
        from_block: u64,
        to_block: u64,
    ) -> Result<Vec<String>, String> {
        ic_cdk::println!(
            "🚀 Starting fetch_burn_logs_reverse (Holesky to Sepolia) from block {} to {}",
            from_block,
            to_block
        );

        // Keccak256 hash of the event signature:
        // "NftBurned(uint256,address,string,string,string,uint256,bool,uint256,string,string,uint256)"
        let burn_event_signature =
            "0x07b32c84e3143702733f3d50b8967a78251a88f50e458d5255e81dc0158d1112".to_string();

        // Prepare logs filter - topics vector:
        // topic0 = event signature
        // topic1 = indexed tokenId (wildcard = None to get all)
        // topic2 = indexed owner (wildcard)
        let get_logs_args = GetLogsArgs {
            fromBlock: Some(BlockTag::Number(Nat::from(from_block))),
            toBlock: Some(BlockTag::Number(Nat::from(to_block))),
            addresses: vec!["0x027315bad2c06b0ab2a4f31c6b4b162f798a3b31".to_string()], // Holesky contract address filter
            topics: Some(vec![
                Some(burn_event_signature),
                None, // wildcard for tokenId indexed topic
                None, // wildcard for owner indexed topic
            ]),
        };

        let rpc_providers = RpcServices::Custom {
            chainId: 17000, // Holesky testnet chain id
            services: vec![
                RpcApi {
                    url: "https://eth-holesky.g.alchemy.com/v2/OLoCeG14N_MLxJ5tFvD-k67DHU4Xc-ig"
                        .to_string(), // Primary: Alchemy
                    headers: None,
                },
                RpcApi {
                    url: "https://holesky.drpc.org".to_string(), // Backup: DRPC
                    headers: None,
                },
            ],
        };

        let cycles = 100_000_000_000u128;

        // Call eth_getLogs RPC with payment cycles
        let (result,) = ic_cdk::api::call::call_with_payment128::<
            (RpcServices, Option<RpcConfig>, GetLogsArgs),
            (MultiGetLogsResult,),
        >(
            self.evm_rpc.0,
            "eth_getLogs",
            (rpc_providers, None, get_logs_args),
            cycles,
        )
        .await
        .map_err(|e| format!("🧨 Call failed: {:?}", e))?;

        let logs = match result {
            MultiGetLogsResult::Consistent(GetLogsResult::Ok(logs)) => logs,
            MultiGetLogsResult::Consistent(GetLogsResult::Err(e)) => {
                return Err(format!("❌ RPC error (burn logs): {:?}", e));
            }
            MultiGetLogsResult::Inconsistent(inc) => {
                return Err(format!("⚠ Inconsistent burn logs result: {:?}", inc));
            }
        };

        let mut burn_log_summaries = Vec::new();
        let mut failed_tx_hashes = HashSet::new();

        for log_entry in &logs {
            let tx_hash = log_entry
                .transactionHash
                .clone()
                .unwrap_or_else(|| "N/A".to_string());
            let block_num = log_entry
                .blockNumber
                .clone()
                .map(|n| n.to_string())
                .unwrap_or_else(|| "N/A".to_string());

            // Decode the event from topics and data (full expanded event)
            if let Some((
                token_id,
                owner,
                name,
                description,
                image,
                price,
                for_sale,
                created_at,
                destination_chain,
                destination_address,
                timestamp,
            )) = Self::decode_nft_burn_event_from_log(&log_entry.topics, &log_entry.data)
            {
                ic_cdk::println!("  Tx Hash: {}", tx_hash);
                ic_cdk::println!("  Token ID: {}", token_id);
                ic_cdk::println!("  Owner: {}", owner);
                ic_cdk::println!("  Name: {}", name);
                ic_cdk::println!("  Description: {}", description);
                ic_cdk::println!("  Image: {}", image);
                ic_cdk::println!("  Price: {}", price);
                ic_cdk::println!("  For Sale: {}", for_sale);
                ic_cdk::println!("  Created At: {}", created_at);
                ic_cdk::println!("  Destination Chain: {}", destination_chain);
                ic_cdk::println!("  Destination Address: {}", destination_address);
                ic_cdk::println!("  Timestamp: {}", timestamp);

                // For reverse flow, we need to release NFT on Sepolia
                ic_cdk::println!(
                    "🔥 Attempting to release NFT on Sepolia from Holesky burn event..."
                );

                // Call mint_nft_release on Sepolia contract
                match self
                    .call_mint_nft_release_sepolia(owner.clone(), name, description, image, price)
                    .await
                {
                    Ok(sol_token_id) => {
                        ic_cdk::println!(
                            "✅ Called mint_nft_release on Sepolia successfully, token ID: {}",
                            sol_token_id
                        );
                    }
                    Err(err) => {
                        ic_cdk::println!("❌ Failed to call mint_nft_release on Sepolia: {}", err);
                    }
                }

                burn_log_summaries.push(format!(
                    "Tx: {}, Block: {}, TokenID: {}, DestChain: {}, DestAddr: {}, Timestamp: {}",
                    tx_hash, block_num, token_id, destination_chain, owner, timestamp
                ));
            } else {
                if !failed_tx_hashes.contains(&tx_hash) {
                    ic_cdk::println!("❌ Failed to decode burn event for Tx: {}", tx_hash);
                    failed_tx_hashes.insert(tx_hash.clone());
                }
                burn_log_summaries.push(format!(
                    "Tx: {}, Block: {}, Failed to decode burn event",
                    tx_hash, block_num
                ));
            }
        }

        ic_cdk::println!(
            "✅ fetch_burn_logs_reverse completed with {} entries",
            burn_log_summaries.len()
        );

        Ok(burn_log_summaries)
    }

    /// Decode the full expanded `NftBurned` event log given raw topics and data from an Ethereum log
    fn decode_nft_burn_event_from_log(
        topics: &Vec<String>,
        data: &str,
    ) -> Option<(
        u64,    // tokenId
        String, // owner
        String, // name
        String, // description
        String, // image
        u64,    // price
        bool,   // forSale
        u64,    // createdAt
        String, // destinationChain
        String, // destinationAddress
        u64,    // timestamp
    )> {
        // The topics vector should have at least 3 elements: [event signature, tokenId, owner]
        if topics.len() < 3 {
            return None;
        }

        // Decode tokenId from topic[1] (uint256, 32 bytes)
        let token_id_bytes = hex_decode(topics[1].trim_start_matches("0x")).ok()?;
        if token_id_bytes.len() != 32 {
            return None;
        }
        let token_id = {
            let mut arr = [0u8; 8];
            arr.copy_from_slice(&token_id_bytes[24..32]); // last 8 bytes as big endian u64
            u64::from_be_bytes(arr)
        };

        // Decode owner address from topic[2] (address - last 20 bytes of 32-byte topic)
        let owner_bytes = hex_decode(topics[2].trim_start_matches("0x")).ok()?;
        if owner_bytes.len() != 32 {
            return None;
        }
        let owner_addr = &owner_bytes[12..32]; // last 20 bytes
        let owner_str = format!("0x{}", hex::encode(owner_addr));

        // Decode non-indexed parameters from "data" field
        let data_bytes = hex_decode(data.trim_start_matches("0x")).ok()?;
        if data_bytes.is_empty() {
            return None;
        }

        // Order and types correspond to Solidity event non-indexed params:
        // string name, string description, string image,
        // uint256 price, bool forSale, uint256 createdAt,
        // string destinationChain, string destinationAddress, uint256 timestamp
        let param_types = vec![
            ParamType::String,    // name
            ParamType::String,    // description
            ParamType::String,    // image
            ParamType::Uint(256), // price
            ParamType::Bool,      // forSale
            ParamType::Uint(256), // createdAt
            ParamType::String,    // destinationChain
            ParamType::String,    // destinationAddress
            ParamType::Uint(256), // timestamp
        ];

        let tokens = decode(&param_types, &data_bytes).ok()?;

        let name = match &tokens[0] {
            Token::String(s) => s.clone(),
            _ => return None,
        };
        let description = match &tokens[1] {
            Token::String(s) => s.clone(),
            _ => return None,
        };
        let image = match &tokens[2] {
            Token::String(s) => s.clone(),
            _ => return None,
        };
        let price = match &tokens[3] {
            Token::Uint(n) => n.as_u64(),
            _ => return None,
        };
        let for_sale = match &tokens[4] {
            Token::Bool(b) => *b,
            _ => return None,
        };
        let created_at = match &tokens[5] {
            Token::Uint(n) => n.as_u64(),
            _ => return None,
        };
        let destination_chain = match &tokens[6] {
            Token::String(s) => s.clone(),
            _ => return None,
        };
        let destination_address = match &tokens[7] {
            Token::String(s) => s.clone(),
            _ => return None,
        };
        let timestamp = match &tokens[8] {
            Token::Uint(n) => n.as_u64(),
            _ => return None,
        };

        Some((
            token_id,
            owner_str,
            name,
            description,
            image,
            price,
            for_sale,
            created_at,
            destination_chain,
            destination_address,
            timestamp,
        ))
    }

    pub fn start_periodic_fetch(&self) {
        let service_clone = self.clone();

        // Just run once immediately, no interval
        ic_cdk::spawn(async move {
            service_clone.fetch_logs_and_update_time().await;
        });

        // No timer_id needed anymore
        *self.timer_id.borrow_mut() = None;
    }

    pub fn start_periodic_fetch_reverse(&self) {
        let service_clone = self.clone();

        // Just run once immediately, no interval
        ic_cdk::spawn(async move {
            ic_cdk::println!("start_periodic_fetch_reverse");
            service_clone.fetch_logs_and_update_time_reverse().await;
        });

        // No timer_id needed anymore
        *self.timer_id.borrow_mut() = None;
    }

    pub async fn fetch_logs_and_update_time(&self) {
        ic_cdk::println!("start_monitoring.");

        // Read the last checked block number
        let from_block = BLOCK_NUMBER.with(|block_num: &RefCell<u64>| *block_num.borrow());
        ic_cdk::println!("Read BLOCK_NUMBER: {}", from_block);

        // Build RPC call
        ic_cdk::println!("About to call eth_get_block_by_number");

        let rpc_services = RpcServices::Custom {
            chainId: 11155111,
            services: vec![
                RpcApi {
                    url: "https://ethereum-sepolia-rpc.publicnode.com".to_string(), // Primary: Most reliable
                    headers: None,
                },
                RpcApi {
                    url: "https://sepolia.infura.io/v3/5149c676c7f9427eb71d094efdb9788b"
                        .to_string(), // Backup: Infura
                    headers: None,
                },
            ],
        };

        let cycles = 8_000_000_000_000u128;

        // Only call once
        let result: Result<(MultiGetBlockByNumberResult,), _> =
            call_with_payment128::<(RpcServices, (), BlockTag), (MultiGetBlockByNumberResult,)>(
                self.evm_rpc.0,
                "eth_getBlockByNumber",
                (rpc_services, (), BlockTag::Latest),
                cycles,
            )
            .await;

        // Handle result in a single match
        let highest_block_number: u64 = match result {
            Ok((multi_result,)) => match multi_result {
                MultiGetBlockByNumberResult::Consistent(GetBlockByNumberResult::Ok(block)) => {
                    ic_cdk::println!("✅ Block result OK, extracting number");
                    Self::nat_to_u64(block.number)
                }
                MultiGetBlockByNumberResult::Consistent(GetBlockByNumberResult::Err(err)) => {
                    ic_cdk::println!("❌ Error inside block result: {:?}", err);
                    return;
                }
                MultiGetBlockByNumberResult::Inconsistent(providers) => {
                    ic_cdk::println!("⚠ Inconsistent provider response: {:?}", providers);
                    return;
                }
            },
            Err((code, msg)) => {
                ic_cdk::println!("❌ Canister call failed: {:?} - {}", code, msg);
                return;
            }
        };

        // Continue logic
        ic_cdk::println!(
            "highest_block_number: {}, from_block: {}",
            highest_block_number,
            from_block
        );

        let to_block = from_block + 99; // Reduced range for better RPC compatibility
                                        // let to_block = if highest_block_number > (from_block + 499) {
                                        //     from_block + 499
                                        // } else {
                                        //     highest_block_number
                                        // };

        // 8841826 > 8842202
        ic_cdk::println!(
            "Fetching logs from_block: {}, to_block: {}",
            from_block,
            to_block
        );

        BLOCK_NUMBER.with(|block_num| {
            *block_num.borrow_mut() = to_block;
        });

        if let Err(e) = self
            .fetch_burn_logs(
                from_block,
                to_block,
                Some("0x800e11fb1f4c9b33eab0dd7aae19c2ae741be30c".to_string()),
            )
            .await
        {
            ic_cdk::println!("Error fetching logs: {}", e);
            return;
        }

        ic_cdk::println!("✅ fetch_logs completed successfully");
    }

    pub async fn fetch_logs_and_update_time_reverse(&self) {
        ic_cdk::println!("start_monitoring_reverse (Holesky to Sepolia).");

        // Read the last checked block number
        let from_block = BLOCK_NUMBER.with(|block_num: &RefCell<u64>| *block_num.borrow());
        ic_cdk::println!("Read BLOCK_NUMBER: {}", from_block);

        // Build RPC call for Holesky
        ic_cdk::println!("About to call eth_get_block_by_number on Holesky");

        let rpc_services = RpcServices::Custom {
            chainId: 17000, // Holesky chain ID
            services: vec![
                RpcApi {
                    url: "https://eth-holesky.g.alchemy.com/v2/OLoCeG14N_MLxJ5tFvD-k67DHU4Xc-ig"
                        .to_string(), // Primary: Alchemy
                    headers: None,
                },
                RpcApi {
                    url: "https://holesky.drpc.org".to_string(), // Backup: DRPC
                    headers: None,
                },
            ],
        };

        let cycles = 8_000_000_000_000u128;

        // Only call once
        let result: Result<(MultiGetBlockByNumberResult,), _> =
            call_with_payment128::<(RpcServices, (), BlockTag), (MultiGetBlockByNumberResult,)>(
                self.evm_rpc.0,
                "eth_getBlockByNumber",
                (rpc_services, (), BlockTag::Latest),
                cycles,
            )
            .await;

        // Handle result in a single match
        let highest_block_number: u64 = match result {
            Ok((multi_result,)) => match multi_result {
                MultiGetBlockByNumberResult::Consistent(GetBlockByNumberResult::Ok(block)) => {
                    ic_cdk::println!("✅ Block result OK, extracting number");
                    Self::nat_to_u64(block.number)
                }
                MultiGetBlockByNumberResult::Consistent(GetBlockByNumberResult::Err(err)) => {
                    ic_cdk::println!("❌ Error inside block result: {:?}", err);
                    return;
                }
                MultiGetBlockByNumberResult::Inconsistent(providers) => {
                    ic_cdk::println!("⚠ Inconsistent provider response: {:?}", providers);
                    return;
                }
            },
            Err((code, msg)) => {
                ic_cdk::println!("❌ Canister call failed: {:?} - {}", code, msg);
                return;
            }
        };

        // Continue logic
        ic_cdk::println!(
            "highest_block_number_HOLESKY: {}, from_block: {}",
            highest_block_number,
            from_block
        );

        let to_block = from_block + 7;
        // let to_block = if highest_block_number > (from_block + 499) {
        //     from_block + 499
        // } else {
        //     highest_block_number
        // };

        ic_cdk::println!(
            "Fetching logs from_block: {}, to_block: {}",
            from_block,
            to_block
        );

        BLOCK_NUMBER.with(|block_num| {
            *block_num.borrow_mut() = to_block;
        });

        if let Err(e) = self.fetch_burn_logs_reverse(from_block, to_block).await {
            ic_cdk::println!("Error fetching logs: {}", e);
            return;
        }

        ic_cdk::println!("✅ fetch_logs_reverse completed successfully");
    }

    pub fn nat_to_u64(nat: Nat) -> u64 {
        use num_traits::cast::ToPrimitive;
        nat.0
            .to_u64()
            .unwrap_or_else(|| ic_cdk::trap(&format!("Nat {} doesn't fit into a u64", nat)))
    }

    // TRANSACTION_MAP.with(|map| {
    //     let map = map.borrow();
    //     for (txn_hash, txn_details) in map.iter() {
    //         ic_cdk::println!(
    //             "Transaction Hash: {}, From: {}, To: {}, Amount: {}, Src Chain ID: {}, Dest Chain ID: {}, Block Number: {}",
    //             txn_hash,
    //             txn_details.from,
    //             txn_details.to,
    //             txn_details.amount,
    //             txn_details.src_chain_id,
    //             txn_details.dest_chain_id,
    //             txn_details.block_number
    //         );
    //     }
    // });
    fn clone(&self) -> Self {
        ChainService {
            canister_id: self.canister_id.clone(),
            evm_rpc: self.evm_rpc.clone(),
            last_checked_time: RefCell::new(*self.last_checked_time.borrow()),
            timer_id: RefCell::new(*self.timer_id.borrow()),
        }
    }
}

#[update]
pub fn update_block_number(new_block_num: u64) -> Result<String, String> {
    ic_cdk::println!("Updating block number to {}", new_block_num);
    BLOCK_NUMBER.with(|num| {
        *num.borrow_mut() = new_block_num;
    });
    Ok(format!("BLOCK_NUMBER updated to {}", new_block_num))
}

// #[derive(CandidType, Deserialize, Serialize)]
// struct StableState {
//     transaction_map: HashMap<String, TransactionDetails>,
//     transaction_map_release: HashMap<String, TransactionReleaseDetails>,
//     block_number: u64,
// }

// #[pre_upgrade]
// fn pre_upgrade() {
//     // Save the current state to stable memory
//     let transaction_map = TRANSACTION_MAP.with(|data| data.borrow().clone());
//     let transaction_map_release = TRANSACTION_MAP_RELEASE.with(|data| data.borrow().clone());
//     let block_number = BLOCK_NUMBER.with(|num| *num.borrow());

//     let state = StableState {
//         transaction_map,
//         transaction_map_release,
//         block_number,
//     };

//     ic_cdk::storage::stable_save((state,)).expect("Failed to save stable state");
// }

// #[post_upgrade]
// fn post_upgrade() {
//     // Restore the state from stable memory
//     match ic_cdk::storage::stable_restore::<(StableState,)>() {
//         Ok((state,)) => {
//             // Restore the transaction map data
//             TRANSACTION_MAP.with(|data: &RefCell<HashMap<String, TransactionDetails>>| {
//                 *data.borrow_mut() = state.transaction_map
//             });

//             // Restore the transaction map release data
//             TRANSACTION_MAP_RELEASE.with(|data| *data.borrow_mut() = state.transaction_map_release);

//             BLOCK_NUMBER.with(|num| *num.borrow_mut() = state.block_number);
//         }
//         Err(e) => {
//             ic_cdk::println!("Failed to restore stable state: {:?}", e);
//         }
//     }
// }
