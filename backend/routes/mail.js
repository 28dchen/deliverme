const express = require('express');
const { ethers } = require('hardhat');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// Import logger and contracts from main server
let logger, contracts, provider, userSigner, signer;

// Initialize dependencies (will be set by server.js)
function initializeDependencies(deps) {
  logger = deps.logger;
  contracts = deps.contracts;
  provider = deps.provider;
  userSigner = deps.userSigner;
  signer = deps.signer;
}

function loadContractAddresses() {
  const path = require('path');
  const fs = require('fs');
  let contractAddresses = {};
  try {
    // Priority: sepolia-addresses.json > addresses.json
    const sepoliaPath = path.join(__dirname, '../sepolia-addresses.json');
    const addressesPath = path.join(__dirname, './sepolia-addresses.json');
    if (fs.existsSync(sepoliaPath)) {
      contractAddresses = JSON.parse(fs.readFileSync(sepoliaPath, 'utf8'));
      console.log("\nLoaded Sepolia addresses");
    } else if (fs.existsSync(addressesPath)) {
      contractAddresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));
      console.log("\nLoaded addresses (verify network)");
    } else {
      throw new Error("No deployment addresses found");
    }
  } catch (error) {
    console.error("Could not load addresses. Run: npm run deploy:sepolia");
    return null;
  }
  return contractAddresses;
}

async function getNextNonce(signerAddress) {
  try {
    const currentNonce = await provider.getTransactionCount(signerAddress, 'latest');
    const pendingNonce = await provider.getTransactionCount(signerAddress, 'pending');

    // 基础nonce
    const baseNonce = Math.max(currentNonce, pendingNonce);

    // 添加基于时间戳的随机偏移（小范围）
    const timestamp = Date.now();
    const randomOffset = timestamp % 10; // 0-9的随机偏移

    return baseNonce + randomOffset;
  } catch (error) {
    logger.error('Error getting nonce:', error);
    throw error;
  }
}

// Helper function to get mail registry contract instance
function getMailRegistryContract() {
  if (!contracts.mailRegistry) {
    throw new Error('MailRegistry contract not initialized');
  }
  return contracts.mailRegistry;
}

