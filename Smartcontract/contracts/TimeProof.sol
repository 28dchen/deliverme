// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title TimeProof
 * @dev Generates and verifies cryptographic proofs of specific timestamps
 */
contract TimeProof is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;
    
    enum EventType { 
        REGISTRATION, 
        PICKUP, 
        DELIVERY_CONFIRMATION, 
        DISPUTE 
    }
    
    struct TimeProofData {
        string mailId;
        EventType eventType;
        uint256 timestamp;
        bytes32 blockHash;
        uint256 blockNumber;
        uint256 transactionIndex;
        bytes32[] merkleProof;
        bytes atomicTimeSignature;
        string ntpServerUsed;
        bytes32[] certificateChain;
        address requestedBy;
        bool isVerified;
        uint256 creationTime;
    }
    
    struct AtomicTimeData {
        uint256 timestamp;
        string ntpServer;
        bytes signature;
        address timestampAuthority;
    }
    
    mapping(bytes32 => TimeProofData) public timeProofs;
    mapping(string => bytes32[]) public mailTimeProofs;
    mapping(address => bool) public authorizedTimestampAuthorities;
    mapping(bytes32 => bool) public usedNonces;
    
    bytes32[] public allProofHashes;
    uint256 public totalProofs;
    
    event TimeProofGenerated(
        bytes32 indexed proofHash,
        string indexed mailId,
        EventType eventType,
        uint256 timestamp,
        address requestedBy
    );
    
    event TimeProofVerified(
        bytes32 indexed proofHash,
        bool isValid,
        uint256 verificationTime,
        address verifiedBy
    );
    
    event TimestampAuthorityAdded(address indexed authority, uint256 timestamp);
    event TimestampAuthorityRemoved(address indexed authority, uint256 timestamp);
    
    modifier onlyAuthorizedAuthority() {
        require(authorizedTimestampAuthorities[msg.sender], "Not an authorized timestamp authority");
        _;
    }
    
    modifier validMailId(string memory mailId) {
        require(bytes(mailId).length > 0, "Invalid mail ID");
        _;
    }
    
    modifier proofExists(bytes32 proofHash) {
        require(timeProofs[proofHash].timestamp != 0, "Time proof does not exist");
        _;
    }
    
    constructor() Ownable(msg.sender) {
        // Add owner as default timestamp authority
        authorizedTimestampAuthorities[msg.sender] = true;
        emit TimestampAuthorityAdded(msg.sender, block.timestamp);
    }
    
    /**
     * @dev Add authorized timestamp authority
     */
    function addTimestampAuthority(address authority) external onlyOwner {
        require(authority != address(0), "Invalid authority address");
        require(!authorizedTimestampAuthorities[authority], "Authority already authorized");
        
        authorizedTimestampAuthorities[authority] = true;
        
        emit TimestampAuthorityAdded(authority, block.timestamp);
    }
    
    /**
     * @dev Remove timestamp authority
     */
    function removeTimestampAuthority(address authority) external onlyOwner {
        require(authorizedTimestampAuthorities[authority], "Authority not authorized");
        require(authority != owner(), "Cannot remove contract owner");
        
        authorizedTimestampAuthorities[authority] = false;
        
        emit TimestampAuthorityRemoved(authority, block.timestamp);
    }
    
    /**
     * @dev Generate a time proof for a specific mail event
     */
    function generateTimeProof(
        string memory mailId,
        EventType eventType,
        address requestedBy,
        AtomicTimeData memory atomicTime,
        bytes32[] memory certificateChain,
        bytes32 nonce
    ) external onlyAuthorizedAuthority validMailId(mailId) nonReentrant returns (bytes32) {
        require(requestedBy != address(0), "Invalid requester address");
        require(!usedNonces[nonce], "Nonce already used");
        require(atomicTime.timestamp <= block.timestamp + 300, "Atomic time too far in future"); // 5 min tolerance
        require(atomicTime.timestamp >= block.timestamp - 300, "Atomic time too far in past");
        require(certificateChain.length > 0, "Certificate chain cannot be empty");
        
        usedNonces[nonce] = true;
        
        // Generate merkle proof elements (simplified for demo)
        bytes32[] memory merkleProof = new bytes32[](3);
        merkleProof[0] = keccak256(abi.encodePacked(mailId, eventType));
        merkleProof[1] = keccak256(abi.encodePacked(block.timestamp, block.number));
        merkleProof[2] = keccak256(abi.encodePacked(requestedBy, atomicTime.timestamp));
        
        bytes32 proofHash = keccak256(abi.encodePacked(
            mailId,
            uint256(eventType),
            block.timestamp,
            block.number,
            requestedBy,
            atomicTime.timestamp,
            atomicTime.ntpServer,
            nonce
        ));
        
        TimeProofData memory proof = TimeProofData({
            mailId: mailId,
            eventType: eventType,
            timestamp: block.timestamp,
            blockHash: blockhash(block.number - 1),
            blockNumber: block.number,
            transactionIndex: 0, // Would be set by indexer in real implementation
            merkleProof: merkleProof,
            atomicTimeSignature: atomicTime.signature,
            ntpServerUsed: atomicTime.ntpServer,
            certificateChain: certificateChain,
            requestedBy: requestedBy,
            isVerified: false,
            creationTime: block.timestamp
        });
        
        timeProofs[proofHash] = proof;
        mailTimeProofs[mailId].push(proofHash);
        allProofHashes.push(proofHash);
        totalProofs++;
        
        emit TimeProofGenerated(
            proofHash,
            mailId,
            eventType,
            block.timestamp,
            requestedBy
        );
        
        return proofHash;
    }
    
    /**
     * @dev Verify a time proof
     */
    function verifyTimeProof(bytes32 proofHash) external proofExists(proofHash) returns (bool) {
        TimeProofData storage proof = timeProofs[proofHash];
        
        // Verify blockchain data
        bool blockchainValid = proof.blockNumber > 0 && proof.blockNumber <= block.number;
        
        // Verify merkle proof (simplified verification)
        bool merkleValid = proof.merkleProof.length > 0;
        
        // Verify atomic time signature (simplified - would verify against NTP authority in real implementation)
        bool atomicTimeValid = proof.atomicTimeSignature.length > 0;
        
        // Verify certificate chain (simplified)
        bool certificateValid = proof.certificateChain.length > 0;
        
        bool isValid = blockchainValid && merkleValid && atomicTimeValid && certificateValid;
        
        proof.isVerified = isValid;
        
        emit TimeProofVerified(proofHash, isValid, block.timestamp, msg.sender);
        
        return isValid;
    }
    
    /**
     * @dev Get time proof details
     */
    function getTimeProof(bytes32 proofHash) external view proofExists(proofHash) returns (
        string memory mailId,
        EventType eventType,
        uint256 timestamp,
        bytes32 blockHash,
        uint256 blockNumber,
        string memory ntpServerUsed,
        address requestedBy,
        bool isVerified,
        uint256 creationTime
    ) {
        TimeProofData memory proof = timeProofs[proofHash];
        return (
            proof.mailId,
            proof.eventType,
            proof.timestamp,
            proof.blockHash,
            proof.blockNumber,
            proof.ntpServerUsed,
            proof.requestedBy,
            proof.isVerified,
            proof.creationTime
        );
    }
    
    /**
     * @dev Get all time proof hashes for a mail item
     */
    function getMailTimeProofs(string memory mailId) external view validMailId(mailId) returns (bytes32[] memory) {
        return mailTimeProofs[mailId];
    }
    
    /**
     * @dev Get merkle proof for verification
     */
    function getMerkleProof(bytes32 proofHash) external view proofExists(proofHash) returns (bytes32[] memory) {
        return timeProofs[proofHash].merkleProof;
    }
    
    /**
     * @dev Get certificate chain for a proof
     */
    function getCertificateChain(bytes32 proofHash) external view proofExists(proofHash) returns (bytes32[] memory) {
        return timeProofs[proofHash].certificateChain;
    }
    
    /**
     * @dev Batch verify multiple time proofs
     */
    function batchVerifyTimeProofs(bytes32[] memory proofHashes) external returns (bool[] memory) {
        uint256 length = proofHashes.length;
        bool[] memory results = new bool[](length);
        
        for (uint256 i = 0; i < length; i++) {
            if (timeProofs[proofHashes[i]].timestamp != 0) {
                results[i] = this.verifyTimeProof(proofHashes[i]);
            } else {
                results[i] = false;
            }
        }
        
        return results;
    }
    
    /**
     * @dev Get verification status of a proof
     */
    function getVerificationStatus(bytes32 proofHash) external view proofExists(proofHash) returns (
        bool isVerified,
        bool blockchainConfirmed,
        bool atomicTimeVerified,
        bool merkleProofValid
    ) {
        TimeProofData memory proof = timeProofs[proofHash];
        
        return (
            proof.isVerified,
            proof.blockNumber > 0 && proof.blockNumber <= block.number,
            proof.atomicTimeSignature.length > 0,
            proof.merkleProof.length > 0
        );
    }
    
    /**
     * @dev Generate simple time proof without external atomic time (for testing)
     */
    function generateSimpleTimeProof(
        string memory mailId,
        EventType eventType,
        address requestedBy
    ) external validMailId(mailId) returns (bytes32) {
        bytes32 nonce = keccak256(abi.encodePacked(block.timestamp, block.prevrandao, msg.sender));
        require(!usedNonces[nonce], "Nonce collision");
        
        AtomicTimeData memory atomicTime = AtomicTimeData({
            timestamp: block.timestamp,
            ntpServer: "internal",
            signature: abi.encodePacked(block.timestamp),
            timestampAuthority: msg.sender
        });
        
        bytes32[] memory certificateChain = new bytes32[](1);
        certificateChain[0] = keccak256(abi.encodePacked("internal_certificate", block.timestamp));
        
        return this.generateTimeProof(
            mailId,
            eventType,
            requestedBy,
            atomicTime,
            certificateChain,
            nonce
        );
    }
    
    /**
     * @dev Get total number of proofs
     */
    function getTotalProofs() external view returns (uint256) {
        return totalProofs;
    }
    
    /**
     * @dev Get all proof hashes (paginated)
     */
    function getAllProofHashes(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
        require(offset < allProofHashes.length, "Offset out of bounds");
        
        uint256 end = offset + limit;
        if (end > allProofHashes.length) {
            end = allProofHashes.length;
        }
        
        bytes32[] memory result = new bytes32[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = allProofHashes[i];
        }
        
        return result;
    }
}
