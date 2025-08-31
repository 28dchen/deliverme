const axios = require('axios');

// Base URL for the blockchain service
const BASE_URL = 'http://localhost:3001';

// Test configuration
const TEST_CONFIG = {
  timeout: 60000, // 60 seconds timeout for blockchain operations
  headers: {
    'Content-Type': 'application/json'
  }
};

// Process command line arguments
const args = process.argv.slice(2);
const userAddress = args[0] || '0x0BBe0E741C165952307aD4901A5804704849C81c';
const privateKey = args[1] || '8d8db61b3868caf9edb8d09718483d47698ebdfbb137971f828aef8889816be1';

// Test data
let testData = {
  userAddress: userAddress,
  privateKey: privateKey,
  name: 'Test User',
  email: 'test@example.com',
  password: 'testPassword123',
  mailId: `MAIL_${Date.now()}_${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
  trackingNumber: `TN${Date.now()}`,
  guaranteeId: `GUARANTEE_${Date.now()}_${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
  userId: null,
  authToken: null,
  workerAddress: '0x2Cb2E88CBE054982833A4A08658e1341Ca04b8dC',
  proofHash: null
};

// Helper function to make API requests
async function makeRequest(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      ...TEST_CONFIG
    };
    console.log(data)

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return {
      success: true,
      status: response.status,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      status: error.response?.status || 0,
      error: error.response?.data || error.message
    };
  }
}

// Test functions
async function testHealthCheck() {
  console.log('\n🔍 Testing Health Check...');
  const result = await makeRequest('GET', '/health');

  if (result.success) {
    console.log('✅ Health check passed:', result.data);
  } else {
    console.log('❌ Health check failed:', result.error);
  }

  return result.success;
}

async function testBlockchainStatus() {
  console.log('\n🔍 Testing Blockchain Status...');
  const result = await makeRequest('GET', '/blockchain/status');

  if (result.success) {
    console.log('✅ Blockchain status check passed:', result.data);
  } else {
    console.log('❌ Blockchain status check failed:', result.error);
  }

  return result.success;
}

// User-related tests
async function testUserRegistration() {
  console.log('\n🔍 Testing User Registration...');
  const result = await makeRequest('POST', '/api/user/register', {
    name: testData.name,
    email: testData.email,
    password: testData.password
  });

  if (result.success) {
    console.log('✅ User registration passed:', result.data);
    // Store user ID if available
    if (result.data && result.data.userId) {
      testData.userId = result.data.userId;
    }
  } else {
    console.log('❌ User registration failed:', result.error);
  }

  return result.success;
}

async function testUserLogin() {
  console.log('\n🔍 Testing User Login...');
  const result = await makeRequest('POST', '/api/user/authenticate', {
    password: testData.password
  });

  if (result.success) {
    console.log('✅ User login passed:', result.data);
    // Store authentication token if available
    if (result.data && result.data.token) {
      testData.authToken = result.data.token;
    }
  } else {
    console.log('❌ User login failed:', result.error);
  }

  return result.success;
}

async function testUserProfile() {
  console.log('\n🔍 Testing User Profile...');
  const result = await makeRequest('GET', `/api/user/${testData.userAddress}`);

  if (result.success) {
    console.log('✅ User profile check passed:', result.data);
  } else {
    console.log('❌ User profile check failed:', result.error);
  }

  return result.success;
}

async function testUserUpdate() {
  console.log('\n🔍 Testing User Update...');
  console.log('⚠️  User update API not implemented in api.md - skipping test');

  // Since there's no user update API defined in api.md, we'll skip this test
  // and return true to avoid test failures
  return true;
}

// Delivery tracking tests
async function testDeliveryStatusUpdate() {
  console.log('\n🔍 Testing Delivery Status Update...');

  const coordinates = {
    latitude: 40712800,    // 纽约 * 1e6
    longitude: -74006000
  };

  const timeData = {
    ntpServer: "time.google.com",
    atomicTime: Math.floor(Date.now() / 1000),
    timezone: "UTC"
  };

  const result = await makeRequest('POST', '/api/delivery-tracking/update-status', {
    trackingNumber: testData.trackingNumber,
    location: 'Collection Center - NYC',
    coordinates: coordinates,
    status: 'collected',
    signature: "0x1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d",
    timeData: timeData
  });

  if (result.success) {
    console.log('✅ Delivery status update passed:', result.data);
  } else {
    console.log('❌ Delivery status update failed:', result.error);
  }

  return result.success;
}

async function testTrackingHistory() {
  console.log('\n🔍 Testing Tracking History...');
  const result = await makeRequest('GET', `/api/delivery-tracking/delivery-history/${testData.mailId}`);

  if (result.success) {
    console.log('✅ Tracking history check passed:', result.data);
  } else {
    console.log('❌ Tracking history check failed:', result.error);
  }

  return result.success;
}

// Performance and metrics tests
async function testDeliveryPerformance() {
  console.log('\n🔍 Testing Delivery Performance...');
  const result = await makeRequest('GET', '/api/delivery-tracking/performance');

  if (result.success) {
    console.log('✅ Delivery performance check passed:', result.data);
  } else {
    console.log('❌ Delivery performance check failed:', result.error);
  }

  return result.success;
}

