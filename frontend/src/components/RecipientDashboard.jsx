import { Button } from '@/components/ui/button.jsx'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useWallet } from '../contexts/WalletContext.jsx'
import { deliveryAPI, mailAPI, handleAPIError } from '../services/api.js'
import { User, Package, Search, ArrowLeft, MapPin, Clock, Truck, CheckCircle, AlertCircle, Wallet, LogOut, Loader2, RefreshCw } from 'lucide-react'

function RecipientDashboard() {
  const navigate = useNavigate()
  const { account, shortenAddress, disconnect, isConnected } = useWallet()

  // Load packages on mount and when account changes
  useEffect(() => {
    if (!isConnected) {
      navigate('/signin')
      return
    }
    
    if (account) {
      loadPackages()
    }
  }, [isConnected, account, navigate])

  const handleDisconnect = () => {
    disconnect()
    navigate('/signin')
  }
  
  // Package state
  const [packages, setPackages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [lastRefreshTime, setLastRefreshTime] = useState(null)
  
  // Load packages for the current user
  const loadPackages = async () => {
    setIsLoading(true)
    setError('')
    try {
      console.log('Loading packages for recipient address:', account)
      
      // Get mails for the current recipient address
      const response = await mailAPI.getRecipientMails(account)
      console.log('API Response:', response)
      
      if (response.success && response.data) {
        const { mails } = response.data
        
        // Transform backend mail data to frontend package format
        const transformedPackages = []
        
        for (const mail of mails) {
          try {
            // Get tracking history for each mail
            let trackingHistory = []
            try {
              const historyResponse = await mailAPI.getTrackingHistory(mail.trackingNumber)
              if (historyResponse.success && historyResponse.data) {
                trackingHistory = historyResponse.data.history.map(track => ({
                  time: new Date(track.timestamp).toLocaleString(),
                  location: track.location,
                  status: track.status,
                  description: getStatusDescription(track.status, track.location)
                }))
              }
            } catch (historyError) {
              console.log('Could not fetch tracking history for:', mail.trackingNumber)
              // Use basic tracking history from mail data
              trackingHistory = [
                {
                  time: new Date(mail.registrationTime).toLocaleString(),
                  location: 'Origin',
                  status: 'registered',
                  description: 'Item registered in system'
                },
                {
                  time: new Date(mail.lastUpdateTime).toLocaleString(),
                  location: mail.currentLocation || 'Processing Center',
                  status: getStatusFromCode(mail.status),
                  description: getStatusDescription(getStatusFromCode(mail.status), mail.currentLocation)
                }
              ]
            }
            
            const transformedPackage = {
              id: mail.trackingNumber,
              mailId: mail.mailId,
              sender: getSenderName(mail.senderAddress),
              status: getUIStatus(mail.status),
              currentLocation: mail.currentLocation || getLocationFromStatus(mail.status),
              estimatedDelivery: new Date(mail.guaranteedDeliveryTime).toLocaleString(),
              trackingHistory: trackingHistory
            }
            
            transformedPackages.push(transformedPackage)
            
          } catch (transformError) {
            console.error('Error transforming mail data:', transformError)
          }
        }
        
        setPackages(transformedPackages)
        setLastRefreshTime(new Date())
        console.log('Successfully loaded', transformedPackages.length, 'packages from backend')
        
      } else {
        console.log('No mails found for recipient:', account)
        setPackages([])
        setLastRefreshTime(new Date())
      }
      
    } catch (error) {
      console.error('Error loading packages:', error)
      setError(handleAPIError(error))
      setPackages([])
    } finally {
      setIsLoading(false)
    }
  }

  // Helper functions to transform backend data
  const getStatusFromCode = (statusCode) => {
    const statusMap = {
      0: 'registered',
      1: 'collected', 
      2: 'in_transit',
      3: 'out_for_delivery',
      4: 'delivered',
      5: 'exception'
    }
    return statusMap[statusCode] || 'unknown'
  }

  const getUIStatus = (statusCode) => {
    const uiStatusMap = {
      0: 'Registered',
      1: 'Collected',
      2: 'In Transit',
      3: 'Out for Delivery', 
      4: 'Delivered',
      5: 'Exception'
    }
    return uiStatusMap[statusCode] || 'Unknown'
  }

  const getLocationFromStatus = (statusCode) => {
    const locationMap = {
      0: 'Origin Post Office',
      1: 'Collection Center',
      2: 'In Transit',
      3: 'Local Delivery Center',
      4: 'Delivered',
      5: 'Exception Location'
    }
    return locationMap[statusCode] || 'Unknown Location'
  }

  const getSenderName = (senderAddress) => {
    // Map known sender addresses to friendly names
    const senderMap = {
      '0x0BBe0E741C165952307aD4901A5804704849C81c': 'JD Mall',
      '0x1234567890123456789012345678901234567890': 'Taobao Store'
    }
    return senderMap[senderAddress] || `Sender (${senderAddress.slice(0, 6)}...${senderAddress.slice(-4)})`
  }

  const getStatusDescription = (status, location) => {
    const descriptions = {
      'registered': `Item registered in system at ${location}`,
      'collected': `Package collected from ${location}`,
      'in_transit': `Package in transit through ${location}`,
      'out_for_delivery': `Out for delivery from ${location}`,
      'delivered': `Package successfully delivered to ${location}`,
      'exception': `Exception occurred at ${location}`
    }
    return descriptions[status] || `Status update from ${location}`
  }
  
  // Refresh packages
  const refreshPackages = async () => {
    setIsRefreshing(true)
    setError('')
    try {
      await loadPackages()
      // Show success message briefly
      setTimeout(() => {
        console.log('Packages refreshed successfully at:', new Date().toLocaleString())
      }, 100)
    } catch (error) {
      setError('Failed to refresh packages: ' + handleAPIError(error))
    } finally {
      setIsRefreshing(false)
    }
  }

  const [selectedPackage, setSelectedPackage] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState(null)

  // Search for package by tracking number
  const searchPackage = async () => {
    if (!searchQuery.trim()) {
      alert('Please enter a mailID to search')
      return
    }

    setIsSearching(true)
    setError('')	
    try {
      const response = await mailAPI.searchByTrackingNumber(searchQuery.trim())
      if (response.success && response.data) {
		// alert(response.body)
        setSearchResults(response.data)
        alert(`Package found! Tracking Number: ${response.data.trackingNumber}`)
      } else {
        setSearchResults(null)
        alert('Package not found with this mailID')
      }
    } catch (error) {
      console.error('Search error:', error)
      setError('Failed to search package: ' + handleAPIError(error))
      setSearchResults(null)
    } finally {
      setIsSearching(false)
    }
  }

  const clearSearch = () => {
    setSearchQuery('')
    setSearchResults(null)
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Delivered':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'In Delivery':
        return <Truck className="w-5 h-5 text-blue-600" />
      case 'In Transit':
        return <Package className="w-5 h-5 text-orange-600" />
      default:
        return <AlertCircle className="w-5 h-5 text-gray-600" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Delivered':
        return 'bg-green-100 text-green-800'
      case 'In Delivery':
        return 'bg-blue-100 text-blue-800'
      case 'In Transit':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-100 p-4">
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
              <User className="w-8 h-8 text-green-600" />
              <h1 className="text-3xl font-bold text-gray-800">Recipient Query Center</h1>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-lg shadow">
              <Wallet className="w-5 h-5 text-green-600" />
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

        {/* Wallet Address Info */}
        <div className="bg-white rounded-lg p-6 shadow-lg mb-8">
          <div className="flex items-center space-x-4">
            <div className="bg-green-100 rounded-full w-12 h-12 flex items-center justify-center">
              <User className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Current Wallet Address</h3>
              <p className="text-gray-600 font-mono text-sm">{account}</p>
              <p className="text-sm text-gray-500">System will query all your express information based on this wallet address</p>
            </div>
          </div>
        </div>

        {/* Package Search */}
        <div className="bg-white rounded-lg p-6 shadow-lg mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <Search className="w-5 h-5 mr-2 text-green-600" />
              Search Package
            </h3>
            {searchResults && (
              <Button 
                onClick={clearSearch}
                variant="outline"
                size="sm"
              >
                Clear Search
              </Button>
            )}
          </div>
          <div className="flex space-x-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter mail ID"
              className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-green-500"
              onKeyPress={(e) => e.key === 'Enter' && searchPackage()}
            />
            <Button 
              onClick={searchPackage}
              disabled={isSearching || !searchQuery.trim()}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </>
              )}
            </Button>
          </div>
          
          {searchResults && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-medium text-green-800 mb-2">Search Results</h4>
              <div className="text-sm text-green-700 space-y-1">
                <p><strong>Tracking Number:</strong> {searchResults.trackingNumber}</p>
                <p><strong>Status:</strong> {searchResults.status || 'Unknown'}</p>
                <p><strong>Current Location:</strong> {searchResults.currentLocation || 'Unknown'}</p>
                {searchResults.estimatedDelivery && (
                  <p><strong>Estimated Delivery:</strong> {new Date(searchResults.estimatedDelivery).toLocaleString()}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Express List */}
        <div className="grid gap-6">
          <div className="bg-white rounded-lg p-6 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-800">My Express ({packages.length})</h3>
                {lastRefreshTime && (
                  <p className="text-xs text-gray-500 mt-1">
                    Last updated: {lastRefreshTime.toLocaleString()}
                  </p>
                )}
              </div>
              <Button 
                variant="outline" 
                className="flex items-center space-x-2"
                onClick={refreshPackages}
                disabled={isRefreshing || isLoading}
              >
                {isRefreshing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span>{isRefreshing ? 'Refreshing...' : 'Refresh Query'}</span>
              </Button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
                <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                <span className="text-sm">{error}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setError('')}
                  className="ml-auto text-red-500 hover:text-red-700"
                >
                  ×
                </Button>
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Loading packages...</span>
              </div>
            ) : packages.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No packages found for your address</p>
                <p className="text-sm mt-2">Packages sent to your wallet address will appear here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {packages.map((pkg) => (
                <div key={pkg.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(pkg.status)}
                      <div>
                        <p className="font-medium text-gray-800">Express Number: {pkg.id}</p>
                        <p className="text-sm text-gray-600">Sender: {pkg.sender}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(pkg.status)}`}>
                        {pkg.status}
                      </span>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-600">Current Location: {pkg.currentLocation}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-600">Estimated Delivery: {pkg.estimatedDelivery}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSelectedPackage(selectedPackage === pkg.id ? null : pkg.id)}
                    >
                      {selectedPackage === pkg.id ? 'Hide Details' : 'View Details'}
                    </Button>
                  </div>

                  {/* Detailed Tracking Info */}
                  {selectedPackage === pkg.id && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="font-medium text-gray-800 mb-3">Logistics Tracking</h4>
                      <div className="space-y-3">
                        {pkg.trackingHistory.map((track, index) => (
                          <div key={index} className="flex items-start space-x-3">
                            <div className={`w-3 h-3 rounded-full mt-1 ${
                              index === 0 ? 'bg-blue-600' : 'bg-gray-300'
                            }`}></div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-gray-800">{track.status}</p>
                                <p className="text-xs text-gray-500">{track.time}</p>
                              </div>
                              <p className="text-sm text-gray-600">{track.location}</p>
                              <p className="text-xs text-gray-500">{track.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                ))}
              </div>
            )}
          </div>

          {/* Statistics */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg p-6 shadow-lg text-center">
              <Package className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-800">{packages.length}</p>
              <p className="text-sm text-gray-600">Total Express</p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-lg text-center">
              <Truck className="w-8 h-8 text-orange-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-800">
                {packages.filter(p => p.status === 'In Delivery' || p.status === 'In Transit').length}
              </p>
              <p className="text-sm text-gray-600">In Delivery</p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-lg text-center">
              <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-800">
                {packages.filter(p => p.status === 'Delivered').length}
              </p>
              <p className="text-sm text-gray-600">Delivered</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RecipientDashboard

