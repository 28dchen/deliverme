const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const winston = require('winston');
const { ethers } = require('ethers');
const { JsonRpcProvider, Wallet, formatEther } = ethers;
const fs = require('fs');
const path = require('path');

// Load environment variables
dotenv.config();

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'blockchain-service.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Global variables for blockchain connection
let provider;
let signer;
let userSigner;
let workerSigner;
let contracts = {};

// Initialize blockchain connection
async function initializeBlockchain() {
  try {
    // Connect to Ethereum provider
    const rpcUrl = process.env.ETHEREUM_RPC_URL;
    provider = new JsonRpcProvider(rpcUrl);

    // Initialize signers
    if (!process.env.USER_PRIVATE_KEY || !process.env.WORKER_PRIVATE_KEY) {
      throw new Error('USER_PRIVATE_KEY or WORKER_PRIVATE_KEY not set in environment variables');
    }

    // Create user signer for regular user operations
    userSigner = new Wallet(process.env.USER_PRIVATE_KEY, provider);

    // Create worker signer for worker operations
    workerSigner = new Wallet(process.env.WORKER_PRIVATE_KEY, provider);

    // Default signer (for backward compatibility)
    signer = userSigner;

    logger.info(`Connected to blockchain with user address: ${userSigner.address}`);
    logger.info(`Connected to blockchain with worker address: ${workerSigner.address}`);

    // Load contract addresses
    await loadContracts();

    logger.info('Blockchain initialization completed');
  } catch (error) {
    logger.error('Failed to initialize blockchain:', error);
    throw error;
  }
}

// Load smart contract instances
async function loadContracts() {
  try {
    // Load contract addresses from deployment file
    const addressesPath = path.join(__dirname, process.env.CONTRACT_ADDRESSES_PATH || 'sepolia-addresses.json');

    if (!fs.existsSync(addressesPath)) {
      throw new Error('Contract addresses file not found. Please deploy contracts first.');
    }

    const contractAddresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));

    // Load ABIs from artifacts
    const contractsDir = path.join(__dirname, '..', 'SmartContract', 'artifacts', 'contracts');

    const userRegistryArtifact = JSON.parse(fs.readFileSync(path.join(contractsDir, 'UserRegistry.sol', 'UserRegistry.json'), 'utf8'));
    const mailRegistryArtifact = JSON.parse(fs.readFileSync(path.join(contractsDir, 'MailRegistry.sol', 'MailRegistry.json'), 'utf8'));
    const deliveryTrackingArtifact = JSON.parse(fs.readFileSync(path.join(contractsDir, 'DeliveryTracking.sol', 'DeliveryTracking.json'), 'utf8'));
    const timeProofArtifact = JSON.parse(fs.readFileSync(path.join(contractsDir, 'TimeProof.sol', 'TimeProof.json'), 'utf8'));
    const deliveryGuaranteeArtifact = JSON.parse(fs.readFileSync(path.join(contractsDir, 'DeliveryGuarantee.sol', 'DeliveryGuarantee.json'), 'utf8'));

    // Initialize contract instances with ABIs from artifacts
    contracts.userRegistry = new ethers.Contract(contractAddresses.userRegistry, userRegistryArtifact.abi, signer);
    contracts.mailRegistry = new ethers.Contract(contractAddresses.mailRegistry, mailRegistryArtifact.abi, signer);
    contracts.deliveryTracking = new ethers.Contract(contractAddresses.deliveryTracking, deliveryTrackingArtifact.abi, signer);
    contracts.timeProof = new ethers.Contract(contractAddresses.timeProof, timeProofArtifact.abi, signer);
    contracts.deliveryGuarantee = new ethers.Contract(contractAddresses.deliveryGuarantee, deliveryGuaranteeArtifact.abi, signer);

    // All contract instances are now initialized using ethers.Contract with ABIs from artifacts

    logger.info('Smart contracts loaded successfully');
    logger.info('Contract addresses:', {
      userRegistry: contractAddresses.userRegistry,
      mailRegistry: contractAddresses.mailRegistry,
      deliveryTracking: contractAddresses.deliveryTracking,
      timeProof: contractAddresses.timeProof,
      deliveryGuarantee: contractAddresses.deliveryGuarantee
    });
  } catch (error) {
    logger.error('Failed to load contracts:', error);
    throw error;
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'blockchain-service',
    version: '1.0.0'
  });
});

// Blockchain status endpoint
app.get('/blockchain/status', async (req, res) => {
  try {
    const network = await provider.getNetwork();
    const balance = await provider.getBalance(signer.address);
    const blockNumber = await provider.getBlockNumber();

    res.json({
      success: true,
      data: {
        network: {
          name: network.name,
          chainId: network.chainId.toString()
        },
        signer: {
          address: signer.address,
          balance: formatEther(balance)
        },
        blockNumber: blockNumber,
        contracts: Object.keys(contracts)
      }
    });
  } catch (error) {
    logger.error('Failed to get blockchain status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Contract addresses endpoint
app.get('/blockchain/contracts', (req, res) => {
  try {
    const contractAddresses = {};

    // Extract addresses from contracts object
    for (const [contractName, contractInfo] of Object.entries(contracts)) {
      contractAddresses[contractName] = contractInfo.target || contractInfo.address;
    }

    res.json({
      success: true,
      data: contractAddresses
    });
  } catch (error) {
    logger.error('Failed to get contract addresses:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Import route handlers
const userRoutes = require('./routes/user');
const mailRoutes = require('./routes/mail');
const proofRoutes = require('./routes/proof');
const guaranteeRoutes = require('./routes/guarantee');
const deliveryTrackingRoutes = require('./routes/deliveryTracking');

// Function to initialize route dependencies
function initializeRoutes() {
  logger.info('Initializing route dependencies...');

  const dependencies = {
    logger: logger,
    contracts: contracts,
    provider: provider,
    signer: signer,
    userSigner: userSigner,
    workerSigner: workerSigner
  };

  logger.info('Calling initializeDependencies for all routes...');
  userRoutes.initializeDependencies(dependencies);
  mailRoutes.initializeDependencies(dependencies);
  proofRoutes.initializeDependencies(dependencies);
  guaranteeRoutes.initializeDependencies(dependencies);
  deliveryTrackingRoutes.initializeDependencies(dependencies);

  logger.info('Registering API routes...');
  // Use routes
  app.use('/api/user', userRoutes);
  app.use('/api/mail', mailRoutes);
  app.use('/api/proof', proofRoutes);
  app.use('/api/guarantee', guaranteeRoutes);
  app.use('/api/delivery-tracking', deliveryTrackingRoutes);

  // 404 handler - must be after all routes
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint not found'
    });
  });

  logger.info('Route initialization completed successfully');
}

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: error.message
  });
});

// 404 handler
// 404 handler moved to initializeRoutes function

// Start server
async function startServer() {
  try {
    await initializeBlockchain();
    initializeRoutes();

    app.listen(PORT, () => {
      logger.info(`Blockchain service running on port ${PORT}`);
      console.log(`🚀 Blockchain service started on http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`⛓️  Blockchain status: http://localhost:${PORT}/blockchain/status`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Export for testing
module.exports = { app, logger, contracts, provider, signer };

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}