import React, { useState, useEffect } from 'react';
import { useMetaMask } from '../context/MetaMaskContext';
import { ArrowRightLeft, Send, Loader, CheckCircle, AlertCircle, Search, ChevronDown, ExternalLink } from 'lucide-react';
import Web3 from 'web3';
import { updateBlockNumberOnICP, testICPConnection, callHoleskyTxnOnICP, callSepoliaTxnOnICP,  callMonitorEvmNftReverseOnICP ,callMonitorEvmNftOnICP} from '../services/icpService';

// Progress Bar Component
const ProgressBar = ({ currentStep, totalSteps, stepLabels, currentStatus }) => {
  const progress = (currentStep / totalSteps) * 100;
  
  return (
    <div className="w-full animate-fade-in-up">
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-medium text-blue-300">Progress: {currentStep}/{totalSteps}</span>
        <span className="text-sm text-blue-200 animate-pulse-slow">{currentStatus}</span>
      </div>
      <div className="w-full bg-gray-700/50 rounded-full h-4 overflow-hidden border border-gray-600/30">
        <div 
          className="bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 h-4 rounded-full transition-all duration-1000 ease-out shadow-lg"
          style={{ width: `${progress}%` }}
        >
          <div className="w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse-slow"></div>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {stepLabels.map((label, index) => (
          <div key={index} className={`flex items-center space-x-3 text-sm transition-all duration-300 ${
            index < currentStep ? 'text-green-400 scale-105' : 
            index === currentStep ? 'text-blue-400 scale-105' : 'text-gray-500'
          }`}>
            {index < currentStep ? (
              <div className="progress-step-complete">
                <CheckCircle size={18} className="text-green-400 drop-shadow-lg" />
              </div>
            ) : index === currentStep ? (
              <div className="progress-step-current">
                <Loader size={18} className="animate-spin-fast text-blue-400 drop-shadow-lg" />
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full border-2 border-gray-500 bg-gray-700/50"></div>
            )}
            <span className={`font-medium ${index === currentStep ? 'animate-pulse-slow' : ''}`}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const TransferSection = () => {
  const { account, currentNetwork, transferNFT, burnNFT, getMetadata } = useMetaMask();
  const [activeTab, setActiveTab] = useState('transfer');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState(null);

  // Transfer form state
  const [transferForm, setTransferForm] = useState({
    tokenId: '',
    toAddress: '',
  });

  // Burn form state
  const [burnForm, setBurnForm] = useState({
    tokenId: '',
    destinationChain: '',
    destinationAddress: '',
  });

  // NFT metadata state
  const [nftMetadata, setNftMetadata] = useState(null);
  
  // User's NFTs state - start with immediate mock data
  const [userNFTs, setUserNFTs] = useState([
    { tokenId: 'loading_1', name: 'Loading NFT #1...', description: 'Fetching data...', isSkeleton: true },
    { tokenId: 'loading_2', name: 'Loading NFT #2...', description: 'Fetching data...', isSkeleton: true },
    { tokenId: 'loading_3', name: 'Loading NFT #3...', description: 'Fetching data...', isSkeleton: true },
  ]);
  const [isLoadingNFTs, setIsLoadingNFTs] = useState(false);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  const [previousNetwork, setPreviousNetwork] = useState(currentNetwork);
  const [showNFTDropdown, setShowNFTDropdown] = useState(false);
  const [, setBlockNumber] = useState(null);
  const [isGettingBlockNumber, setIsGettingBlockNumber] = useState(false);
  const [, setHoleskyTxnHash] = useState(null);
  const [isPollingHoleskyTxn, setIsPollingHoleskyTxn] = useState(false);

  // Helper function for better network detection
  const isCurrentNetworkHolesky = () => {
    console.log('🔍 Network Detection Debug:');
    console.log('currentNetwork:', currentNetwork);
    console.log('currentNetwork type:', typeof currentNetwork);
    
    if (!currentNetwork) {
      console.log('❌ No current network');
      return false;
    }
    
    // Log all properties of currentNetwork for debugging
    console.log('currentNetwork.chainId:', currentNetwork.chainId, 'type:', typeof currentNetwork.chainId);
    console.log('currentNetwork.name:', currentNetwork.name);
    console.log('window.ethereum.chainId:', window.ethereum?.chainId);
    console.log('window.ethereum.networkVersion:', window.ethereum?.networkVersion);
    
    // Check by chain ID first (most reliable) - try multiple formats
    const chainIdChecks = [
      currentNetwork.chainId === '17000',
      currentNetwork.chainId === 17000,
      currentNetwork.chainId === '0x4268', // Hex format for 17000
      currentNetwork === '17000',
      currentNetwork === 17000,
      window.ethereum?.chainId === '0x4268',
      window.ethereum?.networkVersion === '17000'
    ];
    
    console.log('Chain ID checks:', chainIdChecks);
    
    if (chainIdChecks.some(check => check)) {
      console.log('✅ Holesky detected by chain ID');
      return true;
    }
    
    // Check by name as backup
    const nameChecks = [
      currentNetwork.name?.toLowerCase().includes('holesky'),
      currentNetwork?.toLowerCase().includes('holesky'),
      typeof currentNetwork === 'string' && currentNetwork.toLowerCase().includes('holesky')
    ];
    
    console.log('Name checks:', nameChecks);
    
    if (nameChecks.some(check => check)) {
      console.log('✅ Holesky detected by name');
      return true;
    }
    
    console.log('❌ Not detected as Holesky');
    return false;
  };

  // Progress tracking state - dynamic based on network
  const getStepLabels = () => {
    if (isCurrentNetworkHolesky()) {
      return [
        'Locking NFT on Holesky',
        'Getting block number',
        'Updating ICP block number',
        'Preparing NFT for Sepolia release',
        'NFT released on Sepolia'
      ];
    } else if (currentNetwork?.chainId === '11155111' || currentNetwork?.chainId === 11155111 || currentNetwork?.name?.toLowerCase().includes('sepolia')) {
      return [
        'Locking NFT on Sepolia',
        'Getting block number',
        'Updating ICP block number',
        'Preparing NFT for Holesky release',
        'NFT released on Holesky'
      ];
    } else {
      return [
        'Locking NFT on source network',
        'Getting block number',
        'Updating ICP block number',
        'Preparing NFT for destination network',
        'NFT released on destination'
      ];
    }
  };

  const [transferProgress, setTransferProgress] = useState({
    currentStep: 0,
    totalSteps: 5,
    stepLabels: getStepLabels(),
    currentStatus: 'Ready to start'
  });

  // Polling interval for holesky_txn
  const [pollingInterval, setPollingInterval] = useState(null);

  const handleTransferInputChange = (e) => {
    const { name, value } = e.target;
    setTransferForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleBurnInputChange = (e) => {
    const { name, value } = e.target;
    setBurnForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Function to get block number from transaction hash
  const getBlockNumberFromTxHash = async (txHash, network) => {
    try {
      let rpcUrl;
      if (network === 'sepolia') {
        rpcUrl = 'https://sepolia.infura.io/v3/5149c676c7f9427eb71d094efdb9788b';
      } else if (network === 'holesky') {
        rpcUrl = 'https://eth-holesky.g.alchemy.com/v2/OLoCeG14N_MLxJ5tFvD-k67DHU4Xc-ig';
      } else {
        throw new Error('Unsupported network');
      }

      const web3 = new Web3(rpcUrl);
      const receipt = await web3.eth.getTransactionReceipt(txHash);
      
      if (receipt && receipt.blockNumber) {
        console.log(`Block Number: ${receipt.blockNumber}`);
        return receipt.blockNumber;
      } else {
        console.log('Transaction not confirmed yet or hash is invalid.');
        return null;
      }
    } catch (error) {
      console.error('Error getting block number:', error.message);
      return null;
    }
  };

  // Function to start polling for destination transaction (network-aware)
  const startDestinationTxnPolling = () => {
    const isFromHolesky = isCurrentNetworkHolesky();
    
    // Debug logging
    console.log('🔍 Network Detection Debug:');
    console.log('currentNetwork:', currentNetwork);
    console.log('currentNetwork?.name:', currentNetwork?.name);
    console.log('currentNetwork?.chainId:', currentNetwork?.chainId);
    console.log('isFromHolesky:', isFromHolesky);
    
    const destinationNetwork = isFromHolesky ? 'Sepolia' : 'Holesky';
    const txnFunction = isFromHolesky ? callSepoliaTxnOnICP : callHoleskyTxnOnICP;
    const etherscanBaseUrl = isFromHolesky ? 'https://sepolia.etherscan.io' : 'https://holesky.etherscan.io';
    
    console.log('🎯 Transaction Function:', isFromHolesky ? 'callSepoliaTxnOnICP' : 'callHoleskyTxnOnICP');
    console.log('🎯 Destination Network:', destinationNetwork);
    console.log('🎯 Etherscan Base URL:', etherscanBaseUrl);
    
    setIsPollingHoleskyTxn(true);
    setTransferProgress(prev => ({
      ...prev,
      currentStep: 4,
      currentStatus: `Checking for NFT release on ${destinationNetwork}...`
    }));

    const interval = setInterval(async () => {
      try {
        console.log(`🔄 Polling ${destinationNetwork} transaction...`);
        const result = await txnFunction();
        console.log(`📊 Polling result for ${destinationNetwork}:`, result);
        
        if (result && result.trim() !== '' && result !== 'null') {
          console.log(`✅ SUCCESS: Found ${destinationNetwork} release transaction:`, result);
          
          setHoleskyTxnHash(result);
          setIsPollingHoleskyTxn(false);
          setTransferProgress(prev => ({
            ...prev,
            currentStep: 5,
            currentStatus: `NFT successfully released on ${destinationNetwork}!`
          }));
          
          // Update status with destination transaction hash - single comprehensive update
          setStatus(prev => ({
            ...prev,
            message: `🎉 Cross-chain transfer completed! NFT has been successfully released on ${destinationNetwork}!`,
            holeskyTxnHash: result,
            destinationNetwork,
            etherscanBaseUrl,
            type: 'success'
          }));
          
          clearInterval(interval);
          setPollingInterval(null);
          
          console.log(`🎉 Polling completed! NFT released on ${destinationNetwork} with txn hash: ${result}`);
        } else {
          // result is null, empty, or not ready yet - this is normal
          console.log(`⏳ Still waiting for ${destinationNetwork} transaction... (not ready yet)`);
        }
      } catch (error) {
        console.log(`⏳ Still waiting for ${destinationNetwork} transaction...`, error.message);
      }
    }, 3000); // Poll every 3 seconds

    setPollingInterval(interval);
  };

  // Function to stop polling
  const stopHoleskyTxnPolling = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    setIsPollingHoleskyTxn(false);
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      stopHoleskyTxnPolling();
    };
  }, []);

  const handleTransfer = async (e) => {
    e.preventDefault();
    
    if (!account) {
      setStatus({
        type: 'error',
        message: 'Please connect your wallet first'
      });
      return;
    }

    if (!transferForm.tokenId || !transferForm.toAddress) {
      setStatus({
        type: 'error',
        message: 'Please fill in all fields'
      });
      return;
    }

    setIsLoading(true);
    setStatus(null);

    try {
      const receipt = await transferNFT(transferForm.toAddress, transferForm.tokenId);
      
      setStatus({
        type: 'success',
        message: `NFT transferred successfully! Transaction hash: ${receipt.hash}`,
        hash: receipt.hash
      });

      setTransferForm({
        tokenId: '',
        toAddress: '',
      });
    } catch (error) {
      console.error('Transfer error:', error);
      setStatus({
        type: 'error',
        message: error.message || 'Failed to transfer NFT. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBurn = async (e) => {
    e.preventDefault();
    
    if (!account) {
      setStatus({
        type: 'error',
        message: 'Please connect your wallet first'
      });
      return;
    }

    if (!burnForm.tokenId || !burnForm.destinationChain || !burnForm.destinationAddress) {
      setStatus({
        type: 'error',
        message: 'Please fill in all fields'
      });
      return;
    }

    // Check if user owns the NFT
    const selectedNFT = userNFTs.find(nft => nft.tokenId.toString() === burnForm.tokenId);
    if (!selectedNFT) {
      setStatus({
        type: 'error',
        message: 'You do not own this NFT. Please select an NFT from your collection.'
      });
    }

    // Validate destination address format
    if (!burnForm.destinationAddress.startsWith('0x') || burnForm.destinationAddress.length !== 42) {
      setStatus({
        type: 'error',
        message: 'Please enter a valid Ethereum address (0x followed by 40 characters)'
      });
      return;
    }

    // Reset progress and start transfer with network-aware labels
    const stepLabels = getStepLabels();
    setTransferProgress({
      currentStep: 1,
      totalSteps: 5,
      stepLabels: stepLabels,
      currentStatus: `${stepLabels[0]}...`
    });

    setIsLoading(true);
    setStatus(null);

    try {
      const receipt = await burnNFT(
        burnForm.tokenId,
        burnForm.destinationChain,
        burnForm.destinationAddress
      );
      
      // Step 1: NFT locked successfully
      setTransferProgress(prev => ({
        ...prev,
        currentStep: 1,
        currentStatus: 'NFT locked successfully! Getting block number...'
      }));

      setStatus({
        type: 'success',
        message: `NFT #${burnForm.tokenId} "${selectedNFT.name}" successfully transferred to ${burnForm.destinationChain}! Transaction hash: ${receipt.hash}. Getting block number...`,
        hash: receipt.hash
      });

      // Wait a moment for transaction to be mined, then get block number
      setTimeout(async () => {
        setIsGettingBlockNumber(true);
        const blockNum = await getBlockNumberFromTxHash(receipt.hash, currentNetwork);
        setIsGettingBlockNumber(false);
        
        if (blockNum) {
          setBlockNumber(blockNum);
          
          // Step 2: Block number obtained
          setTransferProgress(prev => ({
            ...prev,
            currentStep: 2,
            currentStatus: 'Block number obtained! Updating ICP...'
          }));
          
          // Call ICP function to update block number
          try {
            console.log(`Calling ICP update_block_number with block number: ${blockNum}`);
            const icpResult = await updateBlockNumberOnICP(blockNum);
            console.log('ICP update successful:', icpResult);

            // Step 3: ICP updated successfully  
            const isFromHolesky = isCurrentNetworkHolesky();
            const destinationNetwork = isFromHolesky ? 'Sepolia' : 'Holesky';
            setTransferProgress(prev => ({
              ...prev,
              currentStep: 3,
              currentStatus: `ICP updated! Preparing NFT for ${destinationNetwork} release...`
            }));


            try {
              // Use appropriate function based on current network
              console.log("isFromHolesky",isFromHolesky);
              const monitorFunction = isFromHolesky ? callMonitorEvmNftReverseOnICP : callMonitorEvmNftOnICP;
              const monitorResult = await monitorFunction();
              console.log('monitor_evm_nft result:', monitorResult);
              
              // Step 4: Start monitoring for destination release
              setTransferProgress(prev => ({
                ...prev,
                currentStep: 4,
                currentStatus: `Monitoring for NFT release on ${destinationNetwork}...`
              }));

              // Start polling for holesky transaction
              startDestinationTxnPolling();

            } catch (monitorErr) {
              console.error('Error calling monitor_evm_nft:', monitorErr);
              setTransferProgress(prev => ({
                ...prev,
                currentStep: 4,
                currentStatus: `Error monitoring NFT release on ${destinationNetwork}`
              }));
            }
            
            // Handle the Result type (Ok: text | Err: text)
            let icpMessage = '';
            if (icpResult && icpResult.Ok) {
              icpMessage = icpResult.Ok;
            } else if (icpResult && icpResult.Err) {
              throw new Error(icpResult.Err);
            } else {
              icpMessage = 'Block number updated successfully';
            }

            setStatus({
              type: 'success',
              message: `NFT #${burnForm.tokenId} "${selectedNFT.name}" successfully transferred to ${burnForm.destinationChain}! Block number updated on ICP.`,
              hash: receipt.hash,
              blockNumber: blockNum,
              icpResult: icpMessage
            });
          } catch (icpError) {
            console.error('ICP update failed:', icpError);
            setTransferProgress(prev => ({
              ...prev,
              currentStep: 3,
              currentStatus: 'ICP update failed'
            }));
            setStatus({
              type: 'success',
              message: `NFT #${burnForm.tokenId} "${selectedNFT.name}" successfully transferred to ${burnForm.destinationChain}! (ICP update failed)` ,
              hash: receipt.hash,
              blockNumber: blockNum,
              icpError: icpError.message
            });
          }
        } else {
          setTransferProgress(prev => ({
            ...prev,
            currentStep: 2,
            currentStatus: 'Block number pending...'
          }));
          setStatus({
            type: 'success',
            message: `NFT #${burnForm.tokenId} "${selectedNFT.name}" successfully transferred to ${burnForm.destinationChain}! (Block number pending...)`,
            hash: receipt.hash
          });
        }
      }, 2000); // Wait 2 seconds for transaction to be mined

      setBurnForm({
        tokenId: '',
        destinationChain: '',
        destinationAddress: '',
      });
      setNftMetadata(null);
    } catch (error) {
      console.error('Cross-chain transfer error:', error);
      setTransferProgress(prev => ({
        ...prev,
        currentStep: 1,
        currentStatus: 'Transfer failed'
      }));
      setStatus({
        type: 'error',
        message: error.message || 'Failed to transfer NFT. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchNFTMetadata = async (tokenId) => {
    if (!tokenId) return;

    try {
      const metadata = await getMetadata(tokenId);
      setNftMetadata(metadata);
    } catch (error) {
      console.error('Error fetching metadata:', error);
      setNftMetadata(null);
    }
  };

  // Load from localStorage cache immediately
  const loadFromCache = () => {
    const cacheKey = `nfts_${account}_${currentNetwork}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsedCache = JSON.parse(cached);
        const cacheAge = Date.now() - parsedCache.timestamp;
        // Use cache if less than 2 minutes old (reduced from 5 minutes)
        if (cacheAge < 2 * 60 * 1000 && parsedCache.nfts.length > 0) {
          console.log('✅ Loading NFTs instantly from cache:', parsedCache.nfts.length);
          setUserNFTs(parsedCache.nfts);
          setHasInitialLoad(true);
          return true;
        } else {
          console.log('🗑️ Cache expired or empty, clearing...');
          localStorage.removeItem(cacheKey);
        }
      }
    } catch (error) {
      console.log('Cache load error:', error);
    }
    return false;
  };

  // Save to localStorage cache
  const saveToCache = (nfts) => {
    const cacheKey = `nfts_${account}_${currentNetwork}`;
    try {
      // Convert BigInt values to strings for JSON serialization
      const serializableNfts = nfts.map(nft => ({
        ...nft,
        tokenId: nft.tokenId?.toString(),
        price: nft.price?.toString(),
        createdAt: nft.createdAt?.toString()
      }));
      
      localStorage.setItem(cacheKey, JSON.stringify({
        nfts: serializableNfts,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.log('Cache save error:', error);
    }
  };
  
  // Clear cache for all networks when switching
  const clearAllCache = () => {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(`nfts_${account}_`)) {
          localStorage.removeItem(key);
          console.log(`🗑️ Cleared cache: ${key}`);
        }
      });
    } catch (error) {
      console.log('Cache clear error:', error);
    }
  };

  // FORCE REFRESH - always get fresh data
  const forceRefreshNFTs = async () => {
    if (!account || !getMetadata) {
      setUserNFTs([]);
      return;
    }
    
    console.log('🔄 FORCE REFRESH - Fetching fresh NFTs...');
    const cacheKey = `nfts_${account}_${currentNetwork}`;
    localStorage.removeItem(cacheKey); // Clear cache first
    
    setIsLoadingNFTs(true);
    setUserNFTs([]); // Clear current NFTs
    
    try {
      const foundNFTs = [];
      const maxCheck = 100; // Increased to catch new NFTs
      
      console.log(`🔍 Scanning tokens 1-${maxCheck} for account ${account}...`);
      console.log(`🏠 Your wallet address: ${account}`);
      
      // IMMEDIATE parallel fetch - all at once
      const allPromises = [];
      for (let i = 1; i <= maxCheck; i++) {
        allPromises.push(
          getMetadata(i)
            .then(metadata => {
              if (metadata?.currentOwner) {
                const isYours = metadata.currentOwner.toLowerCase() === account.toLowerCase();
                console.log(`Token ${i}: Owner: ${metadata.currentOwner}${isYours ? ' ✅ YOURS!' : ''}`);
                
                if (isYours) {
                  console.log(`🎉 Found your NFT #${i}: ${metadata.name}`);
                  return {
                    tokenId: i,
                    name: metadata.name || `NFT #${i}`,
                    description: metadata.description || 'Cross-chain NFT',
                    image: metadata.image,
                    price: metadata.price,
                    forSale: metadata.forSale,
                    currentOwner: metadata.currentOwner,
                    createdAt: metadata.createdAt
                  };
                }
              } else {
                console.log(`Token ${i}: No owner (probably doesn't exist)`);
              }
              return null;
            })
            .catch(error => {
              console.log(`Token ${i} error:`, error.message);
              return null;
            })
        );
      }
      
      // Process results as they come in - no waiting!
      const results = await Promise.allSettled(allPromises);
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          foundNFTs.push(result.value);
          
          // Update UI immediately for each NFT found
          if (foundNFTs.length === 1) {
            console.log('🎉 First NFT found, updating UI...');
            setUserNFTs([...foundNFTs]);
          } else if (foundNFTs.length % 2 === 0) {
            setUserNFTs([...foundNFTs]);
          }
        }
      });
      
      // Final update
      setUserNFTs(foundNFTs);
      setHasInitialLoad(true);
      
      // Cache results immediately
      if (foundNFTs.length >= 0) { // Cache even if empty
        saveToCache(foundNFTs);
      }
      
      console.log(`✅ FINAL RESULT: Found ${foundNFTs.length} NFTs owned by ${account}`);
      if (foundNFTs.length === 0) {
        console.log('🚨 NO NFTs FOUND - POSSIBLE ISSUES:');
        console.log('1. 📱 Wrong wallet connected?');
        console.log(`   Current: ${account}`);
        console.log(`   Expected: Check if you minted from a different wallet`);
        console.log('2. 🌐 Wrong network?');
        console.log(`   Current: ${currentNetwork} (Chain ID: ${window.ethereum?.chainId})`);
        console.log('3. ⏳ Transaction still confirming?');
        console.log('4. 🔢 Token ID higher than 100?');
        console.log('\n🔍 Try manually checking specific token IDs in the debug panel!');
      }
      
    } catch (error) {
      console.error('❌ NFT fetch error:', error);
      setUserNFTs([]);
    } finally {
      setIsLoadingNFTs(false);
    }
  };
  
  // SMART NFT loading - cache first, then refresh
  const fetchUserNFTs = async (forceRefresh = false) => {
    if (forceRefresh) {
      return forceRefreshNFTs();
    }
    
    if (!account || !getMetadata) {
      setUserNFTs([]);
      return;
    }
    
    // Try cache first for INSTANT display
    if (!hasInitialLoad) {
      const cached = loadFromCache();
      if (cached) {
        // Start background refresh after short delay
        setTimeout(() => {
          console.log('🔄 Background refresh starting...');
          forceRefreshNFTs();
        }, 1000);
        return;
      }
    }
    
    // No cache, do fresh fetch
    return forceRefreshNFTs();
  };
  

  // Network change detection and auto-refresh
  useEffect(() => {
    if (currentNetwork && previousNetwork && currentNetwork !== previousNetwork) {
      console.log(`🔄 Transfer: Network changed ${previousNetwork} → ${currentNetwork}`);
      
      // Clear all cached NFTs for this account
      clearAllCache();
      
      // Reset form and state
      setBurnForm({
        tokenId: '',
        destinationChain: '',
        destinationAddress: '',
      });
      setNftMetadata(null);
      setUserNFTs([]);
      setHasInitialLoad(false);
      
      // Load NFTs for new network if account connected
      if (account) {
        console.log(`🚀 Loading NFTs for ${currentNetwork}...`);
        setTimeout(() => {
          fetchUserNFTs(true); // Force refresh for new network
        }, 200);
      }
    }
    
    // Update previous network
    setPreviousNetwork(currentNetwork);
  }, [currentNetwork]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // MetaMask network change listener
  useEffect(() => {
    if (window.ethereum) {
      const handleChainChanged = (chainId) => {
        console.log(`🔗 Transfer: Chain changed to ${chainId}`);
        
        // Clear all caches and reset state
        clearAllCache();
        setBurnForm({
          tokenId: '',
          destinationChain: '',
          destinationAddress: '',
        });
        setNftMetadata(null);
        setUserNFTs([]);
        setHasInitialLoad(false);
        
        // Force refresh after delay
        setTimeout(() => {
          console.log(`🧹 Transfer: Refreshing NFTs for chain ${chainId}`);
          if (account) {
            fetchUserNFTs(true);
          }
        }, 500);
      };
      
      window.ethereum.on('chainChanged', handleChainChanged);
      
      return () => {
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, [account]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Account change detection
  useEffect(() => {
    if (account) {
      console.log('🚀 Account changed - loading NFTs');
      console.log('Account:', account);
      console.log('Network:', currentNetwork);
      
      // Reset state
      setHasInitialLoad(false);
      
      // Load NFTs for current account
      fetchUserNFTs(false);
      
      // Set up auto-refresh every 30 seconds to catch new NFTs
      const refreshInterval = setInterval(() => {
        console.log('🔄 Auto-refresh: Checking for new NFTs...');
        fetchUserNFTs(true); // Force refresh
      }, 30000); // 30 seconds
      
      return () => {
        clearInterval(refreshInterval);
      };
    } else {
      setUserNFTs([]);
      setHasInitialLoad(false);
    }
  }, [account]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update step labels when network changes
  useEffect(() => {
    setTransferProgress(prev => ({
      ...prev,
      stepLabels: getStepLabels()
    }));
  }, [currentNetwork]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNFTSelect = (tokenId) => {
    setBurnForm(prev => ({
      ...prev,
      tokenId: tokenId.toString()
    }));
    setShowNFTDropdown(false);
    fetchNFTMetadata(tokenId);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showNFTDropdown && !event.target.closest('.nft-dropdown-container')) {
        setShowNFTDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNFTDropdown]);

  if (!account) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card text-center">
          <div className="w-16 h-16 bg-gray-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <ArrowRightLeft size={32} className="text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Connect Wallet to Transfer</h2>
          <p className="text-gray-300">Please connect your MetaMask wallet to transfer NFTs</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Tab Navigation */}
      <div className="flex justify-center mb-8">
        <div className="flex space-x-1 bg-white/10 backdrop-blur-lg rounded-lg p-1 border border-white/20">
          <button
            onClick={() => setActiveTab('transfer')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-all duration-200 ${
              activeTab === 'transfer'
                ? 'bg-white/20 text-white shadow-lg'
                : 'text-gray-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Send size={18} />
            <span>Transfer NFT</span>
          </button>
          <button
            onClick={() => setActiveTab('burn')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-all duration-200 ${
              activeTab === 'burn'
                ? 'bg-white/20 text-white shadow-lg'
                : 'text-gray-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <ArrowRightLeft size={18} />
            <span>Cross-Chain Transfer</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Transfer Form */}
        {activeTab === 'transfer' && (
          <div className="card">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                <Send size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Transfer NFT</h2>
                <p className="text-gray-300">Transfer NFT to another address</p>
              </div>
            </div>

            <form onSubmit={handleTransfer} className="space-y-6">
              <div>
                <label htmlFor="transferTokenId" className="block text-sm font-medium text-white mb-2">
                  Token ID *
                </label>
                <input
                  type="number"
                  id="transferTokenId"
                  name="tokenId"
                  value={transferForm.tokenId}
                  onChange={handleTransferInputChange}
                  placeholder="Enter token ID"
                  className="input-field"
                  min="1"
                  required
                />
              </div>

              <div>
                <label htmlFor="toAddress" className="block text-sm font-medium text-white mb-2">
                  Recipient Address *
                </label>
                <input
                  type="text"
                  id="toAddress"
                  name="toAddress"
                  value={transferForm.toAddress}
                  onChange={handleTransferInputChange}
                  placeholder="0x..."
                  className="input-field"
                  pattern="^0x[a-fA-F0-9]{40}$"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full btn-primary flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader size={16} className="animate-spin" />
                    <span>Transferring...</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>Transfer NFT</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Burn Form */}
        {activeTab === 'burn' && (
          <div className="card">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                <ArrowRightLeft size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Cross-Chain Transfer</h2>
                <p className="text-gray-300">Transfer NFT to another blockchain</p>
              </div>
            </div>

            <form onSubmit={handleBurn} className="space-y-6">
              <div>
                <label htmlFor="burnTokenId" className="block text-sm font-medium text-white mb-2">
                  Select Your NFT *
                </label>
                <div className="relative nft-dropdown-container mb-2">
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => setShowNFTDropdown(!showNFTDropdown)}
                      className="flex-1 input-field flex items-center justify-between"
                    >
                      <span className={burnForm.tokenId ? 'text-gray-900 font-medium' : 'text-gray-600 font-medium'}>
                        {burnForm.tokenId 
                          ? `#${burnForm.tokenId} - ${userNFTs.find(nft => nft.tokenId.toString() === burnForm.tokenId)?.name || 'Unknown NFT'}`
                          : 'Select an NFT to transfer'
                        }
                      </span>
                      <ChevronDown size={16} className={`transition-transform text-gray-600 ${showNFTDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        // Clear localStorage cache and force refresh
                        const cacheKey = `nfts_${account}_${currentNetwork}`;
                        localStorage.removeItem(cacheKey);
                        setHasInitialLoad(false);
                        console.log('🔄 Force refresh - cache cleared');
                        fetchUserNFTs(true);
                      }}
                      disabled={isLoadingNFTs}
                      className="btn-secondary px-3"
                      title="Refresh NFT list"
                    >
                      <Loader size={16} className={`${isLoadingNFTs ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  
                  {showNFTDropdown && (
                    <div className="absolute z-[9999] w-full mt-1 bg-slate-900 border border-white/30 rounded-lg shadow-2xl max-h-60 overflow-y-auto animate-fade-in" style={{ top: '100%' }}>
                      {isLoadingNFTs ? (
                        <div className="p-4 text-center">
                          <Loader size={16} className="animate-spin mx-auto mb-2 text-white" />
                          <p className="text-white text-sm font-medium">Loading your NFTs...</p>
                        </div>
                      ) : userNFTs.length > 0 ? (
                        userNFTs.map((nft) => (
                          <button
                            key={nft.tokenId}
                            type="button"
                            onClick={() => !nft.isSkeleton && handleNFTSelect(nft.tokenId)}
                            disabled={nft.isSkeleton}
                            className={`w-full text-left p-3 transition-colors border-b border-white/20 last:border-b-0 ${
                              nft.isSkeleton 
                                ? 'cursor-not-allowed opacity-60' 
                                : 'hover:bg-blue-600/30'
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                nft.isSkeleton 
                                  ? 'bg-gray-600/50 animate-pulse' 
                                  : 'bg-gradient-to-r from-purple-500 to-pink-500'
                              }`}>
                                {nft.isSkeleton ? (
                                  <div className="w-6 h-4 bg-gray-500/50 rounded animate-pulse"></div>
                                ) : (
                                  <span className="text-white font-bold text-sm">#{nft.tokenId}</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                {nft.isSkeleton ? (
                                  <>
                                    <div className="h-4 bg-gray-600/50 rounded animate-pulse mb-1"></div>
                                    <div className="h-3 bg-gray-600/30 rounded animate-pulse w-2/3"></div>
                                  </>
                                ) : (
                                  <>
                                    <div className="text-white font-semibold truncate">{nft.name}</div>
                                    <div className="text-blue-200 text-sm truncate">{nft.description}</div>
                                  </>
                                )}
                              </div>
                            </div>
                          </button>
                        ))
                      ) : isLoadingNFTs && !hasInitialLoad ? (
                        // Show skeleton only on very first load
                        Array.from({ length: 3 }, (_, i) => (
                          <div key={`skeleton_${i}`} className="p-3 border-b border-white/20 last:border-b-0">
                            <div className="flex items-center space-x-3 animate-pulse">
                              <div className="w-10 h-10 bg-gradient-to-r from-purple-500/30 to-pink-500/30 rounded-lg flex-shrink-0"></div>
                              <div className="flex-1 min-w-0">
                                <div className="h-4 bg-gray-600/50 rounded mb-1"></div>
                                <div className="h-3 bg-gray-600/30 rounded w-2/3"></div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center">
                          <p className="text-white text-sm font-medium">
                            {isLoadingNFTs ? 'Searching for your NFTs...' : 'No NFTs found'}
                          </p>
                          <p className="text-blue-200 text-xs mt-1">
                            {isLoadingNFTs ? 'This may take a moment...' : 'Mint some NFTs first or switch networks!'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Manual input fallback */}
                <div className="mt-4">
                  <label htmlFor="manualTokenId" className="block text-xs font-medium text-gray-300 mb-1">
                    Or enter token ID manually:
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      id="manualTokenId"
                      name="tokenId"
                      value={burnForm.tokenId}
                      onChange={handleBurnInputChange}
                      placeholder="Enter token ID"
                      className="input-field flex-1 text-sm"
                      min="1"
                    />
                    <button
                      type="button"
                      onClick={() => fetchNFTMetadata(burnForm.tokenId)}
                      className="btn-secondary px-3 text-sm"
                    >
                      <Search size={14} />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <label htmlFor="destinationChain" className="block text-sm font-medium text-white">
                      Target Network *
                    </label>
                    <div className="text-xs bg-blue-500/20 px-2 py-1 rounded border border-blue-500/30">
                      <span className="text-blue-300">
                        From: <span className="font-semibold capitalize">{currentNetwork}</span>
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const result = await testICPConnection();
                        if (result) {
                          setStatus({
                            type: 'success',
                            message: 'ICP connection test successful!'
                          });
                        } else {
                          setStatus({
                            type: 'error',
                            message: 'ICP connection test failed. Check canister ID and network.'
                          });
                        }
                      } catch (error) {
                        setStatus({
                          type: 'error',
                          message: `ICP connection error: ${error.message}`
                        });
                      }
                    }}
                    className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded"
                    title="Test ICP connection"
                  >
                    Test ICP
                  </button>
                </div>
                <select
                  id="destinationChain"
                  name="destinationChain"
                  value={burnForm.destinationChain}
                  onChange={handleBurnInputChange}
                  className="input-field"
                  required
                >
                  <option value="">Select destination chain</option>
                  {/* Dynamic options - show only OPPOSITE network */}
                  {(() => {
                    const isHolesky = isCurrentNetworkHolesky();
                    const isSepolia = currentNetwork?.chainId === '11155111' || 
                                      currentNetwork?.chainId === 11155111 || 
                                      currentNetwork?.name?.toLowerCase().includes('sepolia') ||
                                      currentNetwork === 'sepolia' ||
                                      window.ethereum?.chainId === '0xaa36a7';
                    
                    console.log('🔍 Target Network Logic:');
                    console.log('Current Network:', currentNetwork);
                    console.log('Is Holesky:', isHolesky);
                    console.log('Is Sepolia:', isSepolia);
                    console.log('Chain ID:', window.ethereum?.chainId);
                    
                    if (isHolesky) {
                      console.log('✅ On Holesky → Show Sepolia as target');
                      return <option value="sepolia">Sepolia Testnet</option>;
                    } else if (isSepolia) {
                      console.log('✅ On Sepolia → Show Holesky as target');
                      return <option value="holesky">Holesky Testnet</option>;
                    } else {
                      console.log('❌ Unknown network → Show both (fallback)');
                      return (
                        <>
                          <option value="sepolia">Sepolia Testnet</option>
                          <option value="holesky">Holesky Testnet</option>
                        </>
                      );
                    }
                  })()}
                </select>
                
                {/* Coming Soon Note */}
                <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <p className="text-blue-300 text-sm font-medium">Coming Soon!</p>
                      <p className="text-blue-200 text-xs mt-1">
                        Support for Solana, Stellar, Ethereum mainnet, Base, Polygon, and other major chains will be available soon.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="destinationAddress" className="block text-sm font-medium text-white mb-2">
                  Recipient Address *
                </label>
                                  <input
                    type="text"
                    id="destinationAddress"
                    name="destinationAddress"
                    value={burnForm.destinationAddress}
                    onChange={handleBurnInputChange}
                    placeholder="Enter recipient address (0x...)"
                    className="input-field"
                    required
                  />
              </div>

                  <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full btn-primary flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader size={16} className="animate-spin" />
                      <span>Transferring...</span>
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft size={16} />
                      <span>Transfer to {burnForm.destinationChain || 'Chain'}</span>
                    </>
                  )}
                </button>
            </form>
          </div>
        )}

        {/* NFT Preview */}
        <div className="card">
          <h3 className="text-xl font-bold text-white mb-4">NFT Preview</h3>
          
          {nftMetadata ? (
            <div className="space-y-4">
              <img
                src={nftMetadata.image}
                alt={nftMetadata.name}
                className="w-full h-48 object-cover rounded-lg"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
              <div className="space-y-2">
                <h4 className="text-lg font-semibold text-white">{nftMetadata.name}</h4>
                <p className="text-gray-300 text-sm">{nftMetadata.description}</p>
                <div className="flex justify-between items-center">
                  <span className="text-purple-400 font-medium">
                    {nftMetadata.price ? `${nftMetadata.price} ETH` : 'Not for sale'}
                  </span>
                  <span className="text-gray-400 text-sm">
                    Owner: {nftMetadata.currentOwner?.slice(0, 6)}...{nftMetadata.currentOwner?.slice(-4)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search size={32} className="text-gray-400" />
              </div>
              <p className="text-gray-300">Enter a token ID and click search to preview the NFT</p>
            </div>
          )}
        </div>
      </div>

      {/* Status Message */}
      {status && (
        <div className="mt-8 status-update">
          <div className={`p-4 rounded-lg border ${
            status.type === 'success' 
              ? 'bg-green-500/20 border-green-500/30' 
              : 'bg-red-500/20 border-red-500/30'
          }`}>
            <div className="flex items-center space-x-2">
              {status.type === 'success' ? (
                <CheckCircle size={16} className="text-green-400" />
              ) : (
                <AlertCircle size={16} className="text-red-400" />
              )}
              <span className={`text-sm ${
                status.type === 'success' ? 'text-green-400' : 'text-red-400'
              }`}>
                {status.message}
              </span>
            </div>
            {status.hash && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-blue-300">Transaction Hash:</span>
                  <span className="text-blue-400 font-mono">{status.hash}</span>
                </div>
                {isGettingBlockNumber ? (
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-yellow-300">Block Number:</span>
                    <Loader size={12} className="animate-spin text-yellow-400" />
                    <span className="text-yellow-400">Getting block number...</span>
                  </div>
                ) : status.blockNumber ? (
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-green-300">Block Number:</span>
                    <span className="text-green-400 font-mono">{status.blockNumber}</span>
                  </div>
                ) : null}
                {status.icpResult && (
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-purple-300">ICP Update:</span>
                    <span className="text-purple-400 font-mono">{status.icpResult}</span>
                  </div>
                )}
                {status.icpError && (
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-red-300">ICP Error:</span>
                    <span className="text-red-400 font-mono">{status.icpError}</span>
                  </div>
                )}
                <div className="flex items-center space-x-2 text-xs">
                  {console.log('🔍 Burn Transaction Explorer Link Debug:')}
                  {console.log('window.ethereum.chainId:', window.ethereum?.chainId)}
                  {console.log('Transaction Hash:', status.hash)}
                  {console.log('Is Holesky?', window.ethereum?.chainId === '0x4268')}
                  <a
                    href={`${window.ethereum?.chainId === '0x4268' ? 'https://holesky.etherscan.io' : 'https://sepolia.etherscan.io'}/tx/${status.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 text-xs flex items-center space-x-1 transition-colors duration-200 hover:scale-105 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20"
                  >
                    <span>View on {window.ethereum?.chainId === '0x4268' ? 'Holesky' : 'Sepolia'} Etherscan</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            )}
            
            {/* Visual Separator */}
            {status.holeskyTxnHash && (
              <div className="mt-4 mb-3 border-t border-gray-600/30"></div>
            )}
            
            {status.holeskyTxnHash && (
              <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg holesky-success">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle size={16} className="text-green-400 animate-bounce-slow" />
                    <span className="text-green-400 font-medium text-sm">NFT Released on {status.destinationNetwork || 'Destination Network'}! 🎉</span>
                  </div>
                  <a
                    href={`${status.etherscanBaseUrl || 'https://holesky.etherscan.io'}/tx/${status.holeskyTxnHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors duration-200 hover:scale-105"
                  >
                    <span>View on {status.destinationNetwork || 'Holesky'}</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
                <div className="mt-2 text-xs text-blue-300 font-mono break-all bg-blue-500/10 p-2 rounded border border-blue-500/20">
                  {status.holeskyTxnHash}
                </div>
              </div>
            )}
            {status && status.holeskyTxnError && (
              <div className="flex items-center space-x-2 text-xs mt-1">
                <span className="text-red-300">Holesky Txn Error:</span>
                <span className="text-red-400 font-mono">{status.holeskyTxnError}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {transferProgress.currentStep > 0 && (
        <div className="mt-8">
          <ProgressBar
            currentStep={transferProgress.currentStep}
            totalSteps={transferProgress.totalSteps}
            stepLabels={transferProgress.stepLabels}
            currentStatus={transferProgress.currentStatus}
          />
          
          {/* Polling Status */}
          {isPollingHoleskyTxn && (
            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg animate-pulse-slow">
              <div className="flex items-center space-x-2">
                <Loader size={16} className="animate-spin-fast text-blue-400" />
                <span className="text-blue-300 text-sm">
                  Checking for NFT release on {isCurrentNetworkHolesky() ? 'Sepolia' : 'Holesky'} every 3 seconds...
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TransferSection; 