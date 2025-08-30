// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// OpenZeppelin imports (v5+)
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract NFTMarketplace is ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    struct Metadata {
        string name;
        string description;
        string image;
        uint256 price;
        bool forSale;
        address currentOwner;
        uint256 createdAt;
    }

    mapping(uint256 => Metadata) public nftMetadata;

    // Events
    event FundsReceived(address indexed from, uint256 amount);
    event ContractInitialized(address indexed owner, uint256 timestamp);
    event NftMinted(
        uint256 indexed tokenId,
        address indexed owner,
        string name,
        string description,
        string image,
        uint256 price,
        uint256 timestamp
    );
       event NftMintedRelease(
        uint256 indexed tokenId,
        address indexed owner,
        string name,
        string description,
        string image,
        uint256 price,
        uint256 timestamp,
        address indexed caller
    );


    
    event NftTransferred(
        uint256 indexed tokenId,
        address indexed from,
        address indexed to,
        uint256 timestamp
    );
    event NftPriceUpdated(
        uint256 indexed tokenId,
        address indexed owner,
        uint256 previousPrice,
        uint256 newPrice,
        bool newForSale,
        uint256 timestamp
    );
    event NftSold(
        uint256 indexed tokenId,
        address indexed seller,
        address indexed buyer,
        uint256 price,
        uint256 timestamp
    );
    event NftMetadataUpdated(
        uint256 indexed tokenId,
        address indexed owner,
        string name,
        string description,
        string image,
        uint256 timestamp
    );
    
