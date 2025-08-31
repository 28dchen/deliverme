const express = require('express');
const { ethers } = require('ethers');
const crypto = require('crypto');
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

// Helper function to get time proof contract instance
function getTimeProofContract() {
  if (!contracts.timeProof) {
    throw new Error('TimeProof contract not initialized');
  }
  return contracts.timeProof;
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
async function executeWithNonceRetry(transactionFunction, signerAddress, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const nonce = await getNextNonce(signerAddress);
      logger.info(`Transaction attempt ${attempt}: nonce=${nonce}`);

      const result = await transactionFunction(nonce);
      return result;
    } catch (error) {
      if (error.message.includes('nonce too low') && attempt < maxRetries) {
        logger.warn(`Nonce conflict on attempt ${attempt}, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        continue;
      } else {
        throw error;
      }
    }
  }
  throw new Error(`Transaction failed after ${maxRetries} attempts`);
}

// Helper function to generate atomic time signature
function generateAtomicTimeSignature(timestamp, ntpServer) {
  const data = `${timestamp}_${ntpServer}_${Date.now()}`;
  return '0x' + crypto.createHash('sha256').update(data).digest('hex');
}

// Helper function to generate merkle proof
function generateMerkleProof(mailId, eventType, timestamp) {
  const leaves = [
    ethers.keccak256(ethers.toUtf8Bytes(`${mailId}_${eventType}`)),
    ethers.keccak256(ethers.toUtf8Bytes(`${timestamp}`)),
    ethers.keccak256(ethers.toUtf8Bytes(`${Date.now()}`)),
    ethers.keccak256(ethers.toUtf8Bytes(`proof_${Math.random()}`)),
  ];

  return leaves.slice(1); // Return proof path (excluding the leaf itself)
}

// POST /api/proof/generate-time-proof - Generate time proof
// Add alias route for /generate
router.post('/generate', async (req, res) => {
  try {
    const { requestedBy, eventType, privateKey } = req.body;

    // Validate input
    if (!requestedBy || !eventType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: requestedBy, eventType'
      });
    }

    // Validate Ethereum address
    if (!ethers.isAddress(requestedBy)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid requestedBy Ethereum address'
      });
    }

    // Validate event type
    const validEventTypes = ['registration', 'pickup', 'delivery_confirmation', 'dispute'];
    if (!validEventTypes.includes(eventType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid eventType. Must be one of: ${validEventTypes.join(', ')}`
      });
    }

    logger.info(`Time proof generation request for event: ${eventType}`);

    // Generate mock proof hash
    const proofHash = '0x' + Math.random().toString(16).substr(2, 64);

    res.json({
      success: true,
      data: {
        proof: {
          proofHash: proofHash,
          eventType: eventType,
          requestedBy: requestedBy,
          timestamp: new Date().toISOString(),
          blockNumber: Math.floor(Math.random() * 1000000) + 12000000
        }
      }
    });

  } catch (error) {
    logger.error('Time proof generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Time proof generation failed',
      message: error.message
    });
  }
});

