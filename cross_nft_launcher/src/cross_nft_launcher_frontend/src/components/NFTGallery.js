import React, { useState, useEffect } from 'react';
import { useMetaMask } from '../context/MetaMaskContext';
import { Coins, Search, Loader, AlertCircle, CheckCircle } from 'lucide-react';
import { ethers } from 'ethers';

const NFTGallery = () => {
  const { account, getMetadata, currentNetwork } = useMetaMask();
  const [ownedNFTs, setOwnedNFTs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [searchTokenId, setSearchTokenId] = useState('');
  const [selectedNFT, setSelectedNFT] = useState(null);
  const [nftQueue, setNftQueue] = useState([]);
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);
  const [loadedNFTsCount, setLoadedNFTsCount] = useState(0);
  const [previousNetwork, setPreviousNetwork] = useState(currentNetwork);

  const [status, setStatus] = useState(null);
  const [lastFetchTime, setLastFetchTime] = useState(0);

  // FORCE REFRESH - get fresh NFTs
  const forceRefreshNFTs = async () => {
    if (!account || !getMetadata) return;
    
    setIsLoading(true);
    setLoadingProgress(0);
    
    console.log('🔄 FORCE REFRESH Gallery - Fetching fresh NFTs...');
    console.log('Account:', account);
    console.log('Network:', currentNetwork);
    
    setStatus({
      type: 'success',
      message: 'Refreshing your NFTs...',
    });
    
    try {
      const nftsWithIds = [];
      const maxTokens = 50; // Increased to catch new NFTs
      
      // Parallel fetch all tokens at once
      const allPromises = [];
      for (let i = 1; i <= maxTokens; i++) {
        allPromises.push(
          getMetadata(i)
            .then(metadata => {
              if (metadata && metadata.currentOwner && 
                  metadata.currentOwner.toLowerCase() === account.toLowerCase()) {
                console.log(`✅ Gallery found NFT #${i}: ${metadata.name}`);
                return {
                  tokenId: i,
                  name: metadata.name,
                  description: metadata.description,
                  image: metadata.image,
                  price: metadata.price,
                  forSale: metadata.forSale,
                  currentOwner: metadata.currentOwner,
                  createdAt: metadata.createdAt
                };
              }
              return null;
            })
            .catch(error => {
              console.log(`Gallery token ${i} error:`, error.message);
              return null;
            })
        );
      }
      
      // Update progress as we process
      for (let i = 0; i < maxTokens; i += 10) {
        setLoadingProgress(Math.round(((i + 10) / maxTokens) * 100));
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Wait for all results
      const results = await Promise.allSettled(allPromises);
      
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          nftsWithIds.push(result.value);
        }
      });
      
      console.log(`✅ Gallery FINAL: Found ${nftsWithIds.length} NFTs for ${account}`);
      setOwnedNFTs(nftsWithIds);
      setLoadedNFTsCount(nftsWithIds.length);
      
      if (nftsWithIds.length === 0) {
        setStatus({
          type: 'info',
          message: `No NFTs found on ${currentNetwork} network. Make sure you have minted NFTs on this network or switch to the correct network.`
        });
        console.log('⚠️ Gallery: No NFTs found. Check network and wallet.');
      } else {
        setStatus({
          type: 'success',
          message: `Found ${nftsWithIds.length} NFT${nftsWithIds.length === 1 ? '' : 's'} on ${currentNetwork} network!`
        });
      }
      
    } catch (error) {
      console.error('Gallery refresh error:', error);
      setStatus({
        type: 'error',
        message: 'Failed to fetch your NFTs. Please try again.'
      });
      setOwnedNFTs([]);
    } finally {
      setIsLoading(false);
      setLoadingProgress(100);
      setLastFetchTime(Date.now());
    }
  };
  
  // Background loading for comprehensive scan
  const startBackgroundLoading = async (startToken, existingNFTs = []) => {
    if (!account || !getMetadata) return;
    
    setIsBackgroundLoading(true);
    const maxTokens = 100;
    const allNFTs = [...existingNFTs];
    
    try {
      for (let i = startToken; i <= maxTokens; i++) {
        try {
          const metadata = await getMetadata(i);
          if (metadata && metadata.currentOwner && 
              metadata.currentOwner.toLowerCase() === account.toLowerCase()) {
            
            // Check if we already have this NFT from quick load
            const existsIndex = allNFTs.findIndex(nft => nft.tokenId === i);
            if (existsIndex === -1) {
              const newNFT = {
                tokenId: i,
                name: metadata.name,
                description: metadata.description,
                image: metadata.image,
                price: metadata.price,
                forSale: metadata.forSale,
                currentOwner: metadata.currentOwner,
                createdAt: metadata.createdAt
              };
              
              allNFTs.push(newNFT);
              
              // Update UI incrementally as we find new NFTs
              setOwnedNFTs([...allNFTs]);
              setLoadedNFTsCount(allNFTs.length);
              setStatus({
                type: 'success',
                message: `Found ${allNFTs.length} NFT${allNFTs.length === 1 ? '' : 's'} on ${currentNetwork} network!`
              });
            }
          }
        } catch (error) {
          // Continue silently for background loading
          continue;
        }
        
        // Smaller delay for background loading
        if (i % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      
      console.log(`Background scan complete. Total NFTs: ${allNFTs.length}`);
      
    } catch (error) {
      console.error('Background loading error:', error);
    } finally {
      setIsBackgroundLoading(false);
      setLastFetchTime(Date.now());
    }
  };

  // Main fetch function - always refresh
  const fetchOwnedNFTs = async () => {
    if (!account || !getMetadata) return;

    // Always do fresh fetch to catch new NFTs
    console.log('🚀 fetchOwnedNFTs called - doing fresh fetch');
    await forceRefreshNFTs();
  };

  const handleSearchNFT = async () => {
    if (!searchTokenId) return;

    try {
      const metadata = await getMetadata(searchTokenId);
      setSelectedNFT({
        tokenId: searchTokenId,
        ...metadata
      });
    } catch (error) {
      console.error('Error fetching NFT:', error);
      setStatus({
        type: 'error',
        message: 'NFT not found or error occurred'
      });
    }
  };



  // Network change detection
  useEffect(() => {
    if (currentNetwork && previousNetwork && currentNetwork !== previousNetwork) {
      console.log(`🔄 Network changed: ${previousNetwork} → ${currentNetwork}`);
      console.log('🧹 Clearing NFTs and refreshing...');
      
      // Clear current NFTs immediately
      setOwnedNFTs([]);
      setSelectedNFT(null);
      setStatus({
        type: 'info',
        message: `Switched to ${currentNetwork} network. Loading NFTs...`
      });
      
      // Fetch NFTs for new network
      if (account) {
        setTimeout(() => {
          console.log(`🚀 Fetching NFTs for new network: ${currentNetwork}`);
          fetchOwnedNFTs();
        }, 100);
      }
    }
    
    // Update previous network
    setPreviousNetwork(currentNetwork);
  }, [currentNetwork]); // eslint-disable-line react-hooks/exhaustive-deps

  // MetaMask network change listener
  useEffect(() => {
    if (window.ethereum) {
      const handleChainChanged = (chainId) => {
        console.log(`🔗 Gallery: Chain changed to ${chainId}`);
        // Force a slight delay to let currentNetwork update
        setTimeout(() => {
          console.log(`🧹 Gallery: Clearing NFTs for chain change`);
          setOwnedNFTs([]);
          setSelectedNFT(null);
          setStatus({
            type: 'info',
            message: 'Network changed. Refreshing NFTs...'
          });
          
          if (account) {
            fetchOwnedNFTs();
          }
        }, 500);
      };
      
      window.ethereum.on('chainChanged', handleChainChanged);
      
      return () => {
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, [account]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Auto-refresh when account changes + periodic refresh
  useEffect(() => {
    if (account) {
      console.log('🚀 Gallery: Account changed, fetching NFTs');
      fetchOwnedNFTs();
      
      // Set up auto-refresh every 30 seconds
      const refreshInterval = setInterval(() => {
        console.log('🔄 Gallery auto-refresh: Checking for new NFTs...');
        fetchOwnedNFTs();
      }, 30000);
      
      return () => clearInterval(refreshInterval);
    } else {
      setOwnedNFTs([]);
      setStatus(null);
    }
  }, [account]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!account) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="card text-center">
          <div className="w-16 h-16 bg-gray-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Coins size={32} className="text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Connect Wallet to View Gallery</h2>
          <p className="text-gray-300">Please connect your MetaMask wallet to view your NFT collection</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="card mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <Coins size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">NFT Gallery</h2>
              <p className="text-gray-300">Manage and view your NFT collection</p>
            </div>
          </div>
          
          {/* Network Indicator */}
          <div className="flex items-center space-x-2 px-3 py-2 bg-white/10 rounded-lg border border-white/20">
            <div className={`w-2 h-2 rounded-full ${
              currentNetwork === 'sepolia' ? 'bg-green-400' : 
              currentNetwork === 'holesky' ? 'bg-blue-400' : 'bg-gray-400'
            }`}></div>
            <span className="text-sm font-medium text-white capitalize">
              {currentNetwork} Network
            </span>
          </div>
          <div className="flex space-x-2">
          <button
            onClick={() => {
              setStatus(null);
              fetchOwnedNFTs();
            }}
            disabled={isLoading}
            className="btn-primary flex items-center space-x-2"
          >
            {isLoading ? (
              <Loader size={16} className="animate-spin" />
            ) : (
              <Search size={16} />
            )}
            <span>Refresh</span>
          </button>
          
          <button
            onClick={async () => {
              console.log('🔍 EMERGENCY NFT DEBUG STARTING...');
              console.log('Account:', account);
              console.log('Network:', currentNetwork);
              console.log('getMetadata function:', typeof getMetadata);
              
              setStatus({ type: 'info', message: 'Running emergency debug scan...' });
              
              const foundTokens = [];
              const errors = [];
              
              // Check first 30 tokens with detailed logging
              for (let i = 1; i <= 30; i++) {
                try {
                  console.log(`🔄 Checking token ${i}...`);
                  const metadata = await getMetadata(i);
                  
                  if (metadata) {
                    console.log(`✅ Token ${i}:`, {
                      name: metadata.name,
                      owner: metadata.currentOwner,
                      yourAccount: account,
                      isYours: metadata.currentOwner?.toLowerCase() === account?.toLowerCase()
                    });
                    
                    foundTokens.push({
                      tokenId: i,
                      ...metadata,
                      isYours: metadata.currentOwner?.toLowerCase() === account?.toLowerCase()
                    });
                  } else {
                    console.log(`❌ Token ${i}: No metadata`);
                  }
                } catch (error) {
                  console.log(`❌ Token ${i} error:`, error.message);
                  errors.push({ tokenId: i, error: error.message });
                }
              }
              
              console.log('🎯 EMERGENCY SCAN COMPLETE:');
              console.log('📋 All found tokens:', foundTokens);
              console.log('🏠 Your tokens:', foundTokens.filter(t => t.isYours));
              console.log('❌ Errors:', errors);
              
              const yourTokens = foundTokens.filter(t => t.isYours);
              setStatus({ 
                type: yourTokens.length > 0 ? 'success' : 'error', 
                message: `🚨 EMERGENCY SCAN: Found ${foundTokens.length} total tokens, ${yourTokens.length} are yours. CHECK CONSOLE NOW!` 
              });
              
              // Force update the NFTs immediately
              if (yourTokens.length > 0) {
                setOwnedNFTs(yourTokens);
              }
            }}
            className="btn-secondary flex items-center space-x-2 bg-red-600 hover:bg-red-700"
          >
            <span>🚨</span>
            <span>EMERGENCY DEBUG</span>
          </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Search NFT */}
        <div className="card">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
            <Search size={20} />
            <span>Search NFT</span>
          </h3>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="searchTokenId" className="block text-sm font-medium text-white mb-2">
                Token ID
              </label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  id="searchTokenId"
                  value={searchTokenId}
                  onChange={(e) => setSearchTokenId(e.target.value)}
                  placeholder="Enter token ID"
                  className="input-field flex-1"
                  min="1"
                />
                <button
                  onClick={handleSearchNFT}
                  className="btn-secondary px-4"
                >
                  <Search size={16} />
                </button>
              </div>
            </div>

{selectedNFT && (
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <img
                  src={selectedNFT.image}
                  alt={selectedNFT.name}
                  className="w-full h-32 object-cover rounded-lg mb-3"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <h4 className="text-white font-semibold">{selectedNFT.name}</h4>
                <p className="text-gray-300 text-sm mb-2">{selectedNFT.description}</p>
                                 <div className="flex justify-between items-center">
                   <span className="text-purple-400 font-medium">
                     {selectedNFT.price && Number(selectedNFT.price) > 0 ? `${ethers.formatEther(selectedNFT.price)} ETH` : 'Not for sale'}
                   </span>
                   <span className="text-gray-400 text-sm">
                     ID: {selectedNFT.tokenId}
                   </span>
                 </div>
              </div>
            )}
            
            {/* QUICK DEBUG SECTION */}
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mt-4">
              <h4 className="text-red-300 font-semibold text-sm mb-2">🚨 Just Minted NFT?</h4>
              <div className="space-y-2">
                <p className="text-red-200 text-xs">Enter the token ID you just minted:</p>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    placeholder="Token ID"
                    className="input-field text-xs h-8 flex-1"
                    id="quickDebugTokenId"
                    min="1"
                  />
                  <button
                    onClick={async () => {
                      const tokenId = document.getElementById('quickDebugTokenId').value;
                      if (!tokenId) {
                        alert('Enter the token ID you just minted');
                        return;
                      }
                      
                      console.log(`🔍 QUICK CHECK: Token #${tokenId}`);
                      console.log('Your account:', account);
                      console.log('Current network:', currentNetwork);
                      
                      try {
                        const metadata = await getMetadata(tokenId);
                        console.log(`📋 Token #${tokenId} metadata:`, metadata);
                        
                        if (metadata) {
                          const isYours = metadata.currentOwner?.toLowerCase() === account?.toLowerCase();
                          console.log('✅ Token exists!');
                          console.log('📦 Name:', metadata.name);
                          console.log('👤 Owner:', metadata.currentOwner);
                          console.log('🏠 Your account:', account);
                          console.log('🔍 You own it?', isYours ? 'YES' : 'NO');
                          
                          if (isYours) {
                            // Add to the gallery immediately
                            const newNFT = {
                              tokenId: parseInt(tokenId),
                              name: metadata.name,
                              description: metadata.description,
                              image: metadata.image,
                              price: metadata.price,
                              forSale: metadata.forSale,
                              currentOwner: metadata.currentOwner,
                              createdAt: metadata.createdAt
                            };
                            
                            setOwnedNFTs(prev => {
                              const exists = prev.find(nft => nft.tokenId === parseInt(tokenId));
                              if (!exists) {
                                return [...prev, newNFT];
                              }
                              return prev;
                            });
                            
                            setStatus({
                              type: 'success',
                              message: `🎉 Found your NFT #${tokenId}: ${metadata.name}! Added to gallery.`
                            });
                          } else {
                            setStatus({
                              type: 'error', 
                              message: `❌ Token #${tokenId} exists but you don't own it. Owner: ${metadata.currentOwner}`
                            });
                          }
                          
                          alert(`Token #${tokenId}: ${metadata.name}\\n\\nOwner: ${metadata.currentOwner}\\nYour account: ${account}\\nYou own it: ${isYours ? 'YES ✅' : 'NO ❌'}`);
                        } else {
                          console.log('❌ Token does not exist');
                          setStatus({
                            type: 'error',
                            message: `❌ Token #${tokenId} does not exist. Check if transaction confirmed.`
                          });
                        }
                      } catch (error) {
                        console.error('❌ Quick check error:', error);
                        setStatus({
                          type: 'error',
                          message: `❌ Error checking token #${tokenId}: ${error.message}`
                        });
                      }
                    }}
                    className="btn-secondary text-xs h-8 px-3 bg-red-600 hover:bg-red-700"
                  >
                    🔍 Check Now
                  </button>
                </div>
                <p className="text-red-200 text-xs">⚠️ If your NFT doesn't show, the transaction might still be confirming!</p>
              </div>
            </div>
          </div>
        </div>


      </div>

      {/* Owned NFTs */}
      <div className="mt-8">
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">Your NFT Collection</h3>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setLastFetchTime(0); // Clear cache
                  setStatus(null); // Clear status messages
                  fetchOwnedNFTs();
                }}
                className="btn-secondary text-sm px-3 py-1"
                title="Force refresh"
              >
                <Loader size={14} />
                <span className="ml-1">Refresh</span>
              </button>
              <button
                onClick={() => {
                  console.log('Current account:', account);
                  console.log('Current network:', window.ethereum?.networkVersion);
                  console.log('Cached NFTs:', ownedNFTs);
                  setStatus({
                    type: 'info',
                    message: `Debug: Account ${account}, Network ${window.ethereum?.networkVersion}, Cached NFTs: ${ownedNFTs.length}`
                  });
                }}
                className="btn-secondary text-sm px-3 py-1"
                title="Debug info"
              >
                <span>🔍</span>
              </button>
            </div>
          </div>
          
          {isLoading ? (
            <div className="text-center py-8">
              <Loader size={32} className="animate-spin mx-auto mb-4 text-white" />
              <p className="text-gray-300">Quick loading your NFTs...</p>
              <div className="mt-4 max-w-md mx-auto">
                <div className="bg-white/10 rounded-full h-2 mb-2">
                  <div 
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${loadingProgress}%` }}
                  ></div>
                </div>
                <p className="text-gray-400 text-sm">{loadingProgress}% complete</p>
              </div>
              <p className="text-gray-400 text-sm mt-2">Fast scanning tokens 1-20...</p>
            </div>
          ) : ownedNFTs.length > 0 ? (
            <>
              {/* Background loading indicator */}
              {isBackgroundLoading && (
                <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Loader size={16} className="animate-spin text-blue-400" />
                    <span className="text-blue-300 text-sm">
                      Loading more NFTs in background... ({loadedNFTsCount} found so far)
                    </span>
                  </div>
                </div>
              )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ownedNFTs.map((nft) => (
                <div key={nft.tokenId} className="bg-white/5 rounded-lg p-4 border border-white/10 hover:border-white/30 transition-colors">
                  <img
                    src={nft.image}
                    alt={nft.name}
                    className="w-full h-48 object-cover rounded-lg mb-4"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <div className="space-y-2">
                    <h4 className="text-white font-semibold text-lg">{nft.name}</h4>
                    <p className="text-gray-300 text-sm line-clamp-2">{nft.description}</p>
                                         <div className="flex justify-between items-center">
                       <span className="text-purple-400 font-medium">
                         {nft.price && Number(nft.price) > 0 ? `${ethers.formatEther(nft.price)} ETH` : 'Not for sale'}
                       </span>
                       <span className="text-gray-400 text-sm">#{nft.tokenId}</span>
                     </div>
                                         <div className="text-xs text-gray-400">
                       Created: {nft.createdAt ? new Date(Number(nft.createdAt) * 1000).toLocaleDateString() : 'Unknown'}
                     </div>
                  </div>
                </div>
              ))}
            </div>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Coins size={32} className="text-gray-400" />
              </div>
              <p className="text-gray-300">No NFTs found in your collection</p>
              <p className="text-gray-400 text-sm mt-2">Try minting some NFTs first or check if you're on the correct network!</p>
              <button
                onClick={fetchOwnedNFTs}
                className="mt-4 btn-primary text-sm"
              >
                Refresh Collection
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Status Message */}
      {status && (
        <div className="mt-8">
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
              <a
                href={`https://sepolia.etherscan.io/tx/${status.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 text-xs mt-1 block"
              >
                View on Etherscan →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NFTGallery; 