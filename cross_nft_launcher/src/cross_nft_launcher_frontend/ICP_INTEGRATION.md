# ICP Integration Setup

This frontend now includes integration with the Internet Computer (ICP) to automatically update block numbers when cross-chain transfers are completed.

## 🚀 Features

- **Automatic Block Number Updates**: When a cross-chain transfer is completed and a block number is retrieved, the frontend automatically calls the ICP canister's `update_block_number` function.
- **ICP Connection Testing**: Test button to verify ICP connectivity before making transfers.
- **Error Handling**: Comprehensive error handling for ICP operations.

## 📋 Prerequisites

1. **Deployed ICP Canister**: Your `cross_nft_launcher_backend` canister must be deployed and running.
2. **Canister ID**: You need the canister ID from your deployment.

## ⚙️ Configuration

### 1. Environment Variables

Create a `.env` file in the `evm/frontend-react/` directory:

```bash
# Copy the example file
cp .env.example .env
```

Edit `.env` and set your actual canister ID:

```bash
# Replace with your actual canister ID from dfx deploy
REACT_APP_CANISTER_ID=your-actual-canister-id-here

# Network Configuration (usually don't change this for local development)
REACT_APP_ICP_NETWORK=http://127.0.0.1:4943
```

### 2. Get Your Canister ID

If you haven't deployed your canister yet:

```bash
# Navigate to your ICP project
cd cross_nft_launcher

# Deploy the canister
dfx deploy

# Get the canister ID
dfx canister id cross_nft_launcher_backend
```

Copy the output and use it as your `REACT_APP_CANISTER_ID`.

## 🔧 How It Works

### 1. Cross-Chain Transfer Flow

1. **User initiates transfer** → MetaMask transaction
2. **Transaction confirmed** → Get transaction hash
3. **Wait 2 seconds** → Transaction gets mined
4. **Fetch block number** → Using Web3.js
5. **Call ICP function** → `update_block_number(blockNumber)`
6. **Display results** → Show all information to user

### 2. ICP Function Call

The frontend calls your Rust canister function:

```rust
#[update]
pub fn update_block_number(new_block_num: u64) -> Result<String, String> {
    ic_cdk::println!("Updating block number to {}", new_block_num);
    BLOCK_NUMBER.with(|num| {
        *num.borrow_mut() = new_block_num;
    });
    Ok(format!("BLOCK_NUMBER updated to {}", new_block_num))
}
```

### 3. Error Handling

- **ICP Connection Failed**: Shows error but doesn't block the transfer
- **Invalid Canister ID**: Clear error message
- **Network Issues**: Graceful fallback

## 🧪 Testing

### 1. Test ICP Connection

1. Go to "Cross-Chain Transfer" tab
2. Click the "Test ICP" button next to "Target Network"
3. Check the status message for connection result

### 2. Test Full Flow

1. **Configure canister ID** in `.env`
2. **Start your ICP canister**: `dfx start --clean`
3. **Deploy canister**: `dfx deploy`
4. **Test ICP connection** using the test button
5. **Perform a cross-chain transfer**
6. **Check console logs** for ICP function calls
7. **Verify block number** is updated on ICP

## 📊 Status Display

After a successful transfer, you'll see:

- ✅ **Success Message**: Transfer completed
- 🔗 **Transaction Hash**: Link to Etherscan
- 📦 **Block Number**: Retrieved from blockchain
- 🟣 **ICP Update**: Result from canister call
- 🔍 **Etherscan Link**: View transaction details

## 🔍 Debugging

### Console Logs

Check browser console for detailed logs:

```javascript
// Successful ICP call
Calling ICP update_block_number with block number: 12345
ICP update successful: BLOCK_NUMBER updated to 12345

// Failed ICP call
Error updating block number on ICP: Error: Canister not found
```

### Common Issues

1. **"Canister not found"**: Check your `REACT_APP_CANISTER_ID`
2. **"Network error"**: Ensure ICP network is running (`dfx start`)
3. **"Identity error"**: Check identity configuration in `icpService.js`

## 🔒 Security Notes

- **Testing Identity**: Currently uses a test seed phrase
- **Production**: Replace with proper identity management
- **Environment Variables**: Never commit real canister IDs to version control

## 📝 Next Steps

1. **Replace test identity** with proper authentication
2. **Add more ICP functions** as needed
3. **Implement retry logic** for failed ICP calls
4. **Add ICP transaction monitoring** 