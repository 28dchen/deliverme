const API_BASE_URL = 'http://localhost:3001'

// Default timeout for API requests (increased for blockchain transactions)
const API_TIMEOUT = 120000

// Create a custom fetch function with timeout and common settings
const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT)
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error('Request timeout')
    }
    throw error
  }
}

// System Health API
export const healthAPI = {
  // Check service health
  checkHealth: async () => {
    return await fetchWithTimeout(`${API_BASE_URL}/health`)
  },

  // Check blockchain status
  checkBlockchainStatus: async () => {
    return await fetchWithTimeout(`${API_BASE_URL}/blockchain/status`)
  }
}

// User Management API
export const userAPI = {
  // Register new user
  register: async (userData) => {
    return await fetchWithTimeout(`${API_BASE_URL}/api/user/register`, {
      method: 'POST',
      body: JSON.stringify(userData)
    })
  },

  // Authenticate user with password and userAddress
  authenticate: async (password, userAddress) => {
    return await fetchWithTimeout(`${API_BASE_URL}/api/user/authenticate`, {
      method: 'POST',
      body: JSON.stringify({ password, userAddress })
    })
  },

  // Get user information
  getUser: async (userAddress) => {
    return await fetchWithTimeout(`${API_BASE_URL}/api/user/${userAddress}`)
  }
}

