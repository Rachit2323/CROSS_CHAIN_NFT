import React, { useState } from 'react';
import { useMetaMask } from '../context/MetaMaskContext';
import { NETWORKS } from '../config/contract';
import { Image, Plus, Loader, CheckCircle, AlertCircle } from 'lucide-react';

const MintSection = () => {
  const { account, mintNFT, currentNetwork } = useMetaMask();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image: '',
    price: '',
  });
  const [isMinting, setIsMinting] = useState(false);
  const [mintStatus, setMintStatus] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!account) {
      setMintStatus({
        type: 'error',
        message: 'Please connect your wallet first'
      });
      return;
    }

    // Validation
    if (!formData.name || !formData.description || !formData.image || !formData.price) {
      setMintStatus({
        type: 'error',
        message: 'Please fill in all fields'
      });
      return;
    }

    if (formData.name.length > 32) {
      setMintStatus({
        type: 'error',
        message: 'Name must be 32 characters or less'
      });
      return;
    }

    if (formData.description.length > 200) {
      setMintStatus({
        type: 'error',
        message: 'Description must be 200 characters or less'
      });
      return;
    }

    if (formData.image.length > 200) {
      setMintStatus({
        type: 'error',
        message: 'Image URL must be 200 characters or less'
      });
      return;
    }

    const price = parseFloat(formData.price);
    if (isNaN(price) || price <= 0) {
      setMintStatus({
        type: 'error',
        message: 'Please enter a valid price'
      });
      return;
    }

    setIsMinting(true);
    setMintStatus(null);

    try {
      console.log('Starting mint process...');
      const receipt = await mintNFT(
        formData.name,
        formData.description,
        formData.image,
        price
      );

      console.log('Mint completed, receipt:', receipt);
      setMintStatus({
        type: 'success',
        message: `NFT minted successfully! Transaction hash: ${receipt.hash}`,
        hash: receipt.hash
      });

      // Reset form
      setFormData({
        name: '',
        description: '',
        image: '',
        price: '',
      });
    } catch (error) {
      console.error('Minting error:', error);
      setMintStatus({
        type: 'error',
        message: error.message || 'Failed to mint NFT. Please try again.'
      });
    } finally {
      setIsMinting(false);
    }
  };

  if (!account) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card text-center">
          <div className="w-16 h-16 bg-gray-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Image size={32} className="text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Connect Wallet to Mint</h2>
          <p className="text-gray-300">Please connect your MetaMask wallet to start minting NFTs</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="card">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
            <Plus size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Mint New NFT</h2>
            <p className="text-gray-300">Create and mint your unique NFT</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name Field */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-white mb-2">
              NFT Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter NFT name (max 32 characters)"
              className="input-field"
              maxLength={32}
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              {formData.name.length}/32 characters
            </p>
          </div>

          {/* Description Field */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-white mb-2">
              Description *
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Enter NFT description (max 200 characters)"
              className="input-field resize-none h-24"
              maxLength={200}
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              {formData.description.length}/200 characters
            </p>
          </div>

          {/* Image URL Field */}
          <div>
            <label htmlFor="image" className="block text-sm font-medium text-white mb-2">
              Image URL *
            </label>
            <input
              type="url"
              id="image"
              name="image"
              value={formData.image}
              onChange={handleInputChange}
              placeholder="https://example.com/image.jpg"
              className="input-field"
              maxLength={200}
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              {formData.image.length}/200 characters
            </p>
          </div>

          {/* Price Field */}
          <div>
            <label htmlFor="price" className="block text-sm font-medium text-white mb-2">
              Price (ETH) *
            </label>
            <input
              type="number"
              id="price"
              name="price"
              value={formData.price}
              onChange={handleInputChange}
              placeholder="0.01"
              step="0.001"
              min="0"
              className="input-field"
              required
            />
          </div>

          {/* Preview */}
          {formData.image && (
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Preview
              </label>
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <img
                  src={formData.image}
                  alt="NFT Preview"
                  className="w-full h-48 object-cover rounded-lg mb-3"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <div className="text-white">
                  <h3 className="font-semibold">{formData.name || 'Untitled'}</h3>
                  <p className="text-gray-300 text-sm">{formData.description || 'No description'}</p>
                  {formData.price && (
                    <p className="text-purple-400 font-medium mt-2">
                      {parseFloat(formData.price).toFixed(4)} ETH
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Status Message */}
          {mintStatus && (
            <div className={`p-4 rounded-lg border ${
              mintStatus.type === 'success' 
                ? 'bg-green-500/20 border-green-500/30' 
                : 'bg-red-500/20 border-red-500/30'
            }`}>
              <div className="flex items-center space-x-2">
                {mintStatus.type === 'success' ? (
                  <CheckCircle size={16} className="text-green-400" />
                ) : (
                  <AlertCircle size={16} className="text-red-400" />
                )}
                <span className={`text-sm ${
                  mintStatus.type === 'success' ? 'text-green-400' : 'text-red-400'
                }`}>
                  {mintStatus.message}
                </span>
              </div>
              {mintStatus.hash && (
                <a
                  href={`${NETWORKS[currentNetwork]?.blockExplorerUrls[0]}tx/${mintStatus.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-xs mt-1 block"
                >
                  View on {currentNetwork === 'holesky' ? 'Holesky Explorer' : 'Etherscan'} →
                </a>
              )}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isMinting}
            className="w-full btn-primary flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {isMinting ? (
              <>
                <Loader size={16} className="animate-spin" />
                <span>Minting...</span>
              </>
            ) : (
              <>
                <Plus size={16} />
                <span>Mint NFT</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default MintSection; 