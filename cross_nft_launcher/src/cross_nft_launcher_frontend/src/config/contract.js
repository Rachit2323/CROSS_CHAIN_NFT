// Contract ABI - Simplified version for the main functions
export const CONTRACT_ABI = [
  {
    "type": "constructor",
    "stateMutability": "nonpayable",
    "inputs": [
      {
        "type": "address",
        "name": "initialOwner"
      }
    ]
  },
  {
    "type": "function",
    "name": "mintNFT",
    "stateMutability": "nonpayable",
    "inputs": [
      {
        "type": "string",
        "name": "name"
      },
      {
        "type": "string",
        "name": "description"
      },
      {
        "type": "string",
        "name": "image"
      },
      {
        "type": "uint256",
        "name": "price"
      }
    ],
    "outputs": [
      {
        "type": "uint256"
      }
    ]
  },
  {
    "type": "function",
    "name": "burnNFT",
    "stateMutability": "nonpayable",
    "inputs": [
      {
        "type": "uint256",
        "name": "tokenId"
      },
      {
        "type": "string",
        "name": "destinationChain"
      },
      {
        "type": "string",
        "name": "destinationAddress"
      }
    ],
    "outputs": []
  },
  {
    "type": "function",
    "name": "transferNFT",
    "stateMutability": "nonpayable",
    "inputs": [
      {
        "type": "address",
        "name": "to"
      },
      {
        "type": "uint256",
        "name": "tokenId"
      }
    ],
    "outputs": []
  },
  {
    "type": "function",
    "name": "setPrice",
    "stateMutability": "nonpayable",
    "inputs": [
      {
        "type": "uint256",
        "name": "tokenId"
      },
      {
        "type": "uint256",
        "name": "price"
      }
    ],
    "outputs": []
  },
  {
    "type": "function",
    "name": "buyNFT",
    "stateMutability": "payable",
    "inputs": [
      {
        "type": "uint256",
        "name": "tokenId"
      }
    ],
    "outputs": []
  },
  {
    "type": "function",
    "name": "updateMetadata",
    "stateMutability": "nonpayable",
    "inputs": [
      {
        "type": "uint256",
        "name": "tokenId"
      },
      {
        "type": "string",
        "name": "name"
      },
      {
        "type": "string",
        "name": "description"
      },
      {
        "type": "string",
        "name": "image"
      }
    ],
    "outputs": []
  },
  {
    "type": "function",
    "name": "getMetadata",
    "stateMutability": "view",
    "inputs": [
      {
        "type": "uint256",
        "name": "tokenId"
      }
    ],
    "outputs": [
      {
        "type": "tuple",
        "components": [
          {
            "type": "string",
            "name": "name"
          },
          {
            "type": "string",
            "name": "description"
          },
          {
            "type": "string",
            "name": "image"
          },
          {
            "type": "uint256",
            "name": "price"
          },
          {
            "type": "bool",
            "name": "forSale"
          },
          {
            "type": "address",
            "name": "currentOwner"
          },
          {
            "type": "uint256",
            "name": "createdAt"
          }
        ]
      }
    ]
  },
  {
    "type": "function",
    "name": "getNFTsByOwner",
    "stateMutability": "view",
    "inputs": [
      {
        "type": "address",
        "name": "owner"
      }
    ],
    "outputs": [
      {
        "type": "tuple[]",
        "components": [
          {
            "type": "string",
            "name": "name"
          },
          {
            "type": "string",
            "name": "description"
          },
          {
            "type": "string",
            "name": "image"
          },
          {
            "type": "uint256",
            "name": "price"
          },
          {
            "type": "bool",
            "name": "forSale"
          },
          {
            "type": "address",
            "name": "currentOwner"
          },
          {
            "type": "uint256",
            "name": "createdAt"
          }
        ]
      }
    ]
  },
  {
    "type": "function",
    "name": "ownerOf",
    "stateMutability": "view",
    "inputs": [
      {
        "type": "uint256",
        "name": "tokenId"
      }
    ],
    "outputs": [
      {
        "type": "address"
      }
    ]
  },
  {
    "type": "event",
    "name": "NftMinted",
    "inputs": [
      {
        "type": "uint256",
        "name": "tokenId",
        "indexed": true
      },
      {
        "type": "address",
        "name": "owner",
        "indexed": true
      },
      {
        "type": "string",
        "name": "name"
      },
      {
        "type": "string",
        "name": "description"
      },
      {
        "type": "string",
        "name": "image"
      },
      {
        "type": "uint256",
        "name": "price"
      },
      {
        "type": "uint256",
        "name": "timestamp"
      }
    ]
  },
  {
    "type": "event",
    "name": "NftBurned",
    "inputs": [
      {
        "type": "uint256",
        "name": "tokenId",
        "indexed": true
      },
      {
        "type": "address",
        "name": "owner",
        "indexed": true
      },
      {
        "type": "string",
        "name": "name"
      },
      {
        "type": "string",
        "name": "description"
      },
      {
        "type": "string",
        "name": "image"
      },
      {
        "type": "uint256",
        "name": "price"
      },
      {
        "type": "bool",
        "name": "forSale"
      },
      {
        "type": "uint256",
        "name": "createdAt"
      },
      {
        "type": "string",
        "name": "destinationChain"
      },
      {
        "type": "string",
        "name": "destinationAddress"
      },
      {
        "type": "uint256",
        "name": "timestamp"
      }
    ]
  }
];

// Network configurations
export const NETWORKS = {
  sepolia: {
    chainId: '0xaa36a7', // 11155111
    chainName: 'Sepolia Testnet',
    nativeCurrency: {
      name: 'Sepolia Ether',
      symbol: 'SEP',
      decimals: 18,
    },
    rpcUrls: ['https://sepolia.infura.io/v3/5149c676c7f9427eb71d094efdb9788b'],
    blockExplorerUrls: ['https://sepolia.etherscan.io/'],
    contractAddress: '0x800e11fb1f4c9b33eab0dd7aae19c2ae741be30c', // Updated Sepolia contract address
  },
  holesky: {
    chainId: '0x4268', // 17000
    chainName: 'Holesky Testnet',
    nativeCurrency: {
      name: 'Holesky Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://eth-holesky.g.alchemy.com/v2/OLoCeG14N_MLxJ5tFvD-k67DHU4Xc-ig'],
    blockExplorerUrls: ['https://holesky.etherscan.io/'],
    contractAddress: '0x027315bad2c06b0ab2a4f31c6b4b162f798a3b31', // Updated Holesky contract address
  },
};

// Default network
export const DEFAULT_NETWORK = 'sepolia'; 