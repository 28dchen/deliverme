// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title UserRegistry
 * @dev Manages user registration, authentication, and profile management
 */
contract UserRegistry is Ownable, ReentrancyGuard {
    
    struct User {
        string name;
        string email;
        bytes32 passwordHash;
        bool isActive;
        uint256 registrationTime;
        uint256 lastLoginTime;
    }
    
    mapping(address => User) public users;
    mapping(string => address) public emailToAddress;
    mapping(address => bool) public activeUsers;
    
    event UserRegistered(address indexed userAddress, string email, string name, uint256 timestamp);
    event UserLoggedIn(address indexed userAddress, uint256 timestamp);
    event UserLoggedOut(address indexed userAddress, uint256 timestamp);
    event PasswordChanged(address indexed userAddress, uint256 timestamp);
    event UserDeactivated(address indexed userAddress, uint256 timestamp);
    
    modifier onlyRegisteredUser() {
        require(users[msg.sender].isActive, "User not registered or inactive");
        _;
    }
    
    modifier emailNotTaken(string memory email) {
        require(emailToAddress[email] == address(0), "Email already registered");
        _;
    }
    
    constructor() Ownable(msg.sender) {}
    
    /**
     * @dev Register a new user
     * @param name User's display name
     * @param email User's email address
     * @param passwordHash Hashed password (should be hashed off-chain)
     */
    function registerUser(
        string memory name,
        string memory email,
        bytes32 passwordHash
    ) external emailNotTaken(email) nonReentrant {
        require(bytes(name).length > 0, "Name cannot be empty");
        require(bytes(email).length > 0, "Email cannot be empty");
        require(passwordHash != 0, "Password hash cannot be empty");
        require(!users[msg.sender].isActive, "User already registered");
        
        users[msg.sender] = User({
            name: name,
            email: email,
            passwordHash: passwordHash,
            isActive: true,
            registrationTime: block.timestamp,
            lastLoginTime: 0
        });
        
        emailToAddress[email] = msg.sender;
        activeUsers[msg.sender] = true;
        
        emit UserRegistered(msg.sender, email, name, block.timestamp);
    }
    
    /**
     * @dev User login - verify password
     * @param passwordHash Hashed password for verification
     */
    function login(bytes32 passwordHash) external onlyRegisteredUser nonReentrant {
        require(users[msg.sender].passwordHash == passwordHash, "Invalid password");
        
        users[msg.sender].lastLoginTime = block.timestamp;
        
        emit UserLoggedIn(msg.sender, block.timestamp);
    }
    
    /**
     * @dev User logout
     */
    function logout() external onlyRegisteredUser {
        emit UserLoggedOut(msg.sender, block.timestamp);
    }
    
    /**
     * @dev Get user profile information
     * @param userAddress Address of the user
     */
    function getUserProfile(address userAddress) external view returns (
        string memory name,
        string memory email,
        bool isActive,
        uint256 registrationTime,
        uint256 lastLoginTime
    ) {
        User memory user = users[userAddress];
        return (user.name, user.email, user.isActive, user.registrationTime, user.lastLoginTime);
    }
    
    /**
     * @dev Change user password
     * @param oldPasswordHash Current password hash
     * @param newPasswordHash New password hash
     */
    function changePassword(
        bytes32 oldPasswordHash,
        bytes32 newPasswordHash
    ) external onlyRegisteredUser nonReentrant {
        require(users[msg.sender].passwordHash == oldPasswordHash, "Invalid old password");
        require(newPasswordHash != 0, "New password hash cannot be empty");
        require(oldPasswordHash != newPasswordHash, "New password must be different");
        
        users[msg.sender].passwordHash = newPasswordHash;
        
        emit PasswordChanged(msg.sender, block.timestamp);
    }
    
    /**
     * @dev Check if user is registered and active
     * @param userAddress Address to check
     */
    function isUserActive(address userAddress) external view returns (bool) {
        return users[userAddress].isActive;
    }
    
    /**
     * @dev Get user address by email
     * @param email Email to lookup
     */
    function getUserByEmail(string memory email) external view returns (address) {
        return emailToAddress[email];
    }
    
    /**
     * @dev Deactivate a user (admin only)
     * @param userAddress Address of user to deactivate
     */
    function deactivateUser(address userAddress) external onlyOwner {
        require(users[userAddress].isActive, "User not active");
        
        users[userAddress].isActive = false;
        activeUsers[userAddress] = false;
        
        emit UserDeactivated(userAddress, block.timestamp);
    }
    
    /**
     * @dev Update user profile (only user themselves)
     * @param newName New display name
     */
    function updateProfile(string memory newName) external onlyRegisteredUser {
        require(bytes(newName).length > 0, "Name cannot be empty");
        
        users[msg.sender].name = newName;
    }
}