async function testPerformanceMetrics() {
  console.log('\n🔍 Testing Performance Metrics...');
  const result = await makeRequest('GET', '/api/delivery-tracking/metrics');

  if (result.success) {
    console.log('✅ Performance metrics check passed:', result.data);
  } else {
    console.log('❌ Performance metrics check failed:', result.error);
  }

  return result.success;
}

// Guarantee status update test
async function testGuaranteeStatusUpdate() {
  console.log('\n🔍 Testing Guarantee Status Update...');

  if (!testData.guaranteeId) {
    console.log('⚠️ Skipping guarantee status update test - no valid guarantee created');
    return false;
  }

  const result = await makeRequest('PUT', `/api/guarantee/${testData.guaranteeId}/status`, {
    actualDeliveryTime: Math.floor(Date.now() / 1000),
    deliveredOnTime: true
  });

  if (result.success) {
    console.log('✅ Guarantee status update passed:', result.data);
  } else {
    console.log('❌ Guarantee status update failed:', result.error);
  }

  return result.success;
}


// Worker-related tests
async function testWorkerRegistration() {
  console.log('\n🔍 Testing Worker Registration...');
  const result = await makeRequest('POST', '/api/delivery-tracking/register-worker', {
    workerAddress: testData.workerAddress,
    name: 'Test Worker',
    workerType: 'admin'
  });

  if (result.success) {
    console.log('✅ Worker registration passed:', result.data);
  } else {
    console.log('❌ Worker registration failed:', result.error);
  }

  return result.success;
}

async function testWorkerProfile() {
  console.log('\n🔍 Testing Worker Profile...');
  const result = await makeRequest('GET', `/api/delivery-tracking/worker/${testData.workerAddress}`);

  if (result.success) {
    console.log('✅ Worker profile check passed:', result.data);
  } else {
    console.log('❌ Worker profile check failed:', result.error);
  }

  return result.success;
}

async function testMailRegistration() {
  console.log('\n🔍 Testing Mail Registration...');

  const mailMetadata = {
    weight: "2.5kg",
    size: "Medium",
    priority: 1,
    insurance: "0.01",
    requiresSignature: true
  };

  const guaranteedDeliveryTime = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // +24h

  const result = await makeRequest('POST', '/api/mail/register', {
    mailId: testData.mailId,
    trackingNumber: testData.trackingNumber,
    senderAddress: testData.userAddress,
    recipientId: 'RECIPIENT_BOB_001',
    mailType: 'package', // String type as expected by API
    guaranteedDeliveryTime: guaranteedDeliveryTime,
    requiresTimeProof: true,
    metadata: mailMetadata // Changed from mailMetadata to metadata
  });

  if (result.success) {
    console.log('✅ Mail registration passed:', result.data);
    // Update mailId from response if available
    if (result.data && result.data.mailId) {
      testData.mailId = result.data.mailId;
    }
  } else {
    console.log('❌ Mail registration failed:', result.error);
  }

  return result.success;
}

// async function testMailStatusUpdate() {
//   console.log('\n🔍 Testing Mail Status Update...');
//   const result = await makeRequest('POST', '/api/mail/update-status', {
//     trackingNumber: testData.trackingNumber,
//     location: 'Distribution Center A',
//     status: 'in_transit',
//     coordinates: {
//       latitude: 40.7128,
//       longitude: -74.0060
//     },
//     signature: '0x',
//     proofOfTime: {
//       ntpServer: 'time.google.com',
//       atomicTime: Math.floor(Date.now() / 1000),
//       timezone: 'UTC'
//     }
//   });

//   if (result.success) {
//     console.log('✅ Mail status update passed:', result.data);
//   } else {
//     console.log('❌ Mail status update failed:', result.error);
//   }

//   return result.success;
// }

async function testMailDetails() {
  console.log('\n🔍 Testing Mail Details...');
  const result = await makeRequest('GET', `/api/mail/${testData.mailId}/details`);

  if (result.success) {
    console.log('✅ Mail details check passed:', result.data);
  } else {
    console.log('❌ Mail details check failed:', result.error);
  }

  return result.success;
}

async function testTimeProofGeneration() {
  console.log('\n🔍 Testing Time Proof Generation...');
  const result = await makeRequest('POST', '/api/proof/generate-time-proof', {
    mailId: testData.mailId,
    location: 'Test Location',
    eventType: 'pickup',
    requestedBy: testData.userAddress
  });

  if (result.success) {
    console.log('✅ Time proof generation passed:', result.data);
    // Store proof hash for verification test
    testData.proofHash = result.data.proof?.proofHash;
  } else {
    console.log('❌ Time proof generation failed:', result.error);
  }

  return result.success;
}