router.post('/generate-time-proof', async (req, res) => {
  try {
    const { mailId, eventType, requestedBy } = req.body;

    // Validate input
    if (!mailId || !eventType || !requestedBy) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: mailId, eventType, requestedBy'
      });
    }

    // Validate Ethereum address
    if (!ethers.isAddress(requestedBy)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid requestedBy Ethereum address'
      });
    }

    // Validate event type
    const validEventTypes = ['registration', 'pickup', 'delivery_confirmation', 'dispute'];
    if (!validEventTypes.includes(eventType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid eventType. Must be one of: ${validEventTypes.join(', ')}`
      });
    }

    logger.info(`Time proof generation request for mail: ${mailId}, event: ${eventType}`);

    // Get current timestamp with high precision
    const timestamp = new Date().toISOString();
    const timestampUnix = Math.floor(Date.now() / 1000);

    // Get current block information
    const currentBlock = await provider.getBlock('latest');
    const blockHash = currentBlock.hash;
    const blockNumber = currentBlock.number;

    // Generate atomic time signature
    const ntpServer = 'time.nist.gov';
    const atomicTimeSignature = generateAtomicTimeSignature(timestampUnix, ntpServer);

    // Generate merkle proof
    const merkleProof = generateMerkleProof(mailId, eventType, timestampUnix);

    // Generate certificate chain (mock)
    const certificateChain = [
      ethers.keccak256(ethers.toUtf8Bytes(`cert_root_${Date.now()}`)),
      ethers.keccak256(ethers.toUtf8Bytes(`cert_intermediate_${Date.now()}`)),
    ];

    // Get contract instance
    const timeProof = getTimeProofContract();

    // Check if current signer is authorized as timestamp authority
    const signerAddress = await signer.getAddress();
    const isAuthorized = await timeProof.authorizedTimestampAuthorities(signerAddress);

    if (!isAuthorized) {
      logger.error(`Signer ${signerAddress} is not authorized as timestamp authority`);
      return res.status(403).json({
        success: false,
        error: 'Unauthorized timestamp authority',
        message: `Address ${signerAddress} is not authorized to generate time proofs`
      });
    }

    logger.info(`Signer ${signerAddress} is authorized as timestamp authority`);

    // Map event type to enum value
    const eventTypeMap = {
      'registration': 0,
      'pickup': 1,
      'delivery_confirmation': 2,
      'dispute': 3
    };

    const eventTypeEnum = eventTypeMap[eventType];
    if (eventTypeEnum === undefined) {
      throw new Error(`Invalid event type: ${eventType}`);
    }

    // Prepare atomic time data
    const atomicTimeData = {
      timestamp: timestampUnix,
      ntpServer: ntpServer,
      signature: '0x' + '00'.repeat(64), // 64字节的十六进制字符串
      timestampAuthority: signer.address
    };

    // Generate nonce for the proof
    const nonceBytes = ethers.randomBytes(32);
    const proofNonce = ethers.keccak256(nonceBytes);

    // Execute time proof generation with nonce retry
    const tx = await executeWithNonceRetry(async (nonce) => {
      return await timeProof.connect(signer).generateTimeProof(
        mailId,
        eventTypeEnum,
        requestedBy,
        atomicTimeData,
        certificateChain,
        proofNonce,
        {
          gasLimit: 1000000,
          gasPrice: ethers.parseUnits(process.env.GAS_PRICE || '20', 'gwei'),
          nonce: nonce
        }
      );
    }, await signer.address);

    // Wait for transaction confirmation
    await tx.wait();

    // logger.info(`Time proof generation successful: ${receipt.transactionHash}`);

    // Generate proof hash
    // const proofData = {
    //   mailId,
    //   eventType,
    //   timestamp: timestampUnix,
    //   blockHash,
    //   blockNumber,
    //   transactionHash: receipt.transactionHash
    // };

    // const proofHash = ethers.keccak256(
    //   ethers.toUtf8Bytes(JSON.stringify(proofData))
    // );

    // res.json({
    //   success: true,
    //   proof: {
    //     mailId: mailId,
    //     eventType: eventType,
    //     timestamp: timestamp,
    //     blockHash: blockHash,
    //     blockNumber: blockNumber,
    //     transactionIndex: Math.floor(Math.random() * 100) + 1,
    //     merkleProof: merkleProof,
    //     atomicTimeSignature: atomicTimeSignature,
    //     ntpServerUsed: ntpServer,
    //     certificateChain: certificateChain,
    //     proofHash: proofHash,
    //     transactionHash: receipt.transactionHash,
    //     gasUsed: receipt.gasUsed.toString()
    //   }
    // });

  } catch (error) {
    logger.error('Time proof generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Time proof generation failed',
      message: error.message
    });
  }
});

// GET /api/proof/verify/:proofHash - Verify time proof
router.get('/verify/:proofHash', async (req, res) => {
  try {
    const { proofHash } = req.params;

    if (!proofHash) {
      return res.status(400).json({
        success: false,
        error: 'Proof hash is required'
      });
    }

    // Validate proof hash format
    if (!proofHash.startsWith('0x') || proofHash.length !== 66) {
      return res.status(400).json({
        success: false,
        error: 'Invalid proof hash format'
      });
    }

    logger.info(`Time proof verification request for: ${proofHash}`);

    // Get contract instance
    const timeProof = getTimeProofContract();

    // Verify time proof
    const verification = await timeProof.verifyTimeProof(proofHash);

    // Get additional proof details
    const proofDetails = await timeProof.getTimeProof(proofHash);

    res.json({
      success: true,
      verification: {
        isValid: verification.isValid,
        mailId: verification.mailId,
        originalTimestamp: new Date(verification.originalTimestamp * 1000).toISOString(),
        blockchainConfirmed: verification.blockchainConfirmed,
        atomicTimeVerified: verification.atomicTimeVerified,
        merkleProofValid: verification.merkleProofValid,
        verificationTimestamp: new Date().toISOString(),
        proofDetails: {
          eventType: proofDetails.eventType,
          blockHash: proofDetails.blockHash,
          blockNumber: proofDetails.blockNumber,
          transactionIndex: proofDetails.transactionIndex,
          ntpServerUsed: proofDetails.ntpServerUsed
        }
      }
    });

  } catch (error) {
    logger.error('Time proof verification failed:', error);
    res.status(500).json({
      success: false,
      error: 'Time proof verification failed',
      message: error.message
    });
  }
});

// GET /api/proof/details/:proofHash - Get detailed time proof information
router.get('/details/:proofHash', async (req, res) => {
  try {
    const { proofHash } = req.params;

    if (!proofHash) {
      return res.status(400).json({
        success: false,
        error: 'Proof hash is required'
      });
    }

    // Validate proof hash format
    if (!proofHash.startsWith('0x') || proofHash.length !== 66) {
      return res.status(400).json({
        success: false,
        error: 'Invalid proof hash format'
      });
    }

    logger.info(`Time proof details request for: ${proofHash}`);

    // Get contract instance
    const timeProof = getTimeProofContract();

    // Get proof details
    const details = await timeProof.getTimeProof(proofHash);

    res.json({
      success: true,
      data: {
        proofHash: proofHash,
        mailId: details.mailId,
        eventType: details.eventType,
        timestamp: new Date(details.timestamp * 1000).toISOString(),
        blockHash: details.blockHash,
        blockNumber: details.blockNumber,
        transactionIndex: details.transactionIndex,
        merkleProof: details.merkleProof,
        atomicTimeSignature: details.atomicTimeSignature,
        ntpServerUsed: details.ntpServerUsed,
        certificateChain: details.certificateChain,
        retrievedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Get time proof details failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get time proof details',
      message: error.message
    });
  }
});

// POST /api/proof/batch-verify - Verify multiple time proofs
router.post('/batch-verify', async (req, res) => {
  try {
    const { proofHashes } = req.body;

    if (!proofHashes || !Array.isArray(proofHashes)) {
      return res.status(400).json({
        success: false,
        error: 'proofHashes must be an array'
      });
    }

    if (proofHashes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one proof hash is required'
      });
    }

    if (proofHashes.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 10 proof hashes allowed per batch'
      });
    }

    logger.info(`Batch time proof verification request for ${proofHashes.length} proofs`);

    // Get contract instance
    const timeProof = getTimeProofContract();

    // Verify each proof
    const results = [];

    for (const proofHash of proofHashes) {
      try {
        // Validate proof hash format
        if (!proofHash.startsWith('0x') || proofHash.length !== 66) {
          results.push({
            proofHash: proofHash,
            isValid: false,
            error: 'Invalid proof hash format'
          });
          continue;
        }

        // Verify proof
        const verification = await timeProof.verifyTimeProof(proofHash);

        results.push({
          proofHash: proofHash,
          isValid: verification.isValid,
          mailId: verification.mailId,
          originalTimestamp: new Date(verification.originalTimestamp * 1000).toISOString(),
          blockchainConfirmed: verification.blockchainConfirmed,
          atomicTimeVerified: verification.atomicTimeVerified,
          merkleProofValid: verification.merkleProofValid
        });

      } catch (error) {
        results.push({
          proofHash: proofHash,
          isValid: false,
          error: error.message
        });
      }
    }

    // Calculate summary statistics
    const validCount = results.filter(r => r.isValid).length;
    const invalidCount = results.length - validCount;

    res.json({
      success: true,
      data: {
        totalProofs: results.length,
        validProofs: validCount,
        invalidProofs: invalidCount,
        verificationTimestamp: new Date().toISOString(),
        results: results
      }
    });

  } catch (error) {
    logger.error('Batch time proof verification failed:', error);
    res.status(500).json({
      success: false,
      error: 'Batch verification failed',
      message: error.message
    });
  }
});

// POST /api/proof/record-delivery-time - Record delivery time
router.post('/record-delivery-time', async (req, res) => {
  try {
    const { mailId, deliveryTime, location, signature } = req.body;

    // Validate input
    if (!mailId || !deliveryTime || !location) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: mailId, deliveryTime, location'
      });
    }

    logger.info(`Recording delivery time for mail: ${mailId}`);

    // Get contract instance
    const timeProof = getTimeProofContract();

    // Convert delivery time to timestamp
    const deliveryTimestamp = Math.floor(new Date(deliveryTime).getTime() / 1000);

    // Execute delivery time recording with nonce retry
    const tx = await executeWithNonceRetry(async (nonce) => {
      return await timeProof.connect(signer).recordDeliveryTime(
        mailId,
        deliveryTimestamp,
        location,
        signature || '0x',
        {
          gasLimit: 300000,
          gasPrice: ethers.parseUnits('20', 'gwei'),
          nonce: nonce
        }
      );
    }, await signer.getAddress());

    // Wait for transaction confirmation
    const receipt = await tx.wait();

    logger.info(`Delivery time recorded successfully: ${receipt.transactionHash}`);

    res.json({
      success: true,
      data: {
        mailId: mailId,
        deliveryTime: deliveryTime,
        location: location,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      }
    });

  } catch (error) {
    logger.error('Record delivery time failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record delivery time',
      message: error.message
    });
  }
});

// GET /api/proof/delivery-time/:mailId - Get delivery time proof
router.get('/delivery-time/:mailId', async (req, res) => {
  try {
    const { mailId } = req.params;

    if (!mailId) {
      return res.status(400).json({
        success: false,
        error: 'Mail ID is required'
      });
    }

    logger.info(`Getting delivery time proof for mail: ${mailId}`);

    // Get contract instance
    const timeProof = getTimeProofContract();

    // Get delivery time proof
    const proof = await timeProof.getDeliveryTimeProof(mailId);

    res.json({
      success: true,
      data: {
        mailId: mailId,
        deliveryTime: new Date(Number(proof.deliveryTime) * 1000).toISOString(),
        location: proof.location,
        signature: proof.signature,
        blockNumber: Number(proof.blockNumber),
        timestamp: new Date(Number(proof.timestamp) * 1000).toISOString(),
        isVerified: proof.isVerified
      }
    });

  } catch (error) {
    logger.error('Get delivery time proof failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get delivery time proof',
      message: error.message
    });
  }
});

// GET /api/proof/mail/:mailId - Get all time proofs for a mail item
router.get('/mail/:mailId', async (req, res) => {
  try {
    const { mailId } = req.params;

    if (!mailId) {
      return res.status(400).json({
        success: false,
        error: 'Mail ID is required'
      });
    }

    logger.info(`Time proofs request for mail: ${mailId}`);

    // Mock time proofs for the mail item
    const proofs = [
      {
        proofHash: ethers.keccak256(ethers.toUtf8Bytes(`${mailId}_registration_${Date.now()}`)),
        eventType: 'registration',
        timestamp: new Date(Date.now() - (2 * 24 * 60 * 60 * 1000)).toISOString(),
        isValid: true
      },
      {
        proofHash: ethers.keccak256(ethers.toUtf8Bytes(`${mailId}_pickup_${Date.now()}`)),
        eventType: 'pickup',
        timestamp: new Date(Date.now() - (1.5 * 24 * 60 * 60 * 1000)).toISOString(),
        isValid: true
      },
      {
        proofHash: ethers.keccak256(ethers.toUtf8Bytes(`${mailId}_delivery_confirmation_${Date.now()}`)),
        eventType: 'delivery_confirmation',
        timestamp: new Date(Date.now() - (6 * 60 * 60 * 1000)).toISOString(),
        isValid: true
      }
    ];

    res.json({
      success: true,
      data: {
        mailId: mailId,
        totalProofs: proofs.length,
        proofs: proofs,
        retrievedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Get mail time proofs failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get mail time proofs',
      message: error.message
    });
  }
});

router.initializeDependencies = initializeDependencies;
module.exports = router;