// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title MailRegistry
 * @dev Manages mail registration, tracking, and metadata
 */
contract MailRegistry is Ownable, ReentrancyGuard {
    
    enum MailType { DOCUMENT, PACKAGE, CERTIFIED, PRIORITY }
    enum Priority { STANDARD, PRIORITY, EXPRESS }
    enum MailStatus { REGISTERED, COLLECTED, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, EXCEPTION }
    
    struct MailMetadata {
        string weight;
        string size;
        Priority priority;
        uint256 insurance; // in wei
        bool requiresSignature;
    }
    
    struct MailItem {
        string mailId;
        string trackingNumber;
        address senderAddress;
        string recipientId;
        MailType mailType;
        uint256 registrationTime;
        uint256 guaranteedDeliveryTime;
        bool proofOfTimeRequired;
        MailMetadata metadata;
        MailStatus currentStatus;
        uint256 deliveryTime;
        bool isActive;
        bytes32 proofOfTimeHash;
    }
    
    mapping(string => MailItem) public mailItems;
    mapping(string => string) public trackingToMailId;
    mapping(address => string[]) public senderMails;
    mapping(string => bool) public mailExists;
    
    string[] public allMailIds;
    uint256 public totalMails;
    
    event MailRegistered(
        string indexed mailId,
        string trackingNumber,
        address indexed senderAddress,
        string recipientId,
        uint256 registrationTime,
        uint256 guaranteedDeliveryTime
    );
    
    event MailStatusUpdated(
        string indexed mailId,
        MailStatus previousStatus,
        MailStatus newStatus,
        uint256 timestamp
    );
    
    event MailDelivered(
        string indexed mailId,
        uint256 deliveryTime,
        uint256 guaranteedTime,
        bool onTime
    );
    
    event ProofOfTimeGenerated(
        string indexed mailId,
        bytes32 proofHash,
        uint256 timestamp
    );
    
    modifier mailExistsModifier(string memory mailId) {
        require(mailExists[mailId], "Mail item does not exist");
        _;
    }
    
    modifier onlySender(string memory mailId) {
        require(mailItems[mailId].senderAddress == msg.sender, "Only sender can perform this action");
        _;
    }
    
    constructor() Ownable(msg.sender) {}
    
    /**
     * @dev Register a new mail item
     */
    function registerMail(
        string memory mailId,
        string memory trackingNumber,
        address senderAddress,
        string memory recipientId,
        MailType mailType,
        uint256 guaranteedDeliveryTime,
        bool proofOfTimeRequired,
        MailMetadata memory metadata
    ) external nonReentrant returns (bytes32) {
        require(!mailExists[mailId], "Mail ID already exists");
        require(bytes(trackingNumber).length > 0, "Tracking number cannot be empty");
        require(senderAddress != address(0), "Invalid sender address");
        require(bytes(recipientId).length > 0, "Recipient ID cannot be empty");
        require(guaranteedDeliveryTime > block.timestamp, "Guaranteed delivery time must be in the future");
        
        bytes32 proofHash = keccak256(abi.encodePacked(
            mailId,
            trackingNumber,
            senderAddress,
            block.timestamp,
            block.number
        ));
        
        mailItems[mailId] = MailItem({
            mailId: mailId,
            trackingNumber: trackingNumber,
            senderAddress: senderAddress,
            recipientId: recipientId,
            mailType: mailType,
            registrationTime: block.timestamp,
            guaranteedDeliveryTime: guaranteedDeliveryTime,
            proofOfTimeRequired: proofOfTimeRequired,
            metadata: metadata,
            currentStatus: MailStatus.REGISTERED,
            deliveryTime: 0,
            isActive: true,
            proofOfTimeHash: proofHash
        });
        
        trackingToMailId[trackingNumber] = mailId;
        senderMails[senderAddress].push(mailId);
        mailExists[mailId] = true;
        allMailIds.push(mailId);
        totalMails++;
        
        emit MailRegistered(
            mailId,
            trackingNumber,
            senderAddress,
            recipientId,
            block.timestamp,
            guaranteedDeliveryTime
        );
        
        emit ProofOfTimeGenerated(mailId, proofHash, block.timestamp);
        
        return proofHash;
    }
    
    /**
     * @dev Update mail status
     */
    function updateMailStatus(
        string memory mailId,
        MailStatus newStatus
    ) external mailExistsModifier(mailId) {
        MailItem storage mail = mailItems[mailId];
        MailStatus previousStatus = mail.currentStatus;
        
        require(newStatus != previousStatus, "Status must be different");
        require(mail.isActive, "Mail item is not active");
        
        mail.currentStatus = newStatus;
        
        // If delivered, record delivery time
        if (newStatus == MailStatus.DELIVERED && mail.deliveryTime == 0) {
            mail.deliveryTime = block.timestamp;
            
            bool onTime = block.timestamp <= mail.guaranteedDeliveryTime;
            
            emit MailDelivered(
                mailId,
                block.timestamp,
                mail.guaranteedDeliveryTime,
                onTime
            );
        }
        
        emit MailStatusUpdated(mailId, previousStatus, newStatus, block.timestamp);
    }
    
    /**
     * @dev Get mail details by mail ID
     */
    function getMailDetails(string memory mailId) external view mailExistsModifier(mailId) returns (
        string memory trackingNumber,
        address senderAddress,
        string memory recipientId,
        MailType mailType,
        MailStatus currentStatus,
        uint256 registrationTime,
        uint256 deliveryTime,
        uint256 guaranteedDeliveryTime,
        bool proofOfTimeRequired,
        bytes32 proofOfTimeHash
    ) {
        MailItem memory mail = mailItems[mailId];
        return (
            mail.trackingNumber,
            mail.senderAddress,
            mail.recipientId,
            mail.mailType,
            mail.currentStatus,
            mail.registrationTime,
            mail.deliveryTime,
            mail.guaranteedDeliveryTime,
            mail.proofOfTimeRequired,
            mail.proofOfTimeHash
        );
    }
    
    /**
     * @dev Get mail details by tracking number
     */
    function getMailByTracking(string memory trackingNumber) external view returns (
        string memory mailId,
        address senderAddress,
        string memory recipientId,
        MailStatus currentStatus,
        uint256 registrationTime,
        uint256 guaranteedDeliveryTime
    ) {
        string memory id = trackingToMailId[trackingNumber];
        require(mailExists[id], "Tracking number not found");
        
        MailItem memory mail = mailItems[id];
        return (
            id,
            mail.senderAddress,
            mail.recipientId,
            mail.currentStatus,
            mail.registrationTime,
            mail.guaranteedDeliveryTime
        );
    }
    
    /**
     * @dev Get all mail IDs for a sender
     */
    function getSenderMails(address sender) external view returns (string[] memory) {
        return senderMails[sender];
    }
    
    /**
     * @dev Get mail metadata
     */
    function getMailMetadata(string memory mailId) external view mailExistsModifier(mailId) returns (
        string memory weight,
        string memory size,
        Priority priority,
        uint256 insurance,
        bool requiresSignature
    ) {
        MailMetadata memory metadata = mailItems[mailId].metadata;
        return (
            metadata.weight,
            metadata.size,
            metadata.priority,
            metadata.insurance,
            metadata.requiresSignature
        );
    }
    
    /**
     * @dev Check if delivery was on time
     */
    function isDeliveredOnTime(string memory mailId) external view mailExistsModifier(mailId) returns (bool) {
        MailItem memory mail = mailItems[mailId];
        require(mail.currentStatus == MailStatus.DELIVERED, "Mail not delivered yet");
        
        return mail.deliveryTime <= mail.guaranteedDeliveryTime;
    }
    
    /**
     * @dev Get bulk status for multiple mail IDs
     */
    function getBulkStatus(string[] memory mailIds) external view returns (
        MailStatus[] memory statuses,
        bool[] memory onTimeStatus,
        bytes32[] memory proofHashes
    ) {
        uint256 length = mailIds.length;
        statuses = new MailStatus[](length);
        onTimeStatus = new bool[](length);
        proofHashes = new bytes32[](length);
        
        for (uint256 i = 0; i < length; i++) {
            if (mailExists[mailIds[i]]) {
                MailItem memory mail = mailItems[mailIds[i]];
                statuses[i] = mail.currentStatus;
                
                if (mail.currentStatus == MailStatus.DELIVERED) {
                    onTimeStatus[i] = mail.deliveryTime <= mail.guaranteedDeliveryTime;
                } else {
                    onTimeStatus[i] = block.timestamp <= mail.guaranteedDeliveryTime;
                }
                
                proofHashes[i] = mail.proofOfTimeHash;
            }
        }
        
        return (statuses, onTimeStatus, proofHashes);
    }
    
    /**
     * @dev Set guaranteed delivery time (only sender)
     */
    function setGuaranteedDeliveryTime(
        string memory mailId,
        uint256 newGuaranteedTime
    ) external mailExistsModifier(mailId) onlySender(mailId) {
        require(newGuaranteedTime > block.timestamp, "Time must be in the future");
        require(mailItems[mailId].currentStatus != MailStatus.DELIVERED, "Cannot change time for delivered mail");
        
        mailItems[mailId].guaranteedDeliveryTime = newGuaranteedTime;
    }
    
    /**
     * @dev Get total number of mails
     */
    function getTotalMails() external view returns (uint256) {
        return totalMails;
    }
    
    /**
     * @dev Get all mail IDs (paginated)
     */
    function getAllMailIds(uint256 offset, uint256 limit) external view returns (string[] memory) {
        require(offset < allMailIds.length, "Offset out of bounds");
        
        uint256 end = offset + limit;
        if (end > allMailIds.length) {
            end = allMailIds.length;
        }
        
        string[] memory result = new string[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = allMailIds[i];
        }
        
        return result;
    }
}
