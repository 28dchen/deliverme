const express = require('express');
const { ethers } = require('hardhat');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { sign } = require('crypto');

// Dependencies injected from server.js
let logger, contracts, provider, signer, userSigner, workerSigner;

// Initialize dependencies
function initializeDependencies(deps) {
    logger = deps.logger;
    contracts = deps.contracts;
    provider = deps.provider;
    signer = deps.signer;
    userSigner = deps.userSigner;
    workerSigner = deps.workerSigner;

}

function loadContractAddresses() {
    let contractAddresses = {};
    try {
        // Priority: sepolia-addresses.json > addresses.json
        const sepoliaPath = path.join(__dirname, '../sepolia-addresses.json');
        const addressesPath = path.join(__dirname, '../addresses.json');

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

// Helper function to get delivery tracking contract instance
function getDeliveryTrackingContract(customSigner = null) {
    if (!contracts.deliveryTracking) {
        throw new Error('DeliveryTracking contract not initialized');
    }
    if (customSigner) {
        return contracts.deliveryTracking.connect(customSigner);
    }
    return contracts.deliveryTracking;
}

// Helper function for nonce management
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

// Helper function for transaction execution with nonce retry
async function executeWithNonceRetry(transactionFunction, signerAddress, maxRetries = 5) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const nonce = await getNextNonce(signerAddress);
            logger.info(`Transaction attempt ${attempt}, using nonce: ${nonce}`);

            const tx = await transactionFunction(nonce);
            return tx;
        } catch (error) {
            logger.warn(`Transaction attempt ${attempt} failed:`, error.message);

            if (attempt === maxRetries) {
                throw new Error(`Transaction failed after ${maxRetries} attempts: ${error.message}`);
            }

            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
}

// In-memory delivery status tracking for demo purposes
const deliveryStatuses = new Map();

// POST /update-status - Update delivery status
router.post('/update-status', async (req, res) => {
    try {
        const {
            trackingNumber,
            location,
            coordinates,
            status,
            signature,
            timeData
        } = req.body;

        // Validate required fields
        if (!trackingNumber || !location || status === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: trackingNumber, location, status'
            });
        }

        // Status mapping: convert string status to enum number
        const statusMapping = {
            'pending': 0,
            'collected': 1,
            'in_transit': 2,
            'delivered': 3
        };

        const statusEnum = statusMapping[status.toLowerCase()];
        if (statusEnum === undefined) {
            return res.status(400).json({
                success: false,
                error: `Invalid status. Must be one of: ${Object.keys(statusMapping).join(', ')}`
            });
        }

        // Prepare coordinates in the correct format (multiply by 1,000,000 for precision)
        const formattedCoordinates = {
            latitude: Math.floor((coordinates?.latitude || 0) * 1000000),
            longitude: Math.floor((coordinates?.longitude || 0) * 1000000)
        };

        const timeProof = {
            ntpServer: timeData?.ntpServer || 'time.google.com',
            atomicTime: timeData?.atomicTime || Math.floor(Date.now() / 1000),
            timezone: timeData?.timezone || 'UTC'
        };

        // Store status update in memory
        const statusUpdate = {
            trackingNumber,
            location,
            coordinates: formattedCoordinates,
            status: statusEnum,
            statusName: status.toLowerCase(),
            signature: signature || '0x',
            timeProof,
            timestamp: new Date().toISOString(),
            updateId: `update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };

        // Get existing tracking history or create new
        let trackingHistory = deliveryStatuses.get(trackingNumber) || [];
        trackingHistory.push(statusUpdate);
        deliveryStatuses.set(trackingNumber, trackingHistory);

        logger.info(`Status update successful for tracking: ${trackingNumber}, status: ${status}`);

        // Simulate blockchain transaction for consistency with API
        const mockTransactionHash = `0x${Math.random().toString(16).substr(2, 64)}`;
        const mockBlockNumber = Math.floor(Math.random() * 1000000) + 9000000;

        res.json({
            success: true,
            message: 'Delivery status updated successfully',
            data: {
                trackingNumber,
                status: status.toLowerCase(),
                location,
                coordinates: formattedCoordinates,
                transactionHash: mockTransactionHash,
                blockNumber: mockBlockNumber,
                timestamp: statusUpdate.timestamp,
                updateId: statusUpdate.updateId
            }
        });

    } catch (error) {
        logger.error('Status update failed:', error);
        res.status(500).json({
            success: false,
            error: 'Status update failed',
            message: error.message
        });
    }
});

// POST /register-worker - Register a new worker (Admin only)
router.post('/register-worker', async (req, res) => {
    try {
        const { workerAddress, name, workerType } = req.body;

        // Validate required fields
        if (!workerAddress || !name || !workerType) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: workerAddress, name, workerType'
            });
        }

        // Validate Ethereum address
        if (!ethers.isAddress(workerAddress)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid Ethereum address'
            });
        }

        // const deliveryTracking = getDeliveryTrackingContract(userSigner);
        // const signerAddress = await userSigner.getAddress();
        const nonce = getNextNonce(signer);
        const contractAddresses = loadContractAddresses();
        const deliveryTracking_ = await ethers.getContractAt("DeliveryTracking", contractAddresses.deliveryTracking);
        const tx = await deliveryTracking_.connect(signer).registerWorker(
            workerAddress,
            name,
            workerType,
            {
                gasLimit: 300000,
                gasPrice: ethers.parseUnits("20", "gwei"),
                nonce: nonce
            }
            , signer);
        await tx.wait();
        // const tx = await executeWithNonceRetry(async (nonce) => {
        //     return await contracts.deliveryTracking.connect(userSigner).registerWorker(
        //         workerAddress,
        //         name,
        //         workerType,
        //         {
        //             gasLimit: 300000,
        //             gasPrice: ethers.parseUnits('20', 'gwei'),
        //             nonce: nonce
        //         }
        //     );
        // }, signerAddress);

        // logger.info(`Worker registration transaction sent: ${tx.hash}`);

        // Wait for transaction confirmation
        // logger.info(`Worker registration confirmed in block: ${receipt.blockNumber}`);


    } catch (error) {
        logger.error('Error registering worker:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to register worker, maybe already registered'
            // details: error.message
        });
    }
});

// async function getNextNonce(signer) {
//     try {
//         const currentNonce = await ethers.provider.getTransactionCount(signer.address, "latest");
//         const pendingNonce = await ethers.provider.getTransactionCount(signer.address, "pending");

//         const nextNonce = Math.max(currentNonce, pendingNonce);

//         console.log(`Nonce ${signer.address}: curr=${currentNonce}, pend=${pendingNonce}, use=${nextNonce}`);

//         await new Promise(resolve => setTimeout(resolve, 1000)); // propagation delay

//         return nextNonce;
//     } catch (error) {
//         console.log(`Nonce error ${signer.address}:`, error.message);
//         const fallbackNonce = await ethers.provider.getTransactionCount(signer.address, "latest");
//         return fallbackNonce + 1;
//     }
// }

// GET /worker/:workerAddress - Get worker details
router.get('/worker/:workerAddress', async (req, res) => {
    try {
        const { workerAddress } = req.params;

        // Validate Ethereum address
        if (!ethers.isAddress(workerAddress)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid Ethereum address'
            });
        }

        const deliveryTrackingContract = getDeliveryTrackingContract();

        // Get worker details using getWorkerInfo method
        const workerDetails = await deliveryTrackingContract.getWorkerInfo(workerAddress);

        // According to DeliveryTracking ABI, getWorkerInfo returns: [isRegistered, name, workerType, registrationTime]
        const [isRegistered, name, workerType, registrationTime] = workerDetails;

        res.json({
            success: true,
            data: {
                workerAddress,
                isRegistered: isRegistered,
                name: name,
                workerType: workerType,
                registrationTime: registrationTime.toString()
            }
        });

    } catch (error) {
        logger.error('Error getting worker details:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get worker details',
            details: error.message
        });
    }
});

// POST /update-delivery-status - Update delivery status
// router.post('/update-delivery-status', async (req, res) => {
//     try {
//         const { trackingNumber, location, coordinates, status, signature, timeData } = req.body;

//         // Validate required fields
//         if (!trackingNumber || status === undefined) {
//             return res.status(400).json({
//                 success: false,
//                 error: 'Missing required fields: trackingNumber, status'
//             });
//         }

//         // 状态枚举映射
//         const statusMapping = {
//             'pending': 0,
//             'collected': 1,
//             'in_transit': 2,
//             'delivered': 3
//         };

//         // 转换状态为枚举值
//         const statusEnum = typeof status === 'string' ? statusMapping[status.toLowerCase()] : status;
//         if (statusEnum === undefined) {
//             return res.status(400).json({
//                 success: false,
//                 error: 'Invalid status. Must be one of: pending, collected, in_transit, delivered or 0-3'
//             });
//         }

//         // 设置默认坐标（如果未提供）
//         const coords = coordinates || {
//             latitude: 0,
//             longitude: 0
//         };

//         // 设置默认时间数据（如果未提供）
//         const timeProof = timeData || {
//             ntpServer: "time.google.com",
//             atomicTime: Math.floor(Date.now() / 1000),
//             timezone: "UTC"
//         };

//         // const deliveryTrackingContract = getDeliveryTrackingContract();
//         // const signerAddress = await signer.getAddress();
//         logger.info(`Updating delivery status for tracking: ${trackingNumber}, status: ${statusEnum}, location: ${location}`);
//         const addresses = loadContractAddresses();
//         const deliveryTracking_ = await ethers.getContractAt("DeliveryTracking", addresses.deliveryTracking);
//         const nonce = await getNextNonce(signer);
//         // Execute transaction with nonce retry
//         const tx = await deliveryTracking_.connect(signer).updateStatus(
//             trackingNumber,              // 跟踪号
//             location || '',              // 位置描述
//             coords,                      // 坐标
//             statusEnum,                  // 状态枚举值
//             signature || "0x1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d",           // 签名
//             timeProof,                   // 时间数据
//             {
//                 gasLimit: 600000,
//                 gasPrice: ethers.parseUnits('30', 'gwei'),
//                 nonce: nonce
//             }
//         );

//         logger.info(`Delivery status update transaction sent: ${tx.hash}`);

//         // Wait for transaction confirmation
//         await tx.wait();

//         res.json({
//             success: true,
//             message: 'Delivery status updated successfully',
//             data: {
//                 trackingNumber,
//                 location: location || '',
//                 coordinates: coords,
//                 status: statusEnum,
//                 signature: signature || '0x',
//                 timeData: timeProof,
//                 transactionHash: tx.hash,
//                 updatedAt: new Date().toISOString()
//             }
//         });

//     } catch (error) {
//         logger.error('Error updating delivery status:', error);
//         res.status(500).json({
//             success: false,
//             error: 'Failed to update delivery status',
//             details: error.message
//         });
//     }
// });

// GET /delivery-history/:mailId - Get delivery history for a mail
router.get('/delivery-history/:mailId', async (req, res) => {
    try {
        const { mailId } = req.params;

        // Get delivery history from in-memory storage
        const trackingHistory = deliveryStatuses.get(mailId) || [];

        // Format history for response
        const formattedHistory = trackingHistory.map(update => ({
            status: update.statusName,
            timestamp: update.timestamp,
            location: update.location,
            coordinates: update.coordinates,
            signature: update.signature,
            updateId: update.updateId
        }));

        res.json({
            success: true,
            data: {
                mailId,
                trackingHistory: formattedHistory,
                totalUpdates: formattedHistory.length
            }
        });

    } catch (error) {
        logger.error('Error getting delivery history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get delivery history',
            details: error.message
        });
    }
});

// GET /current-status/:mailId - Get current delivery status
router.get('/current-status/:mailId', async (req, res) => {
    try {
        const { mailId } = req.params;

        // Get delivery history from in-memory storage
        const trackingHistory = deliveryStatuses.get(mailId) || [];

        if (trackingHistory.length === 0) {
            return res.json({
                success: true,
                data: {
                    mailId,
                    currentStatus: {
                        status: 'pending',
                        statusCode: 0,
                        location: 'Not yet collected',
                        lastUpdated: null
                    }
                }
            });
        }

        // Get the latest status update
        const latestUpdate = trackingHistory[trackingHistory.length - 1];

        res.json({
            success: true,
            data: {
                mailId,
                currentStatus: {
                    status: latestUpdate.statusName,
                    statusCode: latestUpdate.status,
                    location: latestUpdate.location,
                    coordinates: latestUpdate.coordinates,
                    lastUpdated: latestUpdate.timestamp,
                    updateId: latestUpdate.updateId
                }
            }
        });

    } catch (error) {
        logger.error('Error getting current delivery status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get current delivery status',
            details: error.message
        });
    }
});

// GET /performance - Get delivery performance metrics
router.get('/performance', async (req, res) => {
    try {
        logger.info('Getting delivery performance metrics');

        // Mock performance data (should be replaced with actual blockchain queries)
        const performanceData = {
            totalDeliveries: Math.floor(Math.random() * 1000) + 500,
            onTimeDeliveries: Math.floor(Math.random() * 800) + 400,
            delayedDeliveries: Math.floor(Math.random() * 200) + 50,
            averageDeliveryTime: Math.floor(Math.random() * 48) + 24, // hours
            successRate: (Math.random() * 0.2 + 0.8).toFixed(2), // 80-100%
            lastUpdated: new Date().toISOString()
        };

        res.json({
            success: true,
            data: performanceData
        });

    } catch (error) {
        logger.error('Error getting delivery performance:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get delivery performance',
            details: error.message
        });
    }
});

// GET /metrics - Get performance metrics
router.get('/metrics', async (req, res) => {
    try {
        logger.info('Getting performance metrics');

        // Mock metrics data (should be replaced with actual blockchain queries)
        const metricsData = {
            dailyDeliveries: Math.floor(Math.random() * 100) + 50,
            weeklyDeliveries: Math.floor(Math.random() * 700) + 350,
            monthlyDeliveries: Math.floor(Math.random() * 3000) + 1500,
            averageProcessingTime: Math.floor(Math.random() * 24) + 12, // hours
            customerSatisfaction: (Math.random() * 0.3 + 0.7).toFixed(1), // 7.0-10.0
            workerEfficiency: (Math.random() * 0.2 + 0.8).toFixed(2), // 80-100%
            lastCalculated: new Date().toISOString()
        };

        res.json({
            success: true,
            data: metricsData
        });

    } catch (error) {
        logger.error('Error getting performance metrics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get performance metrics',
            details: error.message
        });
    }
});

router.initializeDependencies = initializeDependencies;
module.exports = router;