event NftBurned(
    uint256 indexed tokenId,
    address indexed owner,
    string name,
    string description,
    string image,
    uint256 price,
    bool forSale,
    uint256 createdAt,
    string destinationChain,
    string destinationAddress,
    uint256 timestamp
);

   /// @dev Only this hardcoded address can call mint_nft_release
    modifier onlyRelayer() {
        require(
            msg.sender == 0x6aa3a45c64B45BF5eb031A4Ae18059e36e674E9c,
            "Not authorized"
        );
        _;
    }


    /// ✅ Constructor: now takes an explicit owner argument (for OpenZeppelin v5+)
    constructor(address initialOwner) ERC721("OrigynNFT", "ONFT") Ownable() {
        emit ContractInitialized(initialOwner, block.timestamp);
    }

      function mint_nft_release(
        address owner,
        string memory name,
        string memory description,
        string memory image,
        uint256 price
    ) public onlyRelayer returns (uint256) {
        require(bytes(name).length <= 32, "Name too long");
        require(bytes(description).length <= 200, "Description too long");
        require(bytes(image).length <= 200, "Image URL too long");

        _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();

        _mint(owner, newItemId);
        _setTokenURI(newItemId, image);

        nftMetadata[newItemId] = Metadata({
            name: name,
            description: description,
            image: image,
            price: price,
            forSale: false,
            currentOwner: owner,
            createdAt: block.timestamp
        });

        emit NftMintedRelease(newItemId, owner, name, description, image, price, block.timestamp,msg.sender);
        return newItemId;
    }


    function getNFTsByOwner(address owner) public view returns (Metadata[] memory) {
    uint256 totalTokens = _tokenIds.current();
    uint256 count = 0;

    // First count how many NFTs are owned by the owner:
    for (uint256 i = 1; i <= totalTokens; i++) {
        if (nftMetadata[i].currentOwner == owner) {
            count++;
        }
    }

    // Now create an array of that size and fill it
    Metadata[] memory result = new Metadata[](count);
    uint256 index = 0;

    for (uint256 i = 1; i <= totalTokens; i++) {
        if (nftMetadata[i].currentOwner == owner) {
            result[index] = nftMetadata[i];
            index++;
        }
    }

    return result;
}


    function mintNFT(
        string memory name,
        string memory description,
        string memory image,
        uint256 price
    ) public returns (uint256) {
        require(bytes(name).length <= 32, "Name too long");
        require(bytes(description).length <= 200, "Description too long");
        require(bytes(image).length <= 200, "Image URL too long");

        _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();

        _mint(msg.sender, newItemId);
        _setTokenURI(newItemId, image);

        nftMetadata[newItemId] = Metadata({
            name: name,
            description: description,
            image: image,
            price: price,
            forSale: false,
            currentOwner: msg.sender,
            createdAt: block.timestamp
        });

        emit NftMinted(newItemId, msg.sender, name, description, image, price, block.timestamp);
        return newItemId;
    }

    function transferNFT(address to, uint256 tokenId) public {
        require(ownerOf(tokenId) == msg.sender, "Not owner");

        safeTransferFrom(msg.sender, to, tokenId);
        nftMetadata[tokenId].currentOwner = to;
        nftMetadata[tokenId].forSale = false;
        nftMetadata[tokenId].price = 0;

        emit NftTransferred(tokenId, msg.sender, to, block.timestamp);
    }

    function setPrice(uint256 tokenId, uint256 price) public {
        require(ownerOf(tokenId) == msg.sender, "Not owner");

        uint256 previousPrice = nftMetadata[tokenId].price;
        bool newForSale = price > 0;

        nftMetadata[tokenId].price = price;
        nftMetadata[tokenId].forSale = newForSale;

        emit NftPriceUpdated(tokenId, msg.sender, previousPrice, price, newForSale, block.timestamp);
    }

    function buyNFT(uint256 tokenId) public payable {
        Metadata storage meta = nftMetadata[tokenId];
        address seller = meta.currentOwner;

        require(meta.forSale, "NFT not for sale");
        require(meta.price > 0, "Invalid price");
        require(msg.value == meta.price, "Incorrect ETH amount");
        require(seller != msg.sender, "Cannot buy your own NFT");

        payable(seller).transfer(msg.value);
        _transfer(seller, msg.sender, tokenId);

        meta.currentOwner = msg.sender;
        meta.forSale = false;
        meta.price = 0;

        emit NftSold(tokenId, seller, msg.sender, msg.value, block.timestamp);
    }

    function updateMetadata(
        uint256 tokenId,
        string memory name,
        string memory description,
        string memory image
    ) public {
        require(ownerOf(tokenId) == msg.sender, "Not owner");

        if (bytes(name).length > 0) {
            require(bytes(name).length <= 32, "Name too long");
            nftMetadata[tokenId].name = name;
        }

        if (bytes(description).length > 0) {
            require(bytes(description).length <= 200, "Description too long");
            nftMetadata[tokenId].description = description;
        }

        if (bytes(image).length > 0) {
            require(bytes(image).length <= 200, "Image too long");
            nftMetadata[tokenId].image = image;
            _setTokenURI(tokenId, image);
        }

        emit NftMetadataUpdated(tokenId, msg.sender, name, description, image, block.timestamp);
    }

function burnNFT(
    uint256 tokenId,
    string memory destinationChain,
    string memory destinationAddress
) public {
    require(ownerOf(tokenId) == msg.sender, "Not owner");

    // Read metadata before deletion
    Metadata memory meta = nftMetadata[tokenId];

    _burn(tokenId);
    delete nftMetadata[tokenId];

    emit NftBurned(
        tokenId,
        msg.sender,
        meta.name,
        meta.description,
        meta.image,
        meta.price,
        meta.forSale,
        meta.createdAt,
        destinationChain,
        destinationAddress,
        block.timestamp
    );
}

    // Read function
    function getMetadata(uint256 tokenId) public view returns (Metadata memory) {
        return nftMetadata[tokenId];
    }


    receive() external payable {
    // Optional: emit an event when contract receives ETH
    emit FundsReceived(msg.sender, msg.value);
}

// Allow receiving ETH with data
fallback() external payable {
    emit FundsReceived(msg.sender, msg.value);
}

}


