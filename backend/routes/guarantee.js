const express = require('express');
const { ethers } = require('ethers');
const router = express.Router();

// Import logger and contracts from main server
let logger, contracts, provider, signer;

// Initialize dependencies (will be set by server.js)
function initializeDependencies(deps) {
  logger = deps.logger;
  contracts = deps.contracts;
  provider = deps.provider;
  signer = deps.signer;
}

// Helper function to get delivery guarantee contract instance
function getDeliveryGuaranteeContract() {
  if (!contracts.deliveryGuarantee) {
    throw new Error('DeliveryGuarantee contract not initialized');
  }
  return contracts.deliveryGuarantee;
}

// Helper function to get delivery guarantee contract for read-only operations
function getDeliveryGuaranteeContractReadOnly() {
  if (!contracts.deliveryGuarantee) {
    throw new Error('DeliveryGuarantee contract not initialized');
  }
  return contracts.deliveryGuarantee;
}

// Helper function for nonce management
async function getNextNonce(signerAddress) {
  try {
    // Get the current nonce from the network
    const currentNonce = await provider.getTransactionCount(signerAddress, 'pending');

    logger.info(`Current nonce for ${signerAddress}: ${currentNonce}`);

    return currentNonce;
  } catch (error) {
    logger.error('Error getting nonce:', error);
    throw error;
  }
}

