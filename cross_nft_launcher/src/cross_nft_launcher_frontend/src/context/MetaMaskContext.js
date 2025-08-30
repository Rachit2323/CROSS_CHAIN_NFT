import React, { createContext, useContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ABI, NETWORKS, DEFAULT_NETWORK } from '../config/contract';

const MetaMaskContext = createContext();

export const useMetaMask = () => {
  const context = useContext(MetaMaskContext);
  if (!context) {
    throw new Error('useMetaMask must be used within a MetaMaskProvider');
  }
  return context;
};

export const MetaMaskProvider = ({ children }) => {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);
  const [currentNetwork, setCurrentNetwork] = useState(DEFAULT_NETWORK);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [balance, setBalance] = useState('0');

  // Check if MetaMask is installed
  const isMetaMaskInstalled = () => {
    return typeof window !== 'undefined' && window.ethereum && window.ethereum.isMetaMask;
  };

  // Connect to MetaMask
  const connectWallet = async () => {
    if (!isMetaMaskInstalled()) {
      setError('MetaMask is not installed. Please install MetaMask to use this app.');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length > 0) {
        await setupProvider(accounts[0]);
      }
    } catch (err) {
      console.error('Error connecting to MetaMask:', err);
      setError('Failed to connect to MetaMask. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  // Setup provider and contract
  const setupProvider = async (accountAddress) => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      setProvider(provider);

      const network = await provider.getNetwork();
      const networkName = network.chainId === 11155111n ? 'sepolia' : 
                         network.chainId === 17000n ? 'holesky' : 'unknown';
      
      if (networkName === 'unknown') {
        setError('Please switch to Sepolia or Holesky testnet');
        return;
      }

      setCurrentNetwork(networkName);
      const contractAddress = NETWORKS[networkName].contractAddress;
      console.log(`Connected to ${networkName} network with contract address: ${contractAddress}`);
      const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, provider);
      setContract(contract);

      setAccount(accountAddress);
      await updateBalance(accountAddress, provider);
    } catch (err) {
      console.error('Error setting up provider:', err);
      setError('Failed to setup provider');
    }
  };

  // Switch network
  const switchNetwork = async (networkName) => {
    if (!isMetaMaskInstalled()) {
      setError('MetaMask is not installed');
      return;
    }

    try {
      const networkConfig = NETWORKS[networkName];
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: networkConfig.chainId }],
      });
      
      // The handleChainChanged event will automatically update the contract
      // But we can also update it immediately for better UX
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = new ethers.Contract(networkConfig.contractAddress, CONTRACT_ABI, provider);
        
        setCurrentNetwork(networkName);
        setContract(contract);
        setProvider(provider);
        
        console.log(`Switched to ${networkName} network with contract address: ${networkConfig.contractAddress}`);
        
        // Update balance for current account
        if (account) {
          await updateBalance(account, provider);
        }
      } catch (err) {
        console.error('Error updating contract after network switch:', err);
        // Don't throw error here as the chain change event will handle it
      }
    } catch (switchError) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          const networkConfig = NETWORKS[networkName];
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [networkConfig],
          });
        } catch (addError) {
          setError('Failed to add network to MetaMask');
        }
      } else {
        setError('Failed to switch network');
      }
    }
  };

  // Update balance
  const updateBalance = async (accountAddress, providerInstance) => {
    try {
      const balance = await providerInstance.getBalance(accountAddress);
      setBalance(ethers.formatEther(balance));
    } catch (err) {
      console.error('Error updating balance:', err);
    }
  };

  // Contract functions
  const mintNFT = async (name, description, image, price) => {
    if (!contract || !account) {
      throw new Error('Wallet not connected');
    }

    try {
      console.log('Getting signer...');
      const signer = await provider.getSigner();
      const contractWithSigner = contract.connect(signer);
      
      console.log('Preparing transaction...');
      const priceInWei = ethers.parseEther(price.toString());
      console.log('Price in Wei:', priceInWei.toString());
      
      // Get correct nonce to avoid nonce issues
      const nonce = await signer.getNonce();
      console.log('Using nonce:', nonce);
      
      console.log('Sending transaction...');
      const tx = await contractWithSigner.mintNFT(name, description, image, priceInWei, { nonce });
      console.log('Transaction sent:', tx.hash);
      
      console.log('Waiting for receipt...');
      const receipt = await tx.wait();
      console.log('Receipt received:', receipt);
      return receipt;
    } catch (err) {
      console.error('Error minting NFT:', err);
      
      // Handle user rejection
      if (err.code === 'ACTION_REJECTED' || err.message?.includes('User denied') || err.message?.includes('user rejected')) {
        throw new Error('Transaction was cancelled by user');
      }
      
      // Handle insufficient funds
      if (err.message?.includes('insufficient funds') || err.message?.includes('Insufficient')) {
        throw new Error('Insufficient ETH balance for gas fees');
      }
      
      // Handle other common errors
      if (err.message?.includes('execution reverted')) {
        throw new Error('Transaction failed - please check your inputs and try again');
      }
      
      throw new Error('Failed to mint NFT. Please try again.');
    }
  };

  const burnNFT = async (tokenId, destinationChain, destinationAddress) => {
    if (!contract || !account) {
      throw new Error('Wallet not connected');
    }

    try {
      const signer = await provider.getSigner();
      const contractWithSigner = contract.connect(signer);
      
      // Get correct nonce to avoid nonce issues
      const nonce = await signer.getNonce();
      console.log('Burn transaction using nonce:', nonce);
      
      const tx = await contractWithSigner.burnNFT(tokenId, destinationChain, destinationAddress, { nonce });
      const receipt = await tx.wait();
      return receipt;
    } catch (err) {
      console.error('Error burning NFT:', err);
      
      // Handle user rejection
      if (err.code === 'ACTION_REJECTED' || err.message?.includes('User denied') || err.message?.includes('user rejected')) {
        throw new Error('Transaction was cancelled by user');
      }
      
      // Handle insufficient funds
      if (err.message?.includes('insufficient funds') || err.message?.includes('Insufficient')) {
        throw new Error('Insufficient ETH balance for gas fees');
      }
      
      // Handle ownership errors
      if (err.message?.includes('Not owner') || err.message?.includes('not owner')) {
        throw new Error('You do not own this NFT');
      }
      
      // Handle other common errors
      if (err.message?.includes('execution reverted')) {
        throw new Error('Transaction failed - please check your inputs and try again');
      }
      
      throw new Error('Failed to transfer NFT. Please try again.');
    }
  };

  const transferNFT = async (to, tokenId) => {
    if (!contract || !account) {
      throw new Error('Wallet not connected');
    }

    try {
      const signer = await provider.getSigner();
      const contractWithSigner = contract.connect(signer);
      
      const tx = await contractWithSigner.transferNFT(to, tokenId);
      const receipt = await tx.wait();
      return receipt;
    } catch (err) {
      console.error('Error transferring NFT:', err);
      
      // Handle user rejection
      if (err.code === 'ACTION_REJECTED' || err.message?.includes('User denied') || err.message?.includes('user rejected')) {
        throw new Error('Transaction was cancelled by user');
      }
      
      // Handle insufficient funds
      if (err.message?.includes('insufficient funds') || err.message?.includes('Insufficient')) {
        throw new Error('Insufficient ETH balance for gas fees');
      }
      
      // Handle ownership errors
      if (err.message?.includes('Not owner') || err.message?.includes('not owner')) {
        throw new Error('You do not own this NFT');
      }
      
      // Handle invalid address
      if (err.message?.includes('invalid address') || err.message?.includes('Invalid address')) {
        throw new Error('Invalid recipient address');
      }
      
      // Handle other common errors
      if (err.message?.includes('execution reverted')) {
        throw new Error('Transaction failed - please check your inputs and try again');
      }
      
      throw new Error('Failed to transfer NFT. Please try again.');
    }
  };

  const setPrice = async (tokenId, price) => {
    if (!contract || !account) {
      throw new Error('Wallet not connected');
    }

    try {
      const signer = await provider.getSigner();
      const contractWithSigner = contract.connect(signer);
      
      const priceInWei = ethers.parseEther(price.toString());
      const tx = await contractWithSigner.setPrice(tokenId, priceInWei);
      const receipt = await tx.wait();
      return receipt;
    } catch (err) {
      console.error('Error setting price:', err);
      
      // Handle user rejection
      if (err.code === 'ACTION_REJECTED' || err.message?.includes('User denied') || err.message?.includes('user rejected')) {
        throw new Error('Transaction was cancelled by user');
      }
      
      // Handle insufficient funds
      if (err.message?.includes('insufficient funds') || err.message?.includes('Insufficient')) {
        throw new Error('Insufficient ETH balance for gas fees');
      }
      
      // Handle ownership errors
      if (err.message?.includes('Not owner') || err.message?.includes('not owner')) {
        throw new Error('You do not own this NFT');
      }
      
      // Handle other common errors
      if (err.message?.includes('execution reverted')) {
        throw new Error('Transaction failed - please check your inputs and try again');
      }
      
      throw new Error('Failed to set price. Please try again.');
    }
  };

  const buyNFT = async (tokenId, price) => {
    if (!contract || !account) {
      throw new Error('Wallet not connected');
    }

    try {
      const signer = await provider.getSigner();
      const contractWithSigner = contract.connect(signer);
      
      const priceInWei = ethers.parseEther(price.toString());
      const tx = await contractWithSigner.buyNFT(tokenId, { value: priceInWei });
      const receipt = await tx.wait();
      return receipt;
    } catch (err) {
      console.error('Error buying NFT:', err);
      
      // Handle user rejection
      if (err.code === 'ACTION_REJECTED' || err.message?.includes('User denied') || err.message?.includes('user rejected')) {
        throw new Error('Transaction was cancelled by user');
      }
      
      // Handle insufficient funds
      if (err.message?.includes('insufficient funds') || err.message?.includes('Insufficient')) {
        throw new Error('Insufficient ETH balance for purchase');
      }
      
      // Handle incorrect price
      if (err.message?.includes('Incorrect ETH amount') || err.message?.includes('incorrect amount')) {
        throw new Error('Incorrect purchase amount');
      }
      
      // Handle NFT not for sale
      if (err.message?.includes('not for sale') || err.message?.includes('Not for sale')) {
        throw new Error('This NFT is not for sale');
      }
      
      // Handle buying own NFT
      if (err.message?.includes('Cannot buy your own') || err.message?.includes('own NFT')) {
        throw new Error('You cannot buy your own NFT');
      }
      
      // Handle other common errors
      if (err.message?.includes('execution reverted')) {
        throw new Error('Transaction failed - please check your inputs and try again');
      }
      
      throw new Error('Failed to buy NFT. Please try again.');
    }
  };

  const getMetadata = async (tokenId) => {
    if (!contract) {
      throw new Error('Contract not initialized');
    }

    try {
      const metadata = await contract.getMetadata(tokenId);
      return metadata;
    } catch (err) {
      console.error('Error getting metadata:', err);
      
      // Handle network-specific errors
      if (err.code === 'CALL_EXCEPTION') {
        if (err.message?.includes('missing revert data')) {
          throw new Error(`Token ${tokenId} not found on ${currentNetwork} network`);
        }
        throw new Error(`Contract call failed on ${currentNetwork} network`);
      }
      
      // Handle other common errors
      if (err.message?.includes('execution reverted')) {
        throw new Error(`Token ${tokenId} not found or contract error on ${currentNetwork}`);
      }
      
      throw err;
    }
  };

  const getNFTsByOwner = async (ownerAddress) => {
    if (!contract) {
      throw new Error('Contract not initialized');
    }

    try {
      const nfts = await contract.getNFTsByOwner(ownerAddress);
      return nfts;
    } catch (err) {
      console.error('Error getting NFTs by owner:', err);
      throw err;
    }
  };

  // Listen for account changes
  useEffect(() => {
    if (isMetaMaskInstalled()) {
      const handleAccountsChanged = (accounts) => {
        if (accounts.length === 0) {
          setAccount(null);
          setProvider(null);
          setContract(null);
        } else if (account !== accounts[0]) {
          setupProvider(accounts[0]);
        }
      };

      const handleChainChanged = async () => {
        // Get the new network and update provider/contract
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const network = await provider.getNetwork();
          const networkName = network.chainId === 11155111n ? 'sepolia' : 
                             network.chainId === 17000n ? 'holesky' : 'unknown';
          
          if (networkName === 'unknown') {
            setError('Please switch to Sepolia or Holesky testnet');
            return;
          }

          setCurrentNetwork(networkName);
          const contractAddress = NETWORKS[networkName].contractAddress;
          console.log(`Network changed to ${networkName} with contract address: ${contractAddress}`);
          
          const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, provider);
          setContract(contract);
          setProvider(provider);
          
          // Update balance for current account
          if (account) {
            await updateBalance(account, provider);
          }
        } catch (err) {
          console.error('Error handling chain change:', err);
          setError('Failed to update network configuration');
        }
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, [account]);

  // Auto-connect if already connected
  useEffect(() => {
    if (isMetaMaskInstalled() && window.ethereum.selectedAddress) {
      setupProvider(window.ethereum.selectedAddress);
    }
  }, []);

  const value = {
    account,
    provider,
    contract,
    currentNetwork,
    isConnecting,
    error,
    balance,
    isMetaMaskInstalled,
    connectWallet,
    switchNetwork,
    mintNFT,
    burnNFT,
    transferNFT,
    setPrice,
    buyNFT,
    getMetadata,
    getNFTsByOwner,
    updateBalance: () => updateBalance(account, provider),
  };

  return (
    <MetaMaskContext.Provider value={value}>
      {children}
    </MetaMaskContext.Provider>
  );
}; 