// Helper function to get delivery tracking contract instance
function getDeliveryTrackingContract() {
  if (!contracts.deliveryTracking) {
    throw new Error('DeliveryTracking contract not initialized');
  }
  return contracts.deliveryTracking;
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



// POST /register - Register a new mail
router.post('/register', async (req, res) => {
  try {
    const {
      mailId,
      trackingNumber,
      senderAddress,
      recipientId,
      mailType,
      guaranteedDeliveryTime,
      requiresTimeProof,
      metadata
    } = req.body;

    // Validate required fields
    if (!mailId || !trackingNumber || !senderAddress || !recipientId || mailType === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: mailId, trackingNumber, senderAddress, recipientId, mailType'
      });
    }

    // Mail type mapping: convert string mailType to enum number
    const mailTypeMapping = {
      'document': 0,
      'package': 1,
      'certified': 2,
      'priority': 3
    };

    const mailTypeEnum = mailTypeMapping[mailType.toLowerCase()];
    if (mailTypeEnum === undefined) {
      return res.status(400).json({
        success: false,
        error: `Invalid mailType. Must be one of: ${Object.keys(mailTypeMapping).join(', ')}`
      });
    }

    const mailRegistry = getMailRegistryContract();

    // Prepare metadata in the correct format
    const mailMetadata = {
      weight: metadata?.weight || "0kg",
      size: metadata?.size || "Small",
      priority: metadata?.priority || 0,
      insurance: ethers.parseEther(metadata?.insurance || "0"),
      requiresSignature: metadata?.requiresSignature || false
    };
    console.log("registering mail with metadata:", mailMetadata);

    // const contractAddresses = loadContractAddresses();
    // const MailRegistry_ = await ethers.getContractAt("MailRegistry", contractAddresses.mailRegistry);
    // const nonce_ = getNextNonce();
    // Execute mail registration with nonce retry
    const tx = await executeWithNonceRetry(async (nonce) => {
      return await mailRegistry.connect(signer).registerMail(
        mailId,
        trackingNumber,
        senderAddress,
        recipientId,
        mailTypeEnum,
        guaranteedDeliveryTime || Math.floor(Date.now() / 1000) + 86400, // Default 24h
        requiresTimeProof || false,
        mailMetadata,
        {
          gasLimit: 1000000,
          gasPrice: ethers.parseUnits('20', 'gwei'),
          nonce: nonce
        }
      );
    }, signer);


    // const tx6 = await executeWithNonceRetry(async (nonce) => {
    //   return await mailRegistry.connect(user1).registerMail(
    //     mailId,
    //     trackingNumber,
    //     user1.address,
    //     "RECIPIENT_BOB_001",
    //     1, // PACKAGE enum
    //     guaranteedDeliveryTime,
    //     true, // requires proof of time
    //     mailMetadata,
    //     {
    //       gasLimit: 500000,
    //       gasPrice: ethers.parseUnits("20", "gwei"),
    //       nonce: nonce
    //     }
    //   );
    // }, user1);

    // await tx6.wait();
    await tx.wait();
    logger.info(`Mail registered successfully: ${mailId}`);
    res.json({
      success: true,
      message: 'Mail registered successfully',
      data: {
        mailId,
        trackingNumber,
        status: 'registered',
        registeredAt: new Date().toISOString()
      }
    });


  } catch (error) {
    console.error('Mail registration error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});



// GET /api/mail/:mailId/details - Get mail details
router.get('/:mailId/details', async (req, res) => {
  try {
    const { mailId } = req.params;

    if (!mailId) {
      return res.status(400).json({
        success: false,
        error: 'Mail ID is required'
      });
    }

    logger.info(`Mail details request for: ${mailId}`);

    // Get contract instance
    // const mailRegistry = getMailRegistryContract();

    // Get mail details
    const mailRegistry = getMailRegistryContract();
    const details = await mailRegistry.getMailDetails(mailId);

    // 先输出返回的原始内容
    console.log('Mail details raw response:', details);

    // Convert BigInt to string for JSON serialization
    const guaranteedDeliveryTime = Number(details[7]);

    res.json({
      success: true,
      data: {
        mailId: mailId,
        trackingNumber: details[0],
        senderAddress: details[1],
        recipientId: details[2],
        mailType: ['document', 'package', 'certified', 'priority'][Number(details[3])] || 'package',
        status: Number(details[4]),
        registrationTime: new Date(Number(details[5]) * 1000).toISOString(),
        lastUpdateTime: new Date(Number(details[6]) * 1000).toISOString(),
        guaranteedDeliveryTime: new Date(guaranteedDeliveryTime * 1000).toISOString(),
        proofOfTimeRequired: Boolean(details[8]),
        metadataHash: details[9],
      }
    });

  } catch (error) {
    logger.error('Get mail details failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get mail details',
      message: error.message
    });
  }
});


// GET /api/mail/:mailId/delivery-performance - Get delivery performance
router.get('/:mailId/delivery-performance', async (req, res) => {
  try {
    const { mailId } = req.params;

    if (!mailId) {
      return res.status(400).json({
        success: false,
        error: 'Mail ID is required'
      });
    }

    logger.info(`Delivery performance request for: ${mailId}`);

    // Get contract instances
    const mailRegistry = getMailRegistryContract();
    const deliveryTracking = getDeliveryTrackingContract();

    // Get mail details
    const details = await mailRegistry.getMailDetails(mailId);
    const status = await mailRegistry.getMailStatus(mailId);

    // Mock delivery performance data
    const registrationTime = new Date(Date.now() - (2 * 24 * 60 * 60 * 1000)); // 2 days ago
    const guaranteedDeliveryTime = new Date(details[4] * 1000);
    const actualDeliveryTime = status === 4 ? new Date(Date.now() - (6 * 60 * 60 * 1000)) : null; // 6 hours ago if delivered

    let deliveryStatus, timeAhead, slaCompliance;

    if (actualDeliveryTime) {
      const timeDiff = guaranteedDeliveryTime.getTime() - actualDeliveryTime.getTime();
      if (timeDiff > 0) {
        deliveryStatus = 'delivered_early';
        timeAhead = `${Math.floor(timeDiff / (1000 * 60 * 60))}h ${Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60))}m`;
        slaCompliance = 'exceeded';
      } else {
        deliveryStatus = 'delivered_late';
        timeAhead = `${Math.floor(Math.abs(timeDiff) / (1000 * 60 * 60))}h ${Math.floor((Math.abs(timeDiff) % (1000 * 60 * 60)) / (1000 * 60))}m late`;
        slaCompliance = 'failed';
      }
    } else {
      const now = new Date();
      if (now < guaranteedDeliveryTime) {
        deliveryStatus = 'in_progress';
        slaCompliance = 'on_track';
      } else {
        deliveryStatus = 'overdue';
        slaCompliance = 'at_risk';
      }
      timeAhead = null;
    }

    // Mock milestones
    const milestones = [
      {
        event: 'registered',
        timestamp: registrationTime.toISOString(),
        location: 'New York Main Post Office',
        onSchedule: true
      },
      {
        event: 'collected',
        timestamp: new Date(registrationTime.getTime() + (5 * 60 * 60 * 1000)).toISOString(),
        location: 'NY Processing Center',
        onSchedule: true
      }
    ];

    if (status >= 2) {
      milestones.push({
        event: 'in_transit',
        timestamp: new Date(registrationTime.getTime() + (12 * 60 * 60 * 1000)).toISOString(),
        location: 'Distribution Hub',
        onSchedule: true
      });
    }

    if (status >= 4) {
      milestones.push({
        event: 'delivered',
        timestamp: actualDeliveryTime.toISOString(),
        location: 'Recipient Address',
        onSchedule: deliveryStatus === 'delivered_early'
      });
    }

    res.json({
      success: true,
      deliveryPerformance: {
        mailId: mailId,
        registrationTime: registrationTime.toISOString(),
        guaranteedDeliveryTime: guaranteedDeliveryTime.toISOString(),
        actualDeliveryTime: actualDeliveryTime?.toISOString() || null,
        deliveryStatus: deliveryStatus,
        timeAhead: timeAhead,
        slaCompliance: slaCompliance,
        milestones: milestones
      }
    });

  } catch (error) {
    logger.error('Get delivery performance failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get delivery performance',
      message: error.message
    });
  }
});

// GET /api/mail/tracking/:trackingNumber - Get tracking history
router.get('/tracking/:trackingNumber', async (req, res) => {
  try {
    const { trackingNumber } = req.params;

    if (!trackingNumber) {
      return res.status(400).json({
        success: false,
        error: 'Tracking number is required'
      });
    }

    logger.info(`Tracking history request for: ${trackingNumber}`);

    // Get contract instance
    const deliveryTracking = getDeliveryTrackingContract();

    // Get tracking history
    const history = await deliveryTracking.getTrackingHistory(trackingNumber);

    res.json({
      success: true,
      data: {
        trackingNumber: trackingNumber,
        history: history.map(item => ({
          status: ['registered', 'collected', 'in_transit', 'out_for_delivery', 'delivered', 'exception'][item.status] || 'unknown',
          timestamp: new Date(Number(item.timestamp) * 1000).toISOString(),
          location: item.location,
          coordinates: {
            latitude: Number(item.coordinates.latitude) / 1000000,
            longitude: Number(item.coordinates.longitude) / 1000000
          }
        }))
      }
    });

  } catch (error) {
    logger.error('Get tracking history failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get tracking history',
      message: error.message
    });
  }
});

router.initializeDependencies = initializeDependencies;
module.exports = router;