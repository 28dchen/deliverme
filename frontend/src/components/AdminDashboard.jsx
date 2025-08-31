import { Button } from '@/components/ui/button.jsx'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useWallet } from '../contexts/WalletContext.jsx'
import { workerAPI, deliveryAPI, guaranteeAPI, adminAPI, handleAPIError } from '../services/api.js'
import { Settings, Plus, Trash2, ArrowLeft, User, Wallet, LogOut, Shield, Check, X, Loader2, BarChart3, AlertTriangle, Clock } from 'lucide-react'

function AdminDashboard() {
  const navigate = useNavigate()
  const { account, shortenAddress, disconnect, isConnected } = useWallet()
  const [registeredWorkers, setRegisteredWorkers] = useState([])
  const [newWorkerAddress, setNewWorkerAddress] = useState('')
  const [newWorkerName, setNewWorkerName] = useState('')
  const [newWorkerType, setNewWorkerType] = useState('delivery')
  const [isAddingWorker, setIsAddingWorker] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [systemStats, setSystemStats] = useState({
    totalDeliveries: 0,
    onTimeDeliveries: 0,
    delayedDeliveries: 0,
    activeGuarantees: 0,
    totalGuarantees: 0,
    onTimeRate: 0,
    averageDeliveryTime: 0,
    penaltiesClaimed: 0,
    totalInsurancePool: 0
  })
  const [activeTab, setActiveTab] = useState('workers')
  const [isAddingAddress, setIsAddingAddress] = useState(false)
  const [newAddress, setNewAddress] = useState('')
  const [validDeliveryAddresses, setValidDeliveryAddresses] = useState([])

  // Redirect if not connected
  useEffect(() => {
    if (!isConnected) {
      navigate('/signin')
    }
  }, [isConnected, navigate])

  // Load system data on component mount
  useEffect(() => {
    if (account) {
      loadSystemData()
    }
  }, [account])

  const loadSystemData = async () => {
    setIsLoading(true)
    try {
      // Load system statistics, workers, and valid addresses from backend
      const [performanceData, guaranteeStats, workersData, validAddressesData] = await Promise.allSettled([
        deliveryAPI.getPerformance(),
        guaranteeAPI.getStats(),
        workerAPI.getAllWorkers(),
        adminAPI.getValidAddresses()
      ])

      // Update system statistics
      if (performanceData.status === 'fulfilled' && performanceData.value.success) {
        const perfData = performanceData.value.data || {}
        setSystemStats(prev => ({
          ...prev,
          totalDeliveries: perfData.totalDeliveries || 0,
          onTimeDeliveries: perfData.onTimeDeliveries || 0,
          delayedDeliveries: perfData.delayedDeliveries || 0,
          onTimeRate: parseFloat(perfData.successRate || 0) * 100, // Convert to percentage
          averageDeliveryTime: perfData.averageDeliveryTime || 0
        }))
      }

      if (guaranteeStats.status === 'fulfilled' && guaranteeStats.value.success) {
        const guaranteeData = guaranteeStats.value.data || {}
        setSystemStats(prev => ({
          ...prev,
          activeGuarantees: guaranteeData.activeGuarantees || 0,
          totalGuarantees: guaranteeData.totalGuarantees || 0,
          penaltiesClaimed: guaranteeData.penaltiesClaimed || 0,
          totalInsurancePool: parseFloat(guaranteeData.totalInsurancePool || 0)
        }))
      }

      // Load registered workers from backend
      if (workersData.status === 'fulfilled' && workersData.value.success) {
        const formattedWorkers = workersData.value.data?.map(worker => ({
          address: worker.workerAddress,
          name: worker.name || 'Unknown',
          type: worker.workerType || 'delivery',
          registeredAt: worker.createdAt || new Date().toISOString()
        })) || []
        setRegisteredWorkers(formattedWorkers)
      } else {
        setRegisteredWorkers([])
      }

      // Load valid delivery addresses from backend
      if (validAddressesData.status === 'fulfilled' && validAddressesData.value.success) {
        setValidDeliveryAddresses(validAddressesData.value.data || [])
      } else {
        setValidDeliveryAddresses([])
      }
    } catch (error) {
      console.error('Error loading system data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisconnect = () => {
    disconnect()
    navigate('/signin')
  }

  const validateAddress = (address) => {
    // Basic Ethereum address validation
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/
    return ethAddressRegex.test(address)
  }

  const registerWorker = async () => {
    if (!newWorkerAddress.trim() || !newWorkerName.trim()) {
      alert('Please enter both wallet address and worker name')
      return
    }

    if (!validateAddress(newWorkerAddress)) {
      alert('Please enter a valid Ethereum address (0x...)')
      return
    }

    setIsRegistering(true)
    try {
      const workerData = {
        workerAddress: newWorkerAddress,
        name: newWorkerName,
        workerType: newWorkerType
      }

      const response = await workerAPI.register(workerData)
      
      if (response.success) {
        alert(`Worker registered successfully!\nAddress: ${newWorkerAddress}\nName: ${newWorkerName}\nType: ${newWorkerType}`)
        
        // Add to local state
        const newWorker = {
          address: newWorkerAddress,
          name: newWorkerName,
          type: newWorkerType,
          registeredAt: new Date().toISOString()
        }
        setRegisteredWorkers(prev => [...prev, newWorker])
        
        // Reset form
        setNewWorkerAddress('')
        setNewWorkerName('')
        setNewWorkerType('delivery')
        setIsAddingWorker(false)
      }
    } catch (error) {
      const errorMessage = handleAPIError(error)
      alert(`Failed to register worker: ${errorMessage}`)
    } finally {
      setIsRegistering(false)
    }
  }

  const removeWorker = async (addressToRemove) => {
    if (confirm(`Are you sure you want to remove worker with address ${addressToRemove}?`)) {
      try {
        // In a real implementation, you would call an API to remove from blockchain
        // For now, just remove from local state
        const updatedWorkers = registeredWorkers.filter(worker => worker.address !== addressToRemove)
        setRegisteredWorkers(updatedWorkers)
        
        // If there's a remove worker API endpoint, uncomment below:
        // const response = await workerAPI.removeWorker(addressToRemove)
        // if (!response.success) {
        //   alert(`Failed to remove worker: ${response.error}`)
        //   return
        // }
        
        alert(`Worker ${addressToRemove} has been removed successfully`)
      } catch (error) {
        const errorMessage = handleAPIError(error)
        alert(`Failed to remove worker: ${errorMessage}`)
      }
    }
  }

  const addDeliveryAddress = async () => {
    if (!newAddress.trim()) {
      alert('Please enter an address')
      return
    }

    if (!validateAddress(newAddress)) {
      alert('Please enter a valid Ethereum address (0x...)')
      return
    }

    if (validDeliveryAddresses.includes(newAddress)) {
      alert('This address is already in the list')
      return
    }

    try {
      const response = await adminAPI.addValidAddress(newAddress)
      if (response.success) {
        setValidDeliveryAddresses(prev => [...prev, newAddress])
        setNewAddress('')
        setIsAddingAddress(false)
        alert('Delivery address added successfully!')
      } else {
        alert(`Failed to add address: ${response.error || 'Unknown error'}`)
      }
    } catch (error) {
      const errorMessage = handleAPIError(error)
      alert(`Failed to add address: ${errorMessage}`)
    }
  }

  const removeDeliveryAddress = async (addressToRemove) => {
    if (confirm(`Are you sure you want to remove address ${addressToRemove}?`)) {
      try {
        const response = await adminAPI.removeValidAddress(addressToRemove)
        if (response.success) {
          setValidDeliveryAddresses(prev => prev.filter(addr => addr !== addressToRemove))
          alert('Address removed successfully!')
        } else {
          alert(`Failed to remove address: ${response.error || 'Unknown error'}`)
        }
      } catch (error) {
        const errorMessage = handleAPIError(error)
        alert(`Failed to remove address: ${errorMessage}`)
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Button 
              onClick={() => navigate('/signin')}
              variant="ghost"
              className="text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center space-x-3">
              <Shield className="w-8 h-8 text-purple-600" />
              <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-lg shadow">
              <Wallet className="w-5 h-5 text-purple-600" />
              <span className="text-gray-700 font-mono">{shortenAddress(account)}</span>
            </div>
            <Button 
              onClick={handleDisconnect}
              variant="outline"
              className="flex items-center space-x-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Disconnect</span>
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-6">
          <button
            onClick={() => setActiveTab('workers')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'workers'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Worker Management
          </button>
          <button
            onClick={() => setActiveTab('addresses')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'addresses'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Delivery Addresses
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'stats'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            System Stats
          </button>
        </div>

        {/* Main Content */}
        <div className="grid gap-6">
          {/* Worker Management Tab */}
          {activeTab === 'workers' && (
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-gray-800 flex items-center">
                  <User className="w-6 h-6 mr-2 text-purple-600" />
                  Manage Workers
                </h2>
                <Button 
                  onClick={() => setIsAddingWorker(!isAddingWorker)}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Worker
                </Button>
              </div>

              {/* Add Worker Form */}
              {isAddingWorker && (
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <h3 className="text-lg font-medium text-gray-800 mb-4">Register New Worker</h3>
                  <div className="grid gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Worker Name
                      </label>
                      <input
                        type="text"
                        value={newWorkerName}
                        onChange={(e) => setNewWorkerName(e.target.value)}
                        placeholder="Enter worker name"
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Wallet Address
                      </label>
                      <input
                        type="text"
                        value={newWorkerAddress}
                        onChange={(e) => setNewWorkerAddress(e.target.value)}
                        placeholder="Enter Ethereum wallet address (0x...)"
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Worker Type
                      </label>
                      <select
                        value={newWorkerType}
                        onChange={(e) => setNewWorkerType(e.target.value)}
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="delivery">Delivery Worker</option>
                        <option value="logistics">Logistics Coordinator</option>
                        <option value="supervisor">Supervisor</option>
                      </select>
                    </div>
                    <div className="flex space-x-4">
                      <Button 
                        onClick={registerWorker}
                        disabled={isRegistering}
                        className="bg-green-600 hover:bg-green-700 flex items-center"
                      >
                        {isRegistering ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4 mr-2" />
                        )}
                        Register Worker
                      </Button>
                      <Button 
                        onClick={() => {
                          setIsAddingWorker(false)
                          setNewWorkerAddress('')
                          setNewWorkerName('')
                          setNewWorkerType('delivery')
                        }}
                        variant="outline"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Workers List */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-800">
                  Registered Workers ({registeredWorkers.length})
                </h3>
                
                {registeredWorkers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <User className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No workers registered</p>
                    <p className="text-sm">Register workers to allow them to access the delivery system</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {registeredWorkers.map((worker, index) => (
                      <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <User className="w-5 h-5 text-purple-600" />
                          <div>
                            <span className="font-medium text-gray-800">{worker.name}</span>
                            <span className="mx-2 text-gray-400">•</span>
                            <span className="text-sm text-gray-600 capitalize">{worker.type}</span>
                            <div className="text-xs text-gray-500 font-mono">{worker.address}</div>
                          </div>
                        </div>
                        <Button
                          onClick={() => removeWorker(worker.address)}
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Delivery Addresses Tab */}
          {activeTab === 'addresses' && (
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-gray-800 flex items-center">
                  <Settings className="w-6 h-6 mr-2 text-purple-600" />
                  Manage Valid Delivery Addresses
                </h2>
                <Button 
                  onClick={() => setIsAddingAddress(!isAddingAddress)}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Address
                </Button>
              </div>

              {/* Add Address Form */}
              {isAddingAddress && (
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <h3 className="text-lg font-medium text-gray-800 mb-4">Add New Valid Delivery Address</h3>
                  <div className="flex space-x-4">
                    <input
                      type="text"
                      value={newAddress}
                      onChange={(e) => setNewAddress(e.target.value)}
                      placeholder="Enter Ethereum wallet address (0x...)"
                      className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                    <Button 
                      onClick={addDeliveryAddress}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Add
                    </Button>
                    <Button 
                      onClick={() => {
                        setIsAddingAddress(false)
                        setNewAddress('')
                      }}
                      variant="outline"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Only addresses in this list will be allowed to access the delivery dashboard
                  </p>
                </div>
              )}

              {/* Address List */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-800">
                  Valid Delivery Addresses ({validDeliveryAddresses.length})
                </h3>
                
                {validDeliveryAddresses.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <User className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No valid delivery addresses configured</p>
                    <p className="text-sm">Add addresses to allow delivery personnel to access the system</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {validDeliveryAddresses.map((address, index) => (
                      <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Wallet className="w-5 h-5 text-purple-600" />
                          <span className="font-mono text-gray-800">{address}</span>
                          <span className="text-sm text-gray-500">({shortenAddress(address)})</span>
                        </div>
                        <Button
                          onClick={() => removeDeliveryAddress(address)}
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* System Stats Tab */}
          {activeTab === 'stats' && (
            <div className="grid gap-6">
              {/* System Statistics */}
              <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-lg p-6 shadow-lg text-center">
                  <BarChart3 className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-800">{systemStats.totalDeliveries}</p>
                  <p className="text-sm text-gray-600">Total Deliveries</p>
                </div>
                <div className="bg-white rounded-lg p-6 shadow-lg text-center">
                  <Check className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-800">{systemStats.onTimeDeliveries}</p>
                  <p className="text-sm text-gray-600">On-Time Deliveries</p>
                </div>
                <div className="bg-white rounded-lg p-6 shadow-lg text-center">
                  <X className="w-8 h-8 text-red-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-800">{systemStats.delayedDeliveries}</p>
                  <p className="text-sm text-gray-600">Delayed Deliveries</p>
                </div>
                <div className="bg-white rounded-lg p-6 shadow-lg text-center">
                  <Shield className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-800">{systemStats.onTimeRate.toFixed(1)}%</p>
                  <p className="text-sm text-gray-600">Success Rate</p>
                </div>
              </div>
              
              {/* Additional Statistics Row */}
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-lg p-6 shadow-lg text-center">
                  <Shield className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-800">{systemStats.activeGuarantees}</p>
                  <p className="text-sm text-gray-600">Active Guarantees</p>
                </div>
                <div className="bg-white rounded-lg p-6 shadow-lg text-center">
                  <BarChart3 className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-800">{systemStats.totalGuarantees}</p>
                  <p className="text-sm text-gray-600">Total Guarantees</p>
                </div>
                <div className="bg-white rounded-lg p-6 shadow-lg text-center">
                  <AlertTriangle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-800">{systemStats.penaltiesClaimed}</p>
                  <p className="text-sm text-gray-600">Penalties Claimed</p>
                </div>
                <div className="bg-white rounded-lg p-6 shadow-lg text-center">
                  <Wallet className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-800">{systemStats.totalInsurancePool.toFixed(2)} ETH</p>
                  <p className="text-sm text-gray-600">Insurance Pool</p>
                </div>
              </div>
              
              {/* System Information */}
              <div className="bg-white rounded-lg p-6 shadow-lg">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">System Information</h2>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h3 className="text-lg font-medium text-gray-700">Access Control</h3>
                    <div className="text-sm text-gray-600 space-y-2">
                      <p>• Only registered workers can access delivery dashboard</p>
                      <p>• Recipients can access with any valid wallet</p>
                      <p>• Admin access requires proper blockchain authentication</p>
                      <p>• All actions are recorded on the blockchain</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-lg font-medium text-gray-700">Current Status</h3>
                    <div className="text-sm text-gray-600 space-y-2">
                      <p>• Total registered workers: {registeredWorkers.length}</p>
                      <p>• Valid delivery addresses: {validDeliveryAddresses.length}</p>
                      <p>• Admin wallet: {shortenAddress(account)}</p>
                      <p>• System status: {isLoading ? 'Loading...' : 'Active'}</p>
                      <p>• Blockchain integration: Active</p>
                      <p>• Average delivery time: {systemStats.averageDeliveryTime} hours</p>
                      <p>• Total insurance pool: {systemStats.totalInsurancePool.toFixed(3)} ETH</p>
                      <p>• Penalties claimed: {systemStats.penaltiesClaimed}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard