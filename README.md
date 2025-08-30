# ORIGYN Cross-Chain NFT Project

## Important Setup Note

When you get your canister address by running the `generate_key_pair_evm()` function:

```rust
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
```

**You must update the Ethereum address in the Solidity contract** at [line 97 of nft.sol](https://github.com/Rachit2323/CROSS_CHAIN_NFT/blob/main/cross_nft_launcher/contracts/nft.sol#L97) so that only the canister can release the NFT.

This ensures proper authorization and security for cross-chain NFT operations.