// Worker Management API
export const workerAPI = {
  // Register new worker
  register: async (workerData) => {
    return await fetchWithTimeout(`${API_BASE_URL}/api/delivery-tracking/register-worker`, {
      method: 'POST',
      body: JSON.stringify(workerData)
    })
  },

  // Get worker information
  getWorker: async (workerAddress) => {
    return await fetchWithTimeout(`${API_BASE_URL}/api/delivery-tracking/worker/${workerAddress}`)
  },

  // Get all registered workers (Mock implementation - backend route doesn't exist)
  getAllWorkers: async () => {
    // Mock implementation since backend doesn't have this endpoint
    return {
      success: true,
      data: [
        {
          workerAddress: "0x2Cb2E88CBE054982833A4A08658e1341Ca04b8dC",
          name: "John Doe",
          workerType: "delivery_worker",
          isActive: true
        },
        {
          workerAddress: "0x3Db3F88CBE054982833A4A08658e1341Ca04b8eF",
          name: "Jane Smith", 
          workerType: "delivery_worker",
          isActive: true
        }
      ]
    }
  },

  // Check if worker exists and is valid
  validateWorker: async (workerAddress) => {
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/api/delivery-tracking/worker/${workerAddress}`)
      return response.success
    } catch (error) {
      return false
    }
  }
}

// Admin Management API (Mock implementation - backend routes don't exist)
export const adminAPI = {
  // Get all valid delivery addresses (Mock)
  getValidAddresses: async () => {
    // Mock implementation since backend doesn't have admin routes
    return {
      success: true,
      data: [
        "0x1234567890123456789012345678901234567890",
        "0x2345678901234567890123456789012345678901",
        "0x3456789012345678901234567890123456789012"
      ]
    }
  },

  // Add valid delivery address (Mock)
  addValidAddress: async (address) => {
    // Mock implementation since backend doesn't have admin routes
    return {
      success: true,
      message: "Address added successfully (mock)",
      data: { address }
    }
  },

  // Remove valid delivery address (Mock)
  removeValidAddress: async (address) => {
    // Mock implementation since backend doesn't have admin routes
    return {
      success: true,
      message: "Address removed successfully (mock)",
      data: { address }
    }
  }
}

// Mail Management API
export const mailAPI = {
  // Register new mail
  register: async (mailData) => {
    return await fetchWithTimeout(`${API_BASE_URL}/api/mail/register`, {
      method: 'POST',
      body: JSON.stringify(mailData)
    })
  },

  // Get mail details
  getDetails: async (mailId) => {
    return await fetchWithTimeout(`${API_BASE_URL}/api/mail/${mailId}/details`)
  },

  // Get mails for recipient (Mock implementation - would need proper backend implementation)
  getRecipientMails: async (recipientAddress) => {
    // Mock implementation since backend doesn't have a specific endpoint for recipient mails
    // In reality, this would require filtering mails by recipient from a mail listing endpoint
    return {
      success: true,
      data: {
        recipientAddress,
        mails: [
          {
            mailId: "MAIL_001",
            trackingNumber: "TN123456789",
            senderAddress: "0x1234567890123456789012345678901234567890",
            status: "in_transit",
            registrationTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            estimatedDelivery: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          },
          {
            mailId: "MAIL_002", 
            trackingNumber: "TN987654321",
            senderAddress: "0x2345678901234567890123456789012345678901",
            status: "delivered",
            registrationTime: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
            deliveredAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
          }
        ]
      }
    }
  },

  // Get tracking history by tracking number
  getTrackingHistory: async (mailID) => {
    return await fetchWithTimeout(`${API_BASE_URL}/api/delivery-tracking/delivery-history/${mailID}`)
  },

  // Search mail by tracking number
  searchByTrackingNumber: async (mailID) => {
    return await fetchWithTimeout(`${API_BASE_URL}/api/mail/${mailID}/details`)
  }
}

// Delivery Tracking API
export const deliveryAPI = {
  // Update delivery status
  updateStatus: async (statusData) => {
    return await fetchWithTimeout(`${API_BASE_URL}/api/delivery-tracking/update-status`, {
      method: 'POST',
      body: JSON.stringify(statusData)
    })
  },

  // Get delivery history
  getHistory: async (mailId) => {
    return await fetchWithTimeout(`${API_BASE_URL}/api/delivery-tracking/delivery-history/${mailId}`)
  },

  // Get performance metrics
  getPerformance: async () => {
    return await fetchWithTimeout(`${API_BASE_URL}/api/delivery-tracking/performance`)
  },

  // Get metrics
  getMetrics: async () => {
    return await fetchWithTimeout(`${API_BASE_URL}/api/delivery-tracking/metrics`)
  },

  // Get packages assigned to a specific delivery worker (Mock implementation - backend route doesn't exist)
  getAssignedPackages: async (workerAddress) => {
    // Mock implementation since backend doesn't have this endpoint
    return {
      success: true,
      data: {
        workerAddress,
        assignedPackages: [
          {
            mailId: "MAIL_WORKER_001",
            trackingNumber: "TN456789123",
            status: "collected",
            priority: "high",
            assignedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
            estimatedDelivery: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
            deliveryAddress: "123 Main St, City"
          },
          {
            mailId: "MAIL_WORKER_002",
            trackingNumber: "TN789123456", 
            status: "in_transit",
            priority: "normal",
            assignedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
            estimatedDelivery: new Date(Date.now() + 16 * 60 * 60 * 1000).toISOString(),
            deliveryAddress: "456 Oak Ave, Town"
          }
        ],
        totalAssigned: 2,
        completedToday: 3
      }
    }
  }
}

// Time Proof API
export const proofAPI = {
  // Generate time proof
  generateProof: async (proofData) => {
    return await fetchWithTimeout(`${API_BASE_URL}/api/proof/generate-time-proof`, {
      method: 'POST',
      body: JSON.stringify(proofData)
    })
  },

  // Verify time proof
  verifyProof: async (proofHash) => {
    return await fetchWithTimeout(`${API_BASE_URL}/api/proof/verify/${proofHash}`)
  }
}

// Guarantee API
export const guaranteeAPI = {
  // Create delivery guarantee
  create: async (guaranteeData) => {
    return await fetchWithTimeout(`${API_BASE_URL}/api/guarantee/create`, {
      method: 'POST',
      body: JSON.stringify(guaranteeData)
    })
  },

  // Get guarantee details
  getDetails: async (guaranteeId) => {
    return await fetchWithTimeout(`${API_BASE_URL}/api/guarantee/${guaranteeId}`)
  },

  // Update guarantee status
  updateStatus: async (guaranteeId, statusData) => {
    return await fetchWithTimeout(`${API_BASE_URL}/api/guarantee/${guaranteeId}/status`, {
      method: 'PUT',
      body: JSON.stringify(statusData)
    })
  },

  // Get guarantee statistics
  getStats: async () => {
    return await fetchWithTimeout(`${API_BASE_URL}/api/guarantee/stats`)
  },

  // Get guarantees for a specific mail
  getMailGuarantees: async (mailId) => {
    return await fetchWithTimeout(`${API_BASE_URL}/api/guarantee/mail/${mailId}`)
  }
}

// Helper function to generate unique mail ID
export const generateMailId = () => {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substr(2, 8).toUpperCase()
  return `MAIL_${timestamp}_${random}`
}

// Helper function to generate tracking number
export const generateTrackingNumber = () => {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substr(2, 6).toUpperCase()
  return `TN${timestamp}_${random}`
}

// Helper function to handle API errors with user-friendly messages
export const handleAPIError = (error) => {
  console.error('API Error:', error)
  
  if (error.message === 'Request timeout') {
    return 'Request timed out. Please try again.'
  }
  
  if (error.message.includes('fetch')) {
    return 'Network error. Please check your internet connection and try again.'
  }
  
  return error.message || 'An unexpected error occurred. Please try again.'
}