use crate::evm_nft_indexer::{ChainService, CHAIN_SERVICE};
use candid::{CandidType, Deserialize, Nat, Principal};
use ic_cdk::api::{caller, id, time};
use ic_cdk::{export_candid, init, query, update};
use serde::Serialize;
use std::cell::RefCell;
use std::collections::{BTreeMap, HashMap};
use std::time::Duration;

mod release_nft;

mod evm_nft_indexer;
mod evm_rpc_bindings;

#[ic_cdk::update]
pub async fn evm_monitor() {
    ic_cdk::println!("LOOOGGGGGGGING - Initializing canister");

    // Initialize the service
    CHAIN_SERVICE.with(|cs| {
        *cs.borrow_mut() = Some(ChainService::new("7hfb6-caaaa-aaaar-qadga-cai".to_string()));
    });
    ic_cdk::println!(
        "CHAIN_SERVICE: {:?}",
        CHAIN_SERVICE.with(|cs| cs.borrow().clone())
    );
    // Start automatic monitoring

    ic_cdk::println!("Canister initialization complete");
}

#[update]
pub async fn monitor_evm_nft() {
    evm_monitor().await;
    CHAIN_SERVICE.with(|maybe_service| {
        if let Some(service) = maybe_service.borrow().as_ref() {
            service.start_periodic_fetch();
        } else {
            ic_cdk::println!("ChainService is not initialized");
        }
    });
}

#[ic_cdk::update]
pub async fn monitor_evm_nft_reverse() {
    evm_monitor().await;
    ic_cdk::println!("monitor_evm_nft_reverse");
    CHAIN_SERVICE.with(|maybe_service| {
        if let Some(service) = maybe_service.borrow().as_ref() {
            service.start_periodic_fetch_reverse();
        } else {
            ic_cdk::println!("ChainService is not initialized");
        }
    });
}

#[ic_cdk::update]
pub async fn holesky_txn() -> Result<String, String> {
    release_nft::holesky_txn().await
}

#[ic_cdk::update]
pub async fn sepolia_txn() -> Result<String, String> {
    release_nft::sepolia_txn().await
}

#[derive(CandidType, Deserialize, Clone, Debug, Serialize)]
pub enum Value {
    Blob(Vec<u8>),
    Text(String),
    Nat(Nat),
    Int(i128),
    Array(Vec<Value>),
    Map(Vec<(String, Value)>),
}

// ICRC-7 Types
#[derive(CandidType, Deserialize, Clone, Debug, Serialize)]
pub struct Account {
    pub owner: Principal,
    pub subaccount: Option<Vec<u8>>,
}

#[derive(CandidType, Deserialize, Clone, Debug, Serialize)]
pub struct Token {
    pub token_id: Nat,
    pub owner: Account,
    pub metadata: Vec<(String, Value)>,
    pub created_at: u64,
}

// Legacy MetadataValue for backward compatibility
#[derive(CandidType, Deserialize, Clone, Debug, Serialize)]
pub enum MetadataValue {
    Text(String),
    Blob(Vec<u8>),
    Nat(Nat),
    Int(i128),
}

impl From<MetadataValue> for Value {
    fn from(metadata_value: MetadataValue) -> Self {
        match metadata_value {
            MetadataValue::Text(t) => Value::Text(t),
            MetadataValue::Blob(b) => Value::Blob(b),
            MetadataValue::Nat(n) => Value::Nat(n),
            MetadataValue::Int(i) => Value::Int(i),
        }
    }
}

// ICRC-37 Types (Full Standard Compliance)
#[derive(CandidType, Deserialize, Clone, Debug, Serialize)]
pub struct ApprovalInfo {
    pub spender: Account,
    pub from_subaccount: Option<Vec<u8>>,
    pub expires_at: Option<u64>,
    pub memo: Option<Vec<u8>>,
    pub created_at_time: u64,
}

#[derive(CandidType, Deserialize, Clone, Debug, Serialize)]
pub struct TokenApproval {
    pub token_id: Nat,
    pub approval_info: ApprovalInfo,
}

