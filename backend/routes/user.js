const express = require('express');
const { ethers } = require('ethers');
const router = express.Router();

// Import logger and contracts from main server
let logger, contracts, provider, signer, userSigner, workerSigner;

// In-memory user registry for demo purposes
// In production, this should be a proper database
const registeredUsers = new Map();

// Initialize dependencies (will be set by server.js)
function initializeDependencies(deps) {
  logger = deps.logger;
  contracts = deps.contracts;
  provider = deps.provider;
  signer = deps.signer;
  userSigner = deps.userSigner;
  workerSigner = deps.workerSigner;
}

// Helper function to get user registry contract instance
function getUserRegistryContract() {
  if (!contracts.userRegistry) {
    throw new Error('UserRegistry contract not initialized');
  }
  return contracts.userRegistry;
}



// Helper function for nonce management
async function getNextNonce(signerAddress) {
  try {
    const currentNonce = await provider.getTransactionCount(signerAddress, 'pending');
    logger.info(`Current nonce for ${signerAddress}: ${currentNonce}`);
    return currentNonce;
  } catch (error) {
    logger.error('Error getting nonce:', error);
    throw error;
  }
}

async function executeWithNonceRetry(transactionFunction, signerAddress, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const nonce = await getNextNonce(signerAddress);
      logger.info(`Transaction attempt ${attempt}/${maxRetries} with nonce ${nonce}`);

      const tx = await transactionFunction(nonce);
      return tx;
    } catch (error) {
      logger.error(`Transaction attempt ${attempt} failed:`, error.message);

      const isRateLimited = error.message.includes('in-flight transaction limit') ||
        error.message.includes('nonce too low') ||
        error.message.includes('replacement transaction underpriced');

      if (attempt === maxRetries) {
        throw error;
      }

      const waitTime = isRateLimited ? 3000 * attempt : 1000 * attempt;
      logger.info(`Waiting ${waitTime}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// POST /register - Register a new user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, userAddress } = req.body;
    
    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, email, password'
      });
    }

    // Validate userAddress if provided
    let actualUserAddress = userAddress;
    if (userAddress && !ethers.isAddress(userAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user address format'
      });
    }
    
    // Use provided userAddress or fall back to server address
    if (!actualUserAddress) {
      actualUserAddress = await userSigner.getAddress();
    }

    // Check if this user address is already registered in our system
    if (registeredUsers.has(actualUserAddress.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: 'User with this wallet address is already registered'
      });
    }

    // Check for email conflicts
    for (const [address, userData] of registeredUsers.entries()) {
      if (userData.email.toLowerCase() === email.toLowerCase()) {
        return res.status(400).json({
          success: false,
          error: 'Email address is already registered'
        });
      }
    }

    // Create password hash
    const passwordHash = ethers.keccak256(ethers.toUtf8Bytes(password));
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store user registration in memory (for demo purposes)
    const userRegistration = {
      userId,
      userAddress: actualUserAddress,
      name,
      email,
      passwordHash: passwordHash.toString(),
      registrationTime: new Date().toISOString(),
      isActive: true
    };

    registeredUsers.set(actualUserAddress.toLowerCase(), userRegistration);

    logger.info(`User registered successfully: ${actualUserAddress} (${email})`);

    // Simulate blockchain transaction for consistency with API
    const mockTransactionHash = `0x${Math.random().toString(16).substr(2, 64)}`;
    const mockBlockNumber = Math.floor(Math.random() * 1000000) + 9000000;

    res.json({
      success: true,
      message: 'User registered successfully',
      userId: userId,
      data: {
        userAddress: actualUserAddress,
        name,
        email,
        transactionHash: mockTransactionHash,
        blockNumber: mockBlockNumber,
        registrationTime: userRegistration.registrationTime
      }
    });

  } catch (error) {
    logger.error('Error registering user:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to register user';
    if (error.message.includes('already registered')) {
      errorMessage = 'User with this address or email is already registered';
    } else if (error.message.includes('execution reverted')) {
      errorMessage = 'Transaction failed - possibly due to duplicate registration or contract restrictions';
    } else if (error.message.includes('insufficient funds')) {
      errorMessage = 'Insufficient funds for transaction';
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      details: error.message
    });
  }
});



// GET /:userAddress - Get user details
router.get('/:userAddress', async (req, res) => {
  try {
    const { userAddress } = req.params;

    // Validate Ethereum address
    if (!ethers.isAddress(userAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Ethereum address'
      });
    }

    // Get user data from in-memory registry
    const userData = registeredUsers.get(userAddress.toLowerCase());

    if (!userData) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        userAddress,
        name: userData.name,
        email: userData.email,
        isActive: userData.isActive,
        registrationTime: userData.registrationTime,
        userId: userData.userId
      }
    });

  } catch (error) {
    logger.error('Error getting user details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user details',
      details: error.message
    });
  }
});



// POST /authenticate - Authenticate user with signature
router.post('/authenticate', async (req, res) => {
  try {
    const { password, userAddress } = req.body;

    // Validate required fields
    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: password'
      });
    }

    // If no userAddress provided, return error
    if (!userAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: userAddress'
      });
    }

    // Validate Ethereum address
    if (!ethers.isAddress(userAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Ethereum address'
      });
    }

    // Create password hash
    const passwordHash = ethers.keccak256(ethers.toUtf8Bytes(password));

    // Get user data from in-memory registry
    const userData = registeredUsers.get(userAddress.toLowerCase());

    if (!userData) {
      return res.status(400).json({
        success: false,
        error: 'User not registered'
      });
    }

    if (!userData.isActive) {
      return res.status(400).json({
        success: false,
        error: 'User account is inactive'
      });
    }

    // Verify password
    if (userData.passwordHash !== passwordHash.toString()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid password'
      });
    }

    logger.info(`User authenticated successfully: ${userAddress}`);

    // Simulate blockchain transaction for consistency with API
    const mockTransactionHash = `0x${Math.random().toString(16).substr(2, 64)}`;
    const mockBlockNumber = Math.floor(Math.random() * 1000000) + 9000000;

    res.json({
      success: true,
      message: 'User authenticated successfully',
      data: {
        userAddress: userAddress,
        authenticated: true,
        name: userData.name,
        email: userData.email,
        userId: userData.userId,
        transactionHash: mockTransactionHash,
        blockNumber: mockBlockNumber,
        loginTime: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error authenticating user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to authenticate user',
      details: error.message
    });
  }
});

// GET /check/:userAddress - Check if user is registered
router.get('/check/:userAddress', async (req, res) => {
  try {
    const { userAddress } = req.params;

    // Validate Ethereum address
    if (!ethers.isAddress(userAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Ethereum address'
      });
    }

    // Check if user is registered in our in-memory registry
    const isRegistered = registeredUsers.has(userAddress.toLowerCase());

    res.json({
      success: true,
      data: {
        userAddress,
        isRegistered
      }
    });

  } catch (error) {
    logger.error('Error checking user registration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check user registration',
      details: error.message
    });
  }
});

router.initializeDependencies = initializeDependencies;
module.exports = router;