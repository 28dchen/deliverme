const API_BASE_URL = 'http://localhost:3001'

// Default timeout for API requests
const API_TIMEOUT = 60000

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

  // Get all registered workers
  getAllWorkers: async () => {
    return await fetchWithTimeout(`${API_BASE_URL}/api/delivery-tracking/workers`)
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

// Admin Management API
export const adminAPI = {
  // Get all valid delivery addresses
  getValidAddresses: async () => {
    return await fetchWithTimeout(`${API_BASE_URL}/api/admin/valid-addresses`)
  },

  // Add valid delivery address
  addValidAddress: async (address) => {
    return await fetchWithTimeout(`${API_BASE_URL}/api/admin/valid-addresses`, {
      method: 'POST',
      body: JSON.stringify({ address })
    })
  },

  // Remove valid delivery address
  removeValidAddress: async (address) => {
    return await fetchWithTimeout(`${API_BASE_URL}/api/admin/valid-addresses/${address}`, {
      method: 'DELETE'
    })
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

  // Get mails for recipient
  getRecipientMails: async (recipientAddress) => {
    return await fetchWithTimeout(`${API_BASE_URL}/api/mail/recipient/${recipientAddress}`)
  },

  // Get tracking history by tracking number
  getTrackingHistory: async (trackingNumber) => {
    return await fetchWithTimeout(`${API_BASE_URL}/api/mail/tracking/${trackingNumber}`)
  },

  // Search mail by tracking number
  searchByTrackingNumber: async (trackingNumber) => {
    return await fetchWithTimeout(`${API_BASE_URL}/api/mail/search/${trackingNumber}`)
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

  // Get packages assigned to a specific delivery worker
  getAssignedPackages: async (workerAddress) => {
    return await fetchWithTimeout(`${API_BASE_URL}/api/delivery-tracking/assigned/${workerAddress}`)
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
  const timestamp = Date.now().toString().slice(-10)
  return `TN${timestamp}`
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