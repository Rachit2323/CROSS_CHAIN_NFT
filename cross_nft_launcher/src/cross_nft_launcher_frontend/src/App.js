import React, { useState } from 'react';
import { MetaMaskProvider } from './context/MetaMaskContext';
import Header from './components/Header';
import MintSection from './components/MintSection';
import TransferSection from './components/TransferSection';
import NFTGallery from './components/NFTGallery';
import { Coins, ArrowRightLeft, Image as ImageIcon } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('mint');

  const tabs = [
    { id: 'mint', label: 'Mint NFT', icon: ImageIcon },
    { id: 'transfer', label: 'Cross-Chain Transfer', icon: ArrowRightLeft },
    { id: 'gallery', label: 'NFT Gallery', icon: Coins },
  ];

  return (
    <MetaMaskProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <Header />
        
        <main className="container mx-auto px-4 py-8">
          {/* Coming Soon Banner */}
          <div className="max-w-4xl mx-auto mb-6">
            <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
                <div>
                  <h3 className="text-blue-300 font-semibold text-sm lg:text-base">🚀 Multi-Chain Support Coming Soon!</h3>
                  <p className="text-blue-200 text-xs lg:text-sm mt-1">
                    We're working on expanding support to Solana, Stellar, Ethereum mainnet, Base, Polygon, and other major blockchains.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex justify-center mb-8">
            <div className="flex flex-wrap justify-center gap-1 bg-white/10 backdrop-blur-lg rounded-lg p-1 border border-white/20 max-w-full">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-1 lg:space-x-2 px-2 py-2 lg:px-4 rounded-md transition-all duration-200 text-sm lg:text-base ${
                      activeTab === tab.id
                        ? 'bg-white/20 text-white shadow-lg'
                        : 'text-gray-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon size={16} className="lg:w-5 lg:h-5" />
                    <span className="font-medium hidden sm:inline">{tab.label}</span>
                    <span className="font-medium sm:hidden">{tab.label.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="animate-fade-in">
            {activeTab === 'mint' && <MintSection />}
            {activeTab === 'transfer' && <TransferSection />}
            {activeTab === 'gallery' && <NFTGallery />}
          </div>
        </main>

        {/* Footer */}
        <footer className="text-center py-6 text-gray-400">
          <p>NFT Marketplace - Cross-Chain Functionality</p>
          <p className="text-sm mt-2">Built with React, Ethers.js, and MetaMask</p>
        </footer>
      </div>
    </MetaMaskProvider>
  );
}

export default App; 