async function testTimeProofVerification() {
  console.log('\n🔍 Testing Time Proof Verification...');

  if (!testData.proofHash) {
    // Use a mock proof hash if generation failed (must be 66 characters: 0x + 64 hex chars)
    testData.proofHash = '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
  }

  const result = await makeRequest('GET', `/api/proof/verify/${testData.proofHash}`);

  if (result.success) {
    console.log('✅ Time proof verification passed:', result.data);
  } else {
    console.log('❌ Time proof verification failed:', result.error);
  }

  return result.success;
}

async function testGuaranteeCreation() {
  console.log('\n🔍 Testing Guarantee Creation...');
  const result = await makeRequest('POST', '/api/guarantee/create', {
    mailId: testData.mailId,
    penaltyAmount: '0.1',
    insurance: '0.15',
    guaranteedDeliveryTime: Math.floor((Date.now() + (48 * 60 * 60 * 1000)) / 1000),
    escalationContacts: [testData.userAddress] // Add required escalation contact
  });

  if (result.success) {
    console.log('✅ Guarantee creation passed:', result.data);
    // Update guaranteeId from response if available
    if (result.data && result.data.guaranteeId) {
      testData.guaranteeId = result.data.guaranteeId;
    }
  } else {
    console.log('❌ Guarantee creation failed:', result.error);
  }

  return result.success;
}

async function testGuaranteeDetails() {
  console.log('\n🔍 Testing Guarantee Details...');

  // Check if we have a valid guaranteeId from previous guarantee creation
  if (!testData.guaranteeId) {
    console.log('⚠️ Skipping guarantee details test - no valid guarantee created');
    return false;
  }
  const result = await makeRequest('GET', `/api/guarantee/${testData.guaranteeId}`);

  if (result.success) {
    console.log('✅ Guarantee details check passed:', result.data);
  } else {
    console.log('❌ Guarantee details check failed:', result.error);
  }

  return result.success;
}

async function testGuaranteeStats() {
  console.log('\n🔍 Testing Guarantee Statistics...');
  const result = await makeRequest('GET', '/api/guarantee/stats');

  if (result.success) {
    console.log('✅ Guarantee statistics check passed:', result.data);
  } else {
    console.log('❌ Guarantee statistics check failed:', result.error);
  }

  return result.success;
}

// Main test runner
// Helper function to reset test data
async function resetTestData() {
  console.log('🔄 Resetting test data...');
  // Generate new test data for each run
  testData.mailId = `MAIL_${Date.now()}_${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
  testData.trackingNumber = `TN${Date.now()}`;
  testData.guaranteeId = 'GUARANTEE_1756261977972_9Y03J7T4'; // Use provided guarantee ID
  testData.userId = null;
  testData.authToken = null;
  testData.proofHash = null;
  console.log('✅ Test data reset successfully');
  return true;
}

async function runAllTests() {
  console.log('🚀 Starting API Tests for Blockchain Service');
  console.log('='.repeat(60));

  // Reset test data before starting
  await resetTestData();
  console.log('');

  const tests = [
    { name: 'Health Check', fn: testHealthCheck },
    { name: 'Blockchain Status', fn: testBlockchainStatus },
    // Skip user registration tests as requested
    { name: 'User Registration', fn: testUserRegistration },
    { name: 'User Login', fn: testUserLogin },
    { name: 'User Profile', fn: testUserProfile },
    { name: 'Worker Registration', fn: testWorkerRegistration },
    { name: 'Worker Profile', fn: testWorkerProfile },
    { name: 'Mail Registration', fn: testMailRegistration },
    { name: 'Mail Details', fn: testMailDetails },
    { name: 'Delivery Status Update', fn: testDeliveryStatusUpdate },
    { name: 'Tracking History', fn: testTrackingHistory },

    { name: 'Time Proof Generation', fn: testTimeProofGeneration },
    { name: 'Time Proof Verification', fn: testTimeProofVerification },

    { name: 'Guarantee Creation', fn: testGuaranteeCreation },
    { name: 'Guarantee Details', fn: testGuaranteeDetails },
    { name: 'Guarantee Status Update', fn: testGuaranteeStatusUpdate },
    { name: 'Guarantee Statistics', fn: testGuaranteeStats },
    { name: 'Delivery Performance', fn: testDeliveryPerformance },
    { name: 'Performance Metrics', fn: testPerformanceMetrics }
  ];

  const results = [];

  for (const test of tests) {
    try {
      const success = await test.fn();
      results.push({ name: test.name, success });

      // Add delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.log(`❌ ${test.name} failed with error:`, error.message);
      results.push({ name: test.name, success: false });
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.success).length;
  const failed = results.length - passed;

  console.log(`\n✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.name}`);
    });
  }

  console.log('\n🎯 Test Data Used:');
  console.log(`   - User Address: ${testData.userAddress}`);
  console.log(`   - Mail ID: ${testData.mailId}`);
  console.log(`   - Tracking Number: ${testData.trackingNumber}`);
  console.log(`   - Guarantee ID: ${testData.guaranteeId}`);
  if (testData.proofHash) {
    console.log(`   - Proof Hash: ${testData.proofHash}`);
  }

  console.log('\n🏁 Testing completed!');

  return { passed, failed, total: results.length };
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = {
  runAllTests,
  testData,
  makeRequest
};