pub type CollectionApproval = ApprovalInfo;

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct TransferFromArg {
    pub spender_subaccount: Option<Vec<u8>>,
    pub from: Account,
    pub to: Account,
    pub token_id: Nat,
    pub memo: Option<Vec<u8>>,
    pub created_at_time: Option<u64>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum TransferFromError {
    InvalidRecipient,
    Unauthorized,
    NonExistingTokenId,
    TooOld,
    CreatedInFuture { ledger_time: u64 },
    Duplicate { duplicate_of: Nat },
    GenericError { error_code: Nat, message: String },
    GenericBatchError { error_code: Nat, message: String },
}

// Legacy types for backward compatibility
#[derive(CandidType, Deserialize, Clone, Debug, Serialize)]
pub struct Approval {
    pub token_id: Nat,
    pub from: Account,
    pub spender: Account,
    pub created_at: u64,
    pub expires_at: Option<u64>,
    pub memo: Option<Vec<u8>>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct ApprovalArgs {
    pub token_id: Nat,
    pub spender: Account,
    pub from_subaccount: Option<Vec<u8>>,
    pub expires_at: Option<u64>,
    pub memo: Option<Vec<u8>>,
    pub created_at_time: Option<u64>,
}

// ICRC-3 Transaction Types
#[derive(CandidType, Deserialize, Clone, Debug, Serialize)]
pub struct Transaction {
    pub index: Nat,
    pub timestamp: u64,
    pub transaction_type: TransactionType,
    pub memo: Option<Vec<u8>>,
}

// Global state using RefCell for simplicity
thread_local! {
    static TOKENS: RefCell<HashMap<String, Token>> = RefCell::new(HashMap::new());

    static TOKEN_APPROVALS: RefCell<HashMap<String, TokenApproval>> = RefCell::new(HashMap::new());

    static TRANSACTIONS: RefCell<HashMap<String, Transaction>> = RefCell::new(HashMap::new());

    static TRANSACTION_COUNTER: RefCell<u64> = RefCell::new(0);

}

#[update]
async fn icrc7_mint(args: Vec<MintArgs>) -> Vec<Result<Nat, String>> {
    let current_time = time();

    ic_cdk::println!("Minting NFTs {:?}", args);
    let mut results = Vec::new();
    for arg in args {
        results.push(process_mint(current_time, arg).await);
    }
    results
}

#[derive(CandidType, Deserialize, Clone, Debug, Serialize)]
pub enum TransactionType {
    Mint {
        to: Account,
        token_id: Nat,
    },
    Transfer {
        from: Account,
        to: Account,
        token_id: Nat,
    },
    Approve {
        from: Account,
        spender: Account,
        token_id: Nat,
    },
    Burn {
        from: Account,
        token_id: Nat,
    },
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct MintArgs {
    pub to: Account,
    pub token_id: Nat,
    pub metadata: Vec<(String, MetadataValue)>,
    pub memo: Option<Vec<u8>>,
    pub created_at_time: Option<u64>,
}

async fn process_mint(current_time: u64, args: MintArgs) -> Result<Nat, String> {
    let token_id = args.token_id;
    let metadata: Vec<(String, Value)> = args
        .metadata
        .into_iter()
        .map(|(key, value)| (key, Value::from(value)))
        .collect();

    let token = Token {
        token_id: token_id.clone(),
        owner: args.to.clone(),
        metadata,
        created_at: current_time,
    };

    // Store the token
    TOKENS.with(|tokens| {
        tokens.borrow_mut().insert(token_id.to_string(), token);
    });

    // Record transaction
    record_transaction(
        TransactionType::Mint {
            to: args.to,
            token_id: token_id.clone(),
        },
        args.memo,
    );

    Ok(token_id)
}

fn record_transaction(transaction_type: TransactionType, memo: Option<Vec<u8>>) -> Nat {
    TRANSACTION_COUNTER.with(|counter| {
        let mut counter = counter.borrow_mut();
        *counter += 1;
        let transaction_id = Nat::from(*counter);

        let transaction = Transaction {
            index: transaction_id.clone(),
            timestamp: time(),
            transaction_type,
            memo,
        };

        TRANSACTIONS.with(|transactions| {
            transactions
                .borrow_mut()
                .insert(counter.to_string(), transaction);
        });

        transaction_id
    })
}

// Simple greeting function (keeping your original function)
#[query]
fn greet(name: String) -> String {
    format!(
        "Hello, {}! Welcome to the Cross NFT Launcher with ICRC-7 and ICRC-37 support!",
        name
    )
}

export_candid!();
