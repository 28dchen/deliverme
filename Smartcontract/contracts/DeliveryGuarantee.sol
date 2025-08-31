// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title DeliveryGuarantee
 * @dev Manages delivery guarantees, escrow, penalties, and SLA compliance
 */
contract DeliveryGuarantee is Ownable, ReentrancyGuard {
    
    enum GuaranteeStatus { ACTIVE, FULFILLED, BREACHED, DISPUTED, CANCELLED }
    enum SLAStatus { ON_TIME, AT_RISK, DELAYED, EXCEEDED_EXPECTATIONS }
    
    struct Guarantee {
        string guaranteeId;
        string mailId;
        uint256 guaranteedTime;
        uint256 penaltyAmount;
        uint256 insuranceAmount;
        address customer;
        address escrowAddress;
        GuaranteeStatus status;
        uint256 creationTime;
        uint256 escrowAmount;
        bytes32 contractTermsHash;
        string[] escalationContacts;
        bool requiresProofOfTime;
        uint256 actualDeliveryTime;
        bool penaltyPaid;
    }
    
    struct PerformanceMetrics {
        uint256 totalGuarantees;
        uint256 onTimeDeliveries;
        uint256 delayedDeliveries;
        uint256 totalPenaltiesPaid;
        uint256 averageDeliveryTime;
        uint256 customerSatisfactionScore;
    }
    
    struct EscrowDetails {
        uint256 amount;
        address token; // address(0) for ETH
        bool isReleased;
        uint256 releaseTime;
        address releaseAuthority;
    }
    
    mapping(string => Guarantee) public guarantees;
    mapping(string => EscrowDetails) public escrowDetails;
    mapping(address => string[]) public customerGuarantees;
    mapping(string => bool) public guaranteeExists;
    mapping(address => PerformanceMetrics) public performanceMetrics;
    mapping(string => SLAStatus) public slaStatus;
    
    string[] public allGuaranteeIds;
    uint256 public totalGuarantees;
    uint256 public totalEscrowAmount;
    
    // Emergency contacts for SLA breaches
    mapping(string => address[]) public emergencyContacts;
    
    event GuaranteeCreated(
        string indexed guaranteeId,
        string indexed mailId,
        address indexed customer,
        uint256 guaranteedTime,
        uint256 penaltyAmount,
        uint256 escrowAmount
    );
    
    event GuaranteeUpdated(
        string indexed guaranteeId,
        GuaranteeStatus newStatus,
        uint256 timestamp
    );
    
    event EscrowDeposited(
        string indexed guaranteeId,
        uint256 amount,
        address token,
        address depositor
    );
    
    event EscrowReleased(
        string indexed guaranteeId,
        address recipient,
        uint256 amount,
        bool isPenalty
    );
    
    event SLAStatusUpdated(
        string indexed mailId,
        SLAStatus newStatus,
        uint256 timestamp
    );
    
    event EmergencyAlertTriggered(
        string indexed guaranteeId,
        string reason,
        uint256 timestamp,
        address[] notifiedContacts
    );
    
    event PenaltyPaid(
        string indexed guaranteeId,
        address recipient,
        uint256 amount,
        uint256 timestamp
    );
    
    modifier guaranteeExistsModifier(string memory guaranteeId) {
        require(guaranteeExists[guaranteeId], "Guarantee does not exist");
        _;
    }
    
    modifier onlyCustomer(string memory guaranteeId) {
        require(guarantees[guaranteeId].customer == msg.sender, "Only customer can perform this action");
        _;
    }
    
    modifier validGuaranteeTime(uint256 guaranteedTime) {
        require(guaranteedTime > block.timestamp, "Guaranteed time must be in the future");
        _;
    }
    
    constructor() Ownable(msg.sender) {}
    
    /**
     * @dev Estimate gas for guarantee creation (for gas estimation purposes)
     */
    function estimateGuaranteeCreation(
        string memory guaranteeId,
        string memory mailId,
        uint256 guaranteedTime,
        uint256 penaltyAmount,
        uint256 insuranceAmount,
        string[] memory escalationContacts,
        bool requiresProofOfTime,
        bytes32 contractTermsHash
    ) external view returns (uint256) {
        require(!guaranteeExists[guaranteeId], "Guarantee ID already exists");
        require(bytes(mailId).length > 0, "Mail ID cannot be empty");
        require(penaltyAmount > 0, "Penalty amount must be greater than 0");
        require(escalationContacts.length > 0, "Must provide escalation contacts");
        
        // This is just for gas estimation, so we don't check msg.value
        // The actual createGuarantee function will validate msg.value
        
        return 400000; // Base gas estimate
    }
    
    /**
     * @dev Create a new delivery guarantee with escrow
     */
    function createGuarantee(
        string memory guaranteeId,
        string memory mailId,
        uint256 guaranteedTime,
        uint256 penaltyAmount,
        uint256 insuranceAmount,
        string[] memory escalationContacts,
        bool requiresProofOfTime,
        bytes32 contractTermsHash
    ) external payable validGuaranteeTime(guaranteedTime) nonReentrant {
        require(!guaranteeExists[guaranteeId], "Guarantee ID already exists");
        require(bytes(mailId).length > 0, "Mail ID cannot be empty");
        require(penaltyAmount > 0, "Penalty amount must be greater than 0");
        require(msg.value >= penaltyAmount, "Insufficient escrow amount");
        require(escalationContacts.length > 0, "Must provide escalation contacts");
        
        // Additional validation: ensure the mail exists in MailRegistry
        // This prevents creating guarantees for non-existent mails
        // Note: We'll need to add a way to validate this
        
        Guarantee memory guarantee = Guarantee({
            guaranteeId: guaranteeId,
            mailId: mailId,
            guaranteedTime: guaranteedTime,
            penaltyAmount: penaltyAmount,
            insuranceAmount: insuranceAmount,
            customer: msg.sender,
            escrowAddress: address(this),
            status: GuaranteeStatus.ACTIVE,
            creationTime: block.timestamp,
            escrowAmount: msg.value,
            contractTermsHash: contractTermsHash,
            escalationContacts: escalationContacts,
            requiresProofOfTime: requiresProofOfTime,
            actualDeliveryTime: 0,
            penaltyPaid: false
        });
        
        guarantees[guaranteeId] = guarantee;
        guaranteeExists[guaranteeId] = true;
        customerGuarantees[msg.sender].push(guaranteeId);
        allGuaranteeIds.push(guaranteeId);
        totalGuarantees++;
        totalEscrowAmount += msg.value;
        
        escrowDetails[guaranteeId] = EscrowDetails({
            amount: msg.value,
            token: address(0), // ETH
            isReleased: false,
            releaseTime: 0,
            releaseAuthority: owner()
        });
        
        slaStatus[mailId] = SLAStatus.ON_TIME;
        
        emit GuaranteeCreated(
            guaranteeId,
            mailId,
            msg.sender,
            guaranteedTime,
            penaltyAmount,
            msg.value
        );
        
        emit EscrowDeposited(guaranteeId, msg.value, address(0), msg.sender);
    }
    
    /**
     * @dev Update guarantee status when delivery is completed
     */
    function updateGuaranteeStatus(
        string memory guaranteeId,
        uint256 actualDeliveryTime,
        bool wasDeliveredOnTime
    ) external onlyOwner guaranteeExistsModifier(guaranteeId) {
        Guarantee storage guarantee = guarantees[guaranteeId];
        require(guarantee.status == GuaranteeStatus.ACTIVE, "Guarantee not active");
        
        guarantee.actualDeliveryTime = actualDeliveryTime;
        
        if (wasDeliveredOnTime) {
            guarantee.status = GuaranteeStatus.FULFILLED;
            slaStatus[guarantee.mailId] = actualDeliveryTime < guarantee.guaranteedTime - 3600 ? 
                SLAStatus.EXCEEDED_EXPECTATIONS : SLAStatus.ON_TIME;
            
            // Release escrow back to customer
            _releaseEscrow(guaranteeId, guarantee.customer, false);
            
            // Update performance metrics
            performanceMetrics[address(this)].onTimeDeliveries++;
        } else {
            guarantee.status = GuaranteeStatus.BREACHED;
            slaStatus[guarantee.mailId] = SLAStatus.DELAYED;
            
            // Pay penalty to customer
            _payPenalty(guaranteeId);
            
            // Update performance metrics
            performanceMetrics[address(this)].delayedDeliveries++;
            performanceMetrics[address(this)].totalPenaltiesPaid += guarantee.penaltyAmount;
        }
        
        performanceMetrics[address(this)].totalGuarantees++;
        
        emit GuaranteeUpdated(guaranteeId, guarantee.status, block.timestamp);
        emit SLAStatusUpdated(guarantee.mailId, slaStatus[guarantee.mailId], block.timestamp);
    }
    
    /**
     * @dev Monitor SLA status and trigger alerts
     */
    function monitorSLA(string memory mailId, uint256 currentTime) external {
        // Find guarantee for this mail
        string memory guaranteeId = "";
        for (uint256 i = 0; i < allGuaranteeIds.length; i++) {
            if (keccak256(bytes(guarantees[allGuaranteeIds[i]].mailId)) == keccak256(bytes(mailId))) {
                guaranteeId = allGuaranteeIds[i];
                break;
            }
        }
        
        require(bytes(guaranteeId).length > 0, "No guarantee found for this mail");
        
        Guarantee storage guarantee = guarantees[guaranteeId];
        require(guarantee.status == GuaranteeStatus.ACTIVE, "Guarantee not active");
        
        uint256 timeRemaining = guarantee.guaranteedTime > currentTime ? 
            guarantee.guaranteedTime - currentTime : 0;
        
        SLAStatus newStatus;
        if (timeRemaining == 0) {
            newStatus = SLAStatus.DELAYED;
        } else if (timeRemaining <= 7200) { // 2 hours warning
            newStatus = SLAStatus.AT_RISK;
        } else {
            newStatus = SLAStatus.ON_TIME;
        }
        
        if (newStatus != slaStatus[mailId]) {
            slaStatus[mailId] = newStatus;
            emit SLAStatusUpdated(mailId, newStatus, block.timestamp);
            
            // Trigger emergency alert if at risk or delayed
            if (newStatus == SLAStatus.AT_RISK || newStatus == SLAStatus.DELAYED) {
                _triggerEmergencyAlert(guaranteeId, "SLA at risk or breached");
            }
        }
    }
    
    /**
     * @dev Get guarantee details
     */
    function getGuarantee(string memory guaranteeId) external view guaranteeExistsModifier(guaranteeId) returns (
        string memory mailId,
        uint256 guaranteedTime,
        uint256 penaltyAmount,
        address customer,
        GuaranteeStatus status,
        uint256 creationTime,
        uint256 actualDeliveryTime,
        bool penaltyPaid
    ) {
        Guarantee memory guarantee = guarantees[guaranteeId];
        return (
            guarantee.mailId,
            guarantee.guaranteedTime,
            guarantee.penaltyAmount,
            guarantee.customer,
            guarantee.status,
            guarantee.creationTime,
            guarantee.actualDeliveryTime,
            guarantee.penaltyPaid
        );
    }
    
    /**
     * @dev Get delivery performance metrics
     */
    function getDeliveryPerformance(string memory mailId) external view returns (
        uint256 guaranteedTime,
        uint256 actualDeliveryTime,
        SLAStatus slaCompliance,
        bool deliveredOnTime,
        uint256 timeAheadOrBehind
    ) {
        string memory guaranteeId = "";
        for (uint256 i = 0; i < allGuaranteeIds.length; i++) {
            if (keccak256(bytes(guarantees[allGuaranteeIds[i]].mailId)) == keccak256(bytes(mailId))) {
                guaranteeId = allGuaranteeIds[i];
                break;
            }
        }
        
        require(bytes(guaranteeId).length > 0, "No guarantee found for this mail");
        
        Guarantee memory guarantee = guarantees[guaranteeId];
        bool onTime = guarantee.actualDeliveryTime > 0 && 
                     guarantee.actualDeliveryTime <= guarantee.guaranteedTime;
        
        uint256 timeDiff = 0;
        if (guarantee.actualDeliveryTime > 0) {
            timeDiff = guarantee.actualDeliveryTime > guarantee.guaranteedTime ?
                guarantee.actualDeliveryTime - guarantee.guaranteedTime :
                guarantee.guaranteedTime - guarantee.actualDeliveryTime;
        }
        
        return (
            guarantee.guaranteedTime,
            guarantee.actualDeliveryTime,
            slaStatus[mailId],
            onTime,
            timeDiff
        );
    }
    
    /**
     * @dev Get customer guarantees
     */
    function getCustomerGuarantees(address customer) external view returns (string[] memory) {
        return customerGuarantees[customer];
    }
    
    /**
     * @dev Get escrow details
     */
    function getEscrowDetails(string memory guaranteeId) external view guaranteeExistsModifier(guaranteeId) returns (
        uint256 amount,
        address token,
        bool isReleased,
        uint256 releaseTime,
        address releaseAuthority
    ) {
        EscrowDetails memory escrow = escrowDetails[guaranteeId];
        return (
            escrow.amount,
            escrow.token,
            escrow.isReleased,
            escrow.releaseTime,
            escrow.releaseAuthority
        );
    }
    
    /**
     * @dev Cancel guarantee (only customer, before delivery)
     */
    function cancelGuarantee(string memory guaranteeId) external guaranteeExistsModifier(guaranteeId) onlyCustomer(guaranteeId) {
        Guarantee storage guarantee = guarantees[guaranteeId];
        require(guarantee.status == GuaranteeStatus.ACTIVE, "Guarantee not active");
        require(guarantee.actualDeliveryTime == 0, "Cannot cancel after delivery");
        
        guarantee.status = GuaranteeStatus.CANCELLED;
        
        // Release escrow back to customer
        _releaseEscrow(guaranteeId, guarantee.customer, false);
        
        emit GuaranteeUpdated(guaranteeId, GuaranteeStatus.CANCELLED, block.timestamp);
    }
    
    /**
     * @dev Dispute guarantee
     */
    function disputeGuarantee(string memory guaranteeId, string memory reason) external guaranteeExistsModifier(guaranteeId) {
        Guarantee storage guarantee = guarantees[guaranteeId];
        require(guarantee.customer == msg.sender || msg.sender == owner(), "Not authorized to dispute");
        require(guarantee.status == GuaranteeStatus.BREACHED || guarantee.status == GuaranteeStatus.FULFILLED, 
                "Invalid status for dispute");
        
        guarantee.status = GuaranteeStatus.DISPUTED;
        
        _triggerEmergencyAlert(guaranteeId, reason);
        
        emit GuaranteeUpdated(guaranteeId, GuaranteeStatus.DISPUTED, block.timestamp);
    }
    
    /**
     * @dev Internal function to release escrow
     */
    function _releaseEscrow(string memory guaranteeId, address recipient, bool isPenalty) internal {
        EscrowDetails storage escrow = escrowDetails[guaranteeId];
        require(!escrow.isReleased, "Escrow already released");
        
        escrow.isReleased = true;
        escrow.releaseTime = block.timestamp;
        
        uint256 amount = escrow.amount;
        totalEscrowAmount -= amount;
        
        (bool success, ) = payable(recipient).call{value: amount}("");
        require(success, "Escrow release failed");
        
        emit EscrowReleased(guaranteeId, recipient, amount, isPenalty);
    }
    
    /**
     * @dev Internal function to pay penalty
     */
    function _payPenalty(string memory guaranteeId) internal {
        Guarantee storage guarantee = guarantees[guaranteeId];
        require(!guarantee.penaltyPaid, "Penalty already paid");
        
        guarantee.penaltyPaid = true;
        
        // Release full escrow amount as penalty to customer
        _releaseEscrow(guaranteeId, guarantee.customer, true);
        
        emit PenaltyPaid(guaranteeId, guarantee.customer, guarantee.penaltyAmount, block.timestamp);
    }
    
    /**
     * @dev Internal function to trigger emergency alert
     */
    function _triggerEmergencyAlert(string memory guaranteeId, string memory reason) internal {
        Guarantee memory guarantee = guarantees[guaranteeId];
        
        // Convert string array to address array (simplified for demo)
        address[] memory contacts = new address[](1);
        contacts[0] = guarantee.customer;
        
        emit EmergencyAlertTriggered(guaranteeId, reason, block.timestamp, contacts);
    }
    
    /**
     * @dev Get performance metrics
     */
    function getPerformanceMetrics() external view returns (
        uint256 total,
        uint256 onTimeDeliveries,
        uint256 delayedDeliveries,
        uint256 totalPenaltiesPaid,
        uint256 successRate
    ) {
        PerformanceMetrics memory metrics = performanceMetrics[address(this)];
        uint256 rate = metrics.totalGuarantees > 0 ? 
            (metrics.onTimeDeliveries * 100) / metrics.totalGuarantees : 0;
        
        return (
            metrics.totalGuarantees,
            metrics.onTimeDeliveries,
            metrics.delayedDeliveries,
            metrics.totalPenaltiesPaid,
            rate
        );
    }
    
    /**
     * @dev Emergency withdrawal (owner only)
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdrawal failed");
    }
}