// Helper function for transaction retry with nonce management
async function executeWithNonceRetry(transactionFunction, signerAddress, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const nonce = await getNextNonce(signerAddress);
      logger.info(`Transaction attempt ${attempt}/${maxRetries} with nonce ${nonce}`);

      const result = await transactionFunction(nonce);
      return result;
    } catch (error) {
      logger.error(`Transaction attempt ${attempt} failed:`, error.message);

      // Check for specific errors that require longer delays
      const isRateLimited = error.message.includes('in-flight transaction limit') ||
        error.message.includes('nonce too low') ||
        error.message.includes('replacement transaction underpriced');

      if (attempt === maxRetries) {
        throw error;
      }

      // Longer wait for rate limiting issues
      const waitTime = isRateLimited ? 3000 * attempt : 1000 * attempt;
      logger.info(`Waiting ${waitTime}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// Helper function to validate guarantee parameters
function validateGuaranteeParams(penaltyAmount, insurance, guaranteedDeliveryTime) {
  const errors = [];

  // Validate penalty amount
  if (!penaltyAmount || isNaN(parseFloat(penaltyAmount)) || parseFloat(penaltyAmount) <= 0) {
    errors.push('Penalty amount must be a positive number');
  }

  // Validate insurance amount
  if (!insurance || isNaN(parseFloat(insurance)) || parseFloat(insurance) <= 0) {
    errors.push('Insurance amount must be a positive number');
  }

  // Validate guaranteed delivery time
  if (!guaranteedDeliveryTime || isNaN(parseInt(guaranteedDeliveryTime)) || parseInt(guaranteedDeliveryTime) <= Math.floor(Date.now() / 1000)) {
    errors.push('Guaranteed delivery time must be a future timestamp');
  }

  // Check if insurance covers penalty
  if (parseFloat(insurance) < parseFloat(penaltyAmount)) {
    errors.push('Insurance amount must be at least equal to penalty amount');
  }

  return errors;
}

// POST /api/guarantee/create - Create delivery guarantee
router.post('/create', async (req, res) => {
  try {
    const { mailId, penaltyAmount, insurance, guaranteedDeliveryTime, guaranteeId } = req.body;

    // Validate input
    if (!mailId || !penaltyAmount || !insurance || !guaranteedDeliveryTime) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: mailId, penaltyAmount, insurance, guaranteedDeliveryTime'
      });
    }

    // Validate guarantee parameters
    const validationErrors = validateGuaranteeParams(penaltyAmount, insurance, guaranteedDeliveryTime);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors
      });
    }

    // Generate guarantee ID if not provided
    const finalGuaranteeId = guaranteeId || `GUARANTEE_${Date.now()}_${Math.random().toString(36).substr(2, 8).toUpperCase()}`;

    logger.info(`Creating delivery guarantee: ${finalGuaranteeId} for mail: ${mailId}`);

    // Convert amounts to Wei
    const penaltyAmountWei = ethers.parseEther(penaltyAmount.toString());
    const insuranceAmountWei = ethers.parseEther(insurance.toString());

    // Get contract instance
    const deliveryGuarantee = getDeliveryGuaranteeContract();

    // Prepare additional parameters for createGuarantee
    const escalationContacts = req.body.escalationContacts || [];
    const requiresProofOfTime = req.body.requiresProofOfTime || false;
    const contractTermsHash = ethers.keccak256(ethers.toUtf8Bytes('Standard delivery guarantee terms'));

    // Execute guarantee creation with nonce retry
    const tx = await executeWithNonceRetry(async (nonce) => {
      return await deliveryGuarantee.connect(signer).createGuarantee(
        finalGuaranteeId,
        mailId,
        parseInt(guaranteedDeliveryTime),
        penaltyAmountWei,
        insuranceAmountWei,
        escalationContacts,
        requiresProofOfTime,
        contractTermsHash,
        {
          gasLimit: 800000,
          gasPrice: ethers.parseUnits('20', 'gwei'),
          value: penaltyAmountWei, // Send penalty amount with transaction
          nonce: nonce
        }
      );
    }, await signer.getAddress());

    // Wait for transaction confirmation
    const receipt = await tx.wait();

    logger.info(`Delivery guarantee created successfully: ${receipt.transactionHash}`);

    res.json({
      success: true,
      data: {
        guaranteeId: finalGuaranteeId,
        mailId: mailId,
        penaltyAmount: penaltyAmount,
        insurance: insurance,
        guaranteedDeliveryTime: new Date(parseInt(guaranteedDeliveryTime) * 1000).toISOString(),
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        createdAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Delivery guarantee creation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Delivery guarantee creation failed',
      message: error.message
    });
  }
});

// GET /api/guarantee/stats - Get guarantee statistics
router.get('/stats', async (req, res) => {
  try {
    logger.info('Getting guarantee statistics');

    // Mock statistics data
    const stats = {
      totalGuarantees: Math.floor(Math.random() * 1000) + 500,
      activeGuarantees: Math.floor(Math.random() * 300) + 100,
      deliveredGuarantees: Math.floor(Math.random() * 600) + 300,
      expiredGuarantees: Math.floor(Math.random() * 50) + 10,
      penaltiesClaimed: Math.floor(Math.random() * 20) + 5,
      totalInsurancePool: (Math.random() * 100 + 50).toFixed(2),
      totalPenaltiesPaid: (Math.random() * 10 + 2).toFixed(2),
      averageDeliveryTime: Math.floor(Math.random() * 48) + 12, // hours
      onTimeDeliveryRate: (Math.random() * 20 + 80).toFixed(1), // percentage
      disputeRate: (Math.random() * 5 + 1).toFixed(1) // percentage
    };

    res.json({
      success: true,
      data: {
        ...stats,
        retrievedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Get guarantee statistics failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get guarantee statistics',
      message: error.message
    });
  }
});

// GET /api/guarantee/:guaranteeId - Get guarantee details
router.get('/:guaranteeId', async (req, res) => {
  try {
    const { guaranteeId } = req.params;

    if (!guaranteeId) {
      return res.status(400).json({
        success: false,
        error: 'Guarantee ID is required'
      });
    }

    logger.info(`Getting guarantee details for: ${guaranteeId}`);

    // Get contract instance
    // const deliveryGuarantee = getDeliveryGuaranteeContract();

    // Get guarantee details using read-only contract
    const deliveryGuaranteeReadOnly = getDeliveryGuaranteeContractReadOnly();
    const guaranteeData = await deliveryGuaranteeReadOnly.getGuarantee(guaranteeId);
    console.log(guaranteeData);
    // Parse the returned tuple based on actual contract return: [mailId, guaranteedDeliveryTime, penaltyAmount, insurance, status, createdAt, deliveredAt, isActive]
    const [
      mailId,
      guaranteedDeliveryTime,
      penaltyAmount,
      insurance,
      status,
      createdAt,
      deliveredAt,
      isActive
    ] = guaranteeData;

    res.json({
      success: true,
      data: {
        guaranteeId: guaranteeId,
        mailId: mailId,
        guaranteedDeliveryTime: Number(guaranteedDeliveryTime),
        penaltyAmount: penaltyAmount.toString(),
        insurance: insurance,
        status: Number(status),
        createdAt: Number(createdAt),
        deliveredAt: Number(deliveredAt),
        isActive: isActive,
        retrievedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Get guarantee details failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get guarantee details',
      message: error.message
    });
  }
});

// POST /api/guarantee/:guaranteeId/claim-penalty - Claim penalty for overdue delivery
router.post('/:guaranteeId/claim-penalty', async (req, res) => {
  try {
    const { guaranteeId } = req.params;
    const { claimantAddress } = req.body;

    if (!guaranteeId) {
      return res.status(400).json({
        success: false,
        error: 'Guarantee ID is required'
      });
    }

    if (!claimantAddress || !ethers.isAddress(claimantAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Valid claimant Ethereum address is required'
      });
    }

    logger.info(`Claiming penalty for guarantee: ${guaranteeId} by: ${claimantAddress}`);

    // Get contract instance
    const deliveryGuarantee = getDeliveryGuaranteeContract();

    // First, check guarantee status using read-only contract
    const deliveryGuaranteeReadOnly = getDeliveryGuaranteeContractReadOnly();
    const guaranteeData = await deliveryGuaranteeReadOnly.getGuarantee(guaranteeId);

    // Parse the returned tuple based on actual contract return: [mailId, guaranteedDeliveryTime, penaltyAmount, insurance, status, createdAt, deliveredAt, isActive]
    const [
      mailId,
      guaranteedDeliveryTime,
      penaltyAmount,
      insurance,
      status,
      createdAt,
      deliveredAt,
      isActive
    ] = guaranteeData;

    // Validate claim conditions
    if (!isActive) {
      return res.status(400).json({
        success: false,
        error: 'Guarantee is not active'
      });
    }

    // Check if already delivered (status 2 = delivered)
    if (Number(status) === 2) {
      return res.status(400).json({
        success: false,
        error: 'Mail has already been delivered'
      });
    }

    // Check if penalty already paid (status 3 = penalty paid)
    if (Number(status) === 3) {
      return res.status(400).json({
        success: false,
        error: 'Penalty has already been claimed'
      });
    }

    const currentTime = Math.floor(Date.now() / 1000);
    if (Number(guaranteedDeliveryTime) >= currentTime) {
      return res.status(400).json({
        success: false,
        error: 'Delivery time has not yet expired'
      });
    }

    // Execute penalty claim with nonce retry
    const tx = await executeWithNonceRetry(async (nonce) => {
      return await deliveryGuarantee.connect(signer).claimPenalty(
        guaranteeId,
        {
          gasLimit: 400000,
          gasPrice: ethers.parseUnits('20', 'gwei'),
          nonce: nonce
        }
      );
    }, await signer.getAddress());

    // Wait for transaction confirmation
    const receipt = await tx.wait();

    logger.info(`Penalty claimed successfully: ${receipt.transactionHash}`);

    res.json({
      success: true,
      data: {
        guaranteeId: guaranteeId,
        claimantAddress: claimantAddress,
        penaltyAmount: penaltyAmount.toString(),
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        claimedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Penalty claim failed:', error);
    res.status(500).json({
      success: false,
      error: 'Penalty claim failed',
      message: error.message
    });
  }
});

// POST /api/guarantee/:guaranteeId/confirm-delivery - Confirm delivery
router.post('/:guaranteeId/confirm-delivery', async (req, res) => {
  try {
    const { guaranteeId } = req.params;
    const { confirmedBy, deliveryProof } = req.body;

    if (!guaranteeId) {
      return res.status(400).json({
        success: false,
        error: 'Guarantee ID is required'
      });
    }

    if (!confirmedBy || !ethers.isAddress(confirmedBy)) {
      return res.status(400).json({
        success: false,
        error: 'Valid confirmer Ethereum address is required'
      });
    }

    logger.info(`Confirming delivery for guarantee: ${guaranteeId} by: ${confirmedBy}`);

    // Get contract instance
    const deliveryGuarantee = getDeliveryGuaranteeContract();

    // First, check guarantee status using read-only contract
    const deliveryGuaranteeReadOnly = getDeliveryGuaranteeContractReadOnly();
    const guaranteeData = await deliveryGuaranteeReadOnly.getGuarantee(guaranteeId);

    // Parse the returned tuple based on actual contract return: [mailId, guaranteedDeliveryTime, penaltyAmount, insurance, status, createdAt, deliveredAt, isActive]
    const [
      mailId,
      guaranteedDeliveryTime,
      penaltyAmount,
      insurance,
      status,
      createdAt,
      deliveredAt,
      isActive
    ] = guaranteeData;

    // Validate confirmation conditions
    if (!isActive) {
      return res.status(400).json({
        success: false,
        error: 'Guarantee is not active'
      });
    }

    // Check if already delivered (status 2 = delivered)
    if (Number(status) === 2) {
      return res.status(400).json({
        success: false,
        error: 'Delivery has already been confirmed'
      });
    }

    // Execute delivery confirmation with nonce retry
    const tx = await executeWithNonceRetry(async (nonce) => {
      return await deliveryGuarantee.connect(signer).confirmDelivery(
        guaranteeId,
        {
          gasLimit: 400000,
          gasPrice: ethers.parseUnits('20', 'gwei'),
          nonce: nonce
        }
      );
    }, await signer.getAddress());

    // Wait for transaction confirmation
    const receipt = await tx.wait();

    logger.info(`Delivery confirmed successfully: ${receipt.transactionHash}`);

    res.json({
      success: true,
      data: {
        guaranteeId: guaranteeId,
        confirmedBy: confirmedBy,
        deliveryProof: deliveryProof || null,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        confirmedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Delivery confirmation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Delivery confirmation failed',
      message: error.message
    });
  }
});

// GET /api/guarantee/mail/:mailId - Get all guarantees for a mail item
router.get('/mail/:mailId', async (req, res) => {
  try {
    const { mailId } = req.params;

    if (!mailId) {
      return res.status(400).json({
        success: false,
        error: 'Mail ID is required'
      });
    }

    logger.info(`Getting guarantees for mail: ${mailId}`);

    // TODO: This functionality requires querying blockchain events or implementing a separate indexing service
    // For now, returning mock data as the smart contract doesn't have a getGuaranteesByMail method

    // Mock guarantees for mail (should be replaced with event log queries)
    const mockGuarantees = [
      {
        guaranteeId: 'GUARANTEE_' + Math.random().toString(36).substr(2, 10).toUpperCase(),
        penaltyAmount: '0.1',
        insurance: '0.05',
        isActive: true,
        isDelivered: Math.random() > 0.5
      },
      {
        guaranteeId: 'GUARANTEE_' + Math.random().toString(36).substr(2, 10).toUpperCase(),
        penaltyAmount: '0.2',
        insurance: '0.1',
        isActive: true,
        isDelivered: Math.random() > 0.5
      }
    ];

    const formattedGuarantees = mockGuarantees;

    res.json({
      success: true,
      data: {
        mailId: mailId,
        totalGuarantees: formattedGuarantees.length,
        activeGuarantees: formattedGuarantees.filter(g => g.isActive).length,
        deliveredGuarantees: formattedGuarantees.filter(g => g.isDelivered).length,
        guarantees: formattedGuarantees,
        retrievedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Get mail guarantees failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get mail guarantees',
      message: error.message
    });
  }
});

// PUT /api/guarantee/:guaranteeId/status - Update guarantee status
router.put('/:guaranteeId/status', async (req, res) => {
  try {
    const { guaranteeId } = req.params;
    const { actualDeliveryTime, deliveredOnTime } = req.body;

    if (!guaranteeId) {
      return res.status(400).json({
        success: false,
        error: 'Guarantee ID is required'
      });
    }

    // Use current time if actualDeliveryTime is not provided
    const deliveryTime = actualDeliveryTime || Math.floor(Date.now() / 1000);

    // Default to true if deliveredOnTime is not provided
    const onTime = deliveredOnTime !== undefined ? deliveredOnTime : true;

    logger.info(`Updating guarantee status: ${guaranteeId} with delivery time: ${deliveryTime}, on time: ${onTime}`);

    // Get contract instance
    const deliveryGuarantee = getDeliveryGuaranteeContract();

    // Execute status update with nonce retry according to API documentation
    const tx = await executeWithNonceRetry(async (nonce) => {
      return await deliveryGuarantee.connect(signer).updateGuaranteeStatus(
        guaranteeId,                    // 保证ID
        deliveryTime,                   // 实际送达时间
        onTime,                        // 是否按时送达
        {
          gasLimit: 500000,
          gasPrice: ethers.parseUnits('20', 'gwei'),
          nonce: nonce
        }
      );
    }, await signer.getAddress());

    // Wait for transaction confirmation
    const receipt = await tx.wait();

    logger.info(`Guarantee status updated successfully: ${receipt.transactionHash}`);

    res.json({
      success: true,
      data: {
        guaranteeId: guaranteeId,
        actualDeliveryTime: deliveryTime,
        deliveredOnTime: onTime,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        updatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Guarantee status update failed:', error);
    res.status(500).json({
      success: false,
      error: 'Guarantee status update failed',
      message: error.message
    });
  }
});


router.initializeDependencies = initializeDependencies;
module.exports = router;