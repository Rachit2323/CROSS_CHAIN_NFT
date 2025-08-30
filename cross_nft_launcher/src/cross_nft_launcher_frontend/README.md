# NFT Marketplace React Frontend

A modern, responsive React frontend for the NFT Marketplace with cross-chain functionality, MetaMask integration, and a beautiful UI.

## Features

### 🎨 **Modern UI/UX**
- Beautiful gradient design with glass morphism effects
- Responsive layout that works on desktop and mobile
- Smooth animations and transitions
- Dark theme with purple/pink accent colors

### 🔗 **MetaMask Integration**
- Seamless wallet connection
- Support for Sepolia and Holesky testnets
- Automatic network switching
- Real-time balance display
- Account change detection

### 🪙 **NFT Management**
- **Mint NFTs**: Create new NFTs with name, description, image URL, and price
- **Transfer NFTs**: Send NFTs to other addresses
- **Cross-Chain Burn**: Burn NFTs for cross-chain transfers with destination chain and address
- **Set Prices**: List NFTs for sale
- **Buy NFTs**: Purchase NFTs from other users
- **NFT Gallery**: View and manage your NFT collection

### 🌐 **Cross-Chain Support**
- Support for multiple destination chains (Solana, Polygon, BSC, etc.)
- Burn functionality for cross-chain transfers
- Network-specific contract addresses

## Prerequisites

- Node.js (v16 or higher)
- MetaMask browser extension
- Access to Sepolia or Holesky testnet ETH

## Installation

1. **Navigate to the frontend directory:**
   ```bash
   cd evm/frontend-react
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm start
   ```

4. **Open your browser:**
   Navigate to `http://localhost:3000`

## Configuration

### Contract Addresses
Update the contract addresses in `src/config/contract.js`:

```javascript
export const NETWORKS = {
  sepolia: {
    // ... other config
    contractAddress: 'YOUR_SEPOLIA_CONTRACT_ADDRESS',
  },
  holesky: {
    // ... other config
    contractAddress: 'YOUR_HOLESKY_CONTRACT_ADDRESS',
  },
};
```

### Environment Variables
Create a `.env` file in the frontend directory if needed:

```env
REACT_APP_DEFAULT_NETWORK=sepolia
REACT_APP_INFURA_PROJECT_ID=your_infura_project_id
```

## Usage

### 1. Connect Wallet
- Click "Connect Wallet" in the header
- Approve the MetaMask connection
- Ensure you're on Sepolia or Holesky testnet

### 2. Mint NFTs
- Navigate to the "Mint NFT" tab
- Fill in the NFT details:
  - **Name**: Up to 32 characters
  - **Description**: Up to 200 characters
  - **Image URL**: Valid image URL (up to 200 characters)
  - **Price**: ETH amount
- Click "Mint NFT" and confirm the transaction

### 3. Transfer NFTs
- Navigate to the "Cross-Chain Transfer" tab
- Choose between:
  - **Transfer NFT**: Send to another address on the same chain
  - **Cross-Chain Burn**: Burn for transfer to another blockchain

### 4. Manage NFTs
- Navigate to the "NFT Gallery" tab
- View your NFT collection
- Set prices for NFTs
- Buy NFTs from other users
- Search for specific NFTs by token ID

## Project Structure

```
src/
├── components/
│   ├── Header.js          # Navigation and wallet connection
│   ├── MintSection.js     # NFT minting interface
│   ├── TransferSection.js # Transfer and burn functionality
│   └── NFTGallery.js      # NFT management and gallery
├── context/
│   └── MetaMaskContext.js # MetaMask integration and contract functions
├── config/
│   └── contract.js        # Contract ABI and network configuration
├── App.js                 # Main application component
├── index.js              # Application entry point
└── index.css             # Global styles and Tailwind imports
```

## Key Components

### MetaMaskContext
Provides wallet connection, contract interaction, and network management:

```javascript
const {
  account,           // Connected wallet address
  currentNetwork,    // Current network (sepolia/holesky)
  connectWallet,     // Connect to MetaMask
  switchNetwork,     // Switch between networks
  mintNFT,          // Mint new NFT
  burnNFT,          // Burn NFT for cross-chain transfer
  transferNFT,      // Transfer NFT to another address
  setPrice,         // Set NFT price
  buyNFT,           // Buy NFT
  getMetadata,      // Get NFT metadata
} = useMetaMask();
```

### Contract Functions
All contract interactions are handled through the MetaMask context:

- `mintNFT(name, description, image, price)` - Mint new NFT
- `burnNFT(tokenId, destinationChain, destinationAddress)` - Burn for cross-chain transfer
- `transferNFT(to, tokenId)` - Transfer NFT to another address
- `setPrice(tokenId, price)` - Set NFT price
- `buyNFT(tokenId, price)` - Buy NFT
- `getMetadata(tokenId)` - Get NFT metadata

## Styling

The application uses:
- **Tailwind CSS** for utility-first styling
- **Lucide React** for icons
- **Custom CSS** for animations and glass effects
- **Responsive design** for all screen sizes

## Error Handling

The application includes comprehensive error handling:
- MetaMask connection errors
- Contract interaction errors
- Network switching errors
- Input validation
- Transaction status feedback

## Browser Support

- Chrome (recommended with MetaMask)
- Firefox
- Safari
- Edge

## Troubleshooting

### Common Issues

1. **MetaMask not detected**
   - Ensure MetaMask is installed and unlocked
   - Refresh the page

2. **Wrong network**
   - Switch to Sepolia or Holesky testnet in MetaMask
   - Use the network switcher in the header

3. **Transaction fails**
   - Check your ETH balance
   - Ensure you're the owner of the NFT
   - Verify the contract address is correct

4. **NFT not showing in gallery**
   - Click the "Refresh" button
   - Check if the NFT is owned by your connected address

### Development

For development and testing:

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build

# Run tests
npm test
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions:
- Check the troubleshooting section
- Review the contract documentation
- Open an issue on GitHub 