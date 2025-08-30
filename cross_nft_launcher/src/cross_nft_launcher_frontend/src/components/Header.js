import React, { useState, useRef, useEffect } from 'react';
import { useMetaMask } from '../context/MetaMaskContext';
import { Wallet, ChevronDown, AlertCircle, CheckCircle } from 'lucide-react';

const Header = () => {
  const [isNetworkDropdownOpen, setIsNetworkDropdownOpen] = useState(false);
  const networkDropdownRef = useRef(null);
  
  const {
    account,
    currentNetwork,
    isConnecting,
    error,
    balance,
    isMetaMaskInstalled,
    connectWallet,
    switchNetwork,
    contract,
  } = useMetaMask();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (networkDropdownRef.current && !networkDropdownRef.current.contains(event.target)) {
        setIsNetworkDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleNetworkSwitch = async (networkName) => {
    await switchNetwork(networkName);
    setIsNetworkDropdownOpen(false);
  };

  const formatAddress = (address) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getNetworkIcon = (network) => {
    return network === 'sepolia' ? '🔵' : '🟢';
  };

  return (
    <header className="bg-white/10 backdrop-blur-lg border-b border-white/20">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-2 lg:space-x-3">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm lg:text-lg">N</span>
            </div>
            <div>
              <h1 className="text-lg lg:text-xl font-bold text-white">NFT Marketplace</h1>
              <p className="text-xs lg:text-sm text-gray-300">Cross-Chain Functionality</p>
            </div>
          </div>

                      {/* Network and Wallet Info */}
            <div className="flex items-center space-x-2 lg:space-x-4">
              {/* Contract Address */}
              {contract && (
                <div className="hidden lg:block">
                  <div className="text-xs text-gray-300" title={`Full contract address: ${contract.target}`}>
                    Contract: {contract.target.slice(0, 8)}...{contract.target.slice(-6)}
                  </div>
                </div>
              )}
              
              {/* Network Selector */}
              <div className="relative" ref={networkDropdownRef}>
              <button 
                onClick={() => setIsNetworkDropdownOpen(!isNetworkDropdownOpen)}
                className="flex items-center space-x-2 bg-white/10 backdrop-blur-lg border border-white/20 rounded-lg px-2 py-2 lg:px-3 text-white hover:bg-white/20 transition-colors text-sm lg:text-base"
              >
                <span>{getNetworkIcon(currentNetwork)}</span>
                <span className="font-medium hidden sm:inline">{currentNetwork}</span>
                <ChevronDown size={16} className={`transition-transform ${isNetworkDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {/* Network Dropdown */}
              {isNetworkDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white/10 backdrop-blur-lg border border-white/20 rounded-lg shadow-xl z-50">
                  <button
                    onClick={() => handleNetworkSwitch('sepolia')}
                    className="w-full text-left px-4 py-2 text-white hover:bg-white/20 transition-colors rounded-t-lg text-sm"
                  >
                    🔵 Sepolia Testnet
                  </button>
                  <button
                    onClick={() => handleNetworkSwitch('holesky')}
                    className="w-full text-left px-4 py-2 text-white hover:bg-white/20 transition-colors rounded-b-lg text-sm"
                  >
                    🟢 Holesky Testnet
                  </button>
                </div>
              )}
            </div>

            {/* Wallet Connection */}
            {!isMetaMaskInstalled() ? (
              <div className="flex items-center space-x-2 text-red-400">
                <AlertCircle size={16} />
                <span className="text-xs lg:text-sm">MetaMask Required</span>
              </div>
            ) : account ? (
              <div className="flex items-center space-x-2 lg:space-x-4">
                {/* Balance */}
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-lg px-2 py-2 lg:px-3">
                  <div className="text-xs lg:text-sm text-gray-300">Balance</div>
                  <div className="text-white font-medium text-sm lg:text-base">
                    {parseFloat(balance).toFixed(4)} ETH
                  </div>
                </div>

                {/* Account */}
                <div className="flex items-center space-x-2 bg-green-500/20 border border-green-500/30 rounded-lg px-2 py-2 lg:px-3">
                  <CheckCircle size={16} className="text-green-400" />
                  <div>
                    <div className="text-xs lg:text-sm text-gray-300">Connected</div>
                    <div className="text-white font-medium text-sm lg:text-base">
                      {formatAddress(account)}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                disabled={isConnecting}
                className="flex items-center space-x-1 lg:space-x-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-2 py-2 lg:px-4 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 text-sm lg:text-base"
              >
                <Wallet size={16} />
                <span className="hidden sm:inline">{isConnecting ? 'Connecting...' : 'Connect Wallet'}</span>
                <span className="sm:hidden">{isConnecting ? '...' : 'Connect'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 bg-red-500/20 border border-red-500/30 rounded-lg p-3">
            <div className="flex items-center space-x-2 text-red-400">
              <AlertCircle size={16} />
              <span className="text-xs lg:text-sm">{error}</span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header; 