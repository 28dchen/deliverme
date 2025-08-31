// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title DeliveryTracking
 * @dev Manages delivery status updates, worker tracking, and location data
 */
contract DeliveryTracking is Ownable, ReentrancyGuard {
    
    enum DeliveryStatus { 
        REGISTERED, 
        COLLECTED, 
        IN_TRANSIT, 
        OUT_FOR_DELIVERY, 
        DELIVERED, 
        EXCEPTION 
    }
    
    struct Coordinates {
        int256 latitude;  // Multiplied by 1e6 for precision
        int256 longitude; // Multiplied by 1e6 for precision
    }
    
    struct ProofOfTime {
        string ntpServer;
        uint256 atomicTime;
        string timezone;
    }
    
    struct StatusUpdate {
        string trackingNumber;
        address workerAddress;
        string location;
        Coordinates coordinates;
        DeliveryStatus status;
        uint256 timestamp;
        bytes signature;
        ProofOfTime proofOfTime;
        uint256 blockNumber;
        bytes32 timeProofHash;
    }
    
    struct Worker {
        bool isAuthorized;
        string name;
        string role;
        uint256 registrationTime;
        uint256 totalUpdates;
    }
    
    mapping(string => StatusUpdate[]) public trackingHistory;
    mapping(string => DeliveryStatus) public currentStatus;
    mapping(address => Worker) public workers;
    mapping(string => uint256) public lastUpdateTime;
    mapping(string => address) public lastUpdatedBy;
    
    address[] public authorizedWorkers;
    
    event WorkerRegistered(address indexed workerAddress, string name, string role, uint256 timestamp);
    event WorkerDeauthorized(address indexed workerAddress, uint256 timestamp);
    event StatusUpdated(
        string indexed trackingNumber,
        address indexed workerAddress,
        DeliveryStatus status,
        string location,
        uint256 timestamp,
        bytes32 timeProofHash
    );
    event LocationUpdated(
        string indexed trackingNumber,
        int256 latitude,
        int256 longitude,
        uint256 timestamp
    );
    event EmergencyAlert(
        string indexed trackingNumber,
        string reason,
        uint256 timestamp,
        address alertedBy
    );
    
    modifier onlyAuthorizedWorker() {
        require(workers[msg.sender].isAuthorized, "Not an authorized worker");
        _;
    }
    
    modifier validTrackingNumber(string memory trackingNumber) {
        require(bytes(trackingNumber).length > 0, "Invalid tracking number");
        _;
    }
    
    constructor() Ownable(msg.sender) {}
    
    /**
     * @dev Register a new authorized worker
     */
    function registerWorker(
        address workerAddress,
        string memory name,
        string memory role
    ) external onlyOwner {
        require(workerAddress != address(0), "Invalid worker address");
        require(!workers[workerAddress].isAuthorized, "Worker already registered");
        require(bytes(name).length > 0, "Name cannot be empty");
        require(bytes(role).length > 0, "Role cannot be empty");
        
        workers[workerAddress] = Worker({
            isAuthorized: true,
            name: name,
            role: role,
            registrationTime: block.timestamp,
            totalUpdates: 0
        });
        
        authorizedWorkers.push(workerAddress);
        
        emit WorkerRegistered(workerAddress, name, role, block.timestamp);
    }
    
    /**
     * @dev Deauthorize a worker
     */
    function deauthorizeWorker(address workerAddress) external onlyOwner {
        require(workers[workerAddress].isAuthorized, "Worker not authorized");
        
        workers[workerAddress].isAuthorized = false;
        
        emit WorkerDeauthorized(workerAddress, block.timestamp);
    }
    
    /**
     * @dev Update delivery status with location and proof of time
     */
    function updateStatus(
        string memory trackingNumber,
        string memory location,
        Coordinates memory coordinates,
        DeliveryStatus status,
        bytes memory signature,
        ProofOfTime memory proofOfTime
    ) external onlyAuthorizedWorker validTrackingNumber(trackingNumber) nonReentrant {
        require(bytes(location).length > 0, "Location cannot be empty");
        require(coordinates.latitude >= -90000000 && coordinates.latitude <= 90000000, "Invalid latitude");
        require(coordinates.longitude >= -180000000 && coordinates.longitude <= 180000000, "Invalid longitude");
        
        // Generate time proof hash
        bytes32 timeProofHash = keccak256(abi.encodePacked(
            trackingNumber,
            msg.sender,
            location,
            coordinates.latitude,
            coordinates.longitude,
            uint256(status),
            block.timestamp,
            block.number,
            proofOfTime.ntpServer,
            proofOfTime.atomicTime
        ));
        
        StatusUpdate memory update = StatusUpdate({
            trackingNumber: trackingNumber,
            workerAddress: msg.sender,
            location: location,
            coordinates: coordinates,
            status: status,
            timestamp: block.timestamp,
            signature: signature,
            proofOfTime: proofOfTime,
            blockNumber: block.number,
            timeProofHash: timeProofHash
        });
        
        trackingHistory[trackingNumber].push(update);
        currentStatus[trackingNumber] = status;
        lastUpdateTime[trackingNumber] = block.timestamp;
        lastUpdatedBy[trackingNumber] = msg.sender;
        
        workers[msg.sender].totalUpdates++;
        
        emit StatusUpdated(
            trackingNumber,
            msg.sender,
            status,
            location,
            block.timestamp,
            timeProofHash
        );
        
        emit LocationUpdated(
            trackingNumber,
            coordinates.latitude,
            coordinates.longitude,
            block.timestamp
        );
    }
    
    /**
     * @dev Get complete tracking history for a package
     */
    function getTrackingHistory(string memory trackingNumber) 
        external 
        view 
        validTrackingNumber(trackingNumber) 
        returns (StatusUpdate[] memory) 
    {
        return trackingHistory[trackingNumber];
    }
    
    /**
     * @dev Get current status of a package
     */
    function getCurrentStatus(string memory trackingNumber) 
        external 
        view 
        validTrackingNumber(trackingNumber) 
        returns (
            DeliveryStatus status,
            string memory location,
            Coordinates memory coordinates,
            uint256 lastUpdate,
            address lastUpdatedByAddr
        ) 
    {
        StatusUpdate[] memory history = trackingHistory[trackingNumber];
        require(history.length > 0, "No tracking history found");
        
        StatusUpdate memory latestUpdate = history[history.length - 1];
        
        return (
            currentStatus[trackingNumber],
            latestUpdate.location,
            latestUpdate.coordinates,
            lastUpdateTime[trackingNumber],
            lastUpdatedBy[trackingNumber]
        );
    }
    
    /**
     * @dev Get worker information
     */
    function getWorkerInfo(address workerAddress) external view returns (
        bool isAuthorized,
        string memory name,
        string memory role,
        uint256 registrationTime,
        uint256 totalUpdates
    ) {
        Worker memory worker = workers[workerAddress];
        return (
            worker.isAuthorized,
            worker.name,
            worker.role,
            worker.registrationTime,
            worker.totalUpdates
        );
    }
    
    /**
     * @dev Get delivery performance metrics
     */
    function getDeliveryPerformance(string memory trackingNumber) 
        external 
        view 
        validTrackingNumber(trackingNumber) 
        returns (
            uint256 totalMilestones,
            uint256 registrationTime,
            uint256 lastUpdateTimestamp,
            bool isDelivered,
            uint256 totalTransitTime
        ) 
    {
        StatusUpdate[] memory history = trackingHistory[trackingNumber];
        require(history.length > 0, "No tracking history found");
        
        bool delivered = currentStatus[trackingNumber] == DeliveryStatus.DELIVERED;
        uint256 transitTime = 0;
        
        if (delivered) {
            transitTime = history[history.length - 1].timestamp - history[0].timestamp;
        }
        
        return (
            history.length,
            history[0].timestamp,
            history[history.length - 1].timestamp,
            delivered,
            transitTime
        );
    }
    
    /**
     * @dev Get bulk status for multiple tracking numbers
     */
    function getBulkStatus(string[] memory trackingNumbers) 
        external 
        view 
        returns (
            DeliveryStatus[] memory statuses,
            uint256[] memory lastUpdates,
            string[] memory locations
        ) 
    {
        uint256 length = trackingNumbers.length;
        statuses = new DeliveryStatus[](length);
        lastUpdates = new uint256[](length);
        locations = new string[](length);
        
        for (uint256 i = 0; i < length; i++) {
            if (trackingHistory[trackingNumbers[i]].length > 0) {
                statuses[i] = currentStatus[trackingNumbers[i]];
                lastUpdates[i] = lastUpdateTime[trackingNumbers[i]];
                
                StatusUpdate[] memory history = trackingHistory[trackingNumbers[i]];
                locations[i] = history[history.length - 1].location;
            }
        }
        
        return (statuses, lastUpdates, locations);
    }
    
    /**
     * @dev Generate emergency alert for delivery issues
     */
    function generateEmergencyAlert(
        string memory trackingNumber,
        string memory reason
    ) external onlyAuthorizedWorker validTrackingNumber(trackingNumber) {
        require(bytes(reason).length > 0, "Reason cannot be empty");
        
        emit EmergencyAlert(trackingNumber, reason, block.timestamp, msg.sender);
    }
    
    /**
     * @dev Get all authorized workers
     */
    function getAuthorizedWorkers() external view returns (address[] memory) {
        uint256 activeCount = 0;
        
        // Count active workers
        for (uint256 i = 0; i < authorizedWorkers.length; i++) {
            if (workers[authorizedWorkers[i]].isAuthorized) {
                activeCount++;
            }
        }
        
        address[] memory activeWorkers = new address[](activeCount);
        uint256 index = 0;
        
        // Add active workers to array
        for (uint256 i = 0; i < authorizedWorkers.length; i++) {
            if (workers[authorizedWorkers[i]].isAuthorized) {
                activeWorkers[index] = authorizedWorkers[i];
                index++;
            }
        }
        
        return activeWorkers;
    }
    
    /**
     * @dev Verify time proof hash
     */
    function verifyTimeProof(
        string memory trackingNumber,
        uint256 updateIndex,
        bytes32 expectedHash
    ) external view validTrackingNumber(trackingNumber) returns (bool) {
        StatusUpdate[] memory history = trackingHistory[trackingNumber];
        require(updateIndex < history.length, "Update index out of bounds");
        
        return history[updateIndex].timeProofHash == expectedHash;
    }
}
