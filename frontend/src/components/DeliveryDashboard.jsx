import { Button } from '@/components/ui/button.jsx'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useWallet } from '../contexts/WalletContext.jsx'
import { mailAPI, deliveryAPI, workerAPI, guaranteeAPI, generateMailId, generateTrackingNumber, handleAPIError } from '../services/api.js'
import { Truck, Plus, Edit, ArrowLeft, Package, MapPin, Clock, User, Wallet, LogOut, AlertTriangle, Shield, Loader2, CheckCircle } from 'lucide-react'

function DeliveryDashboard() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  const { account, shortenAddress, disconnect, isConnected } = useWallet()
  const [isValidDeliveryAddress, setIsValidDeliveryAddress] = useState(false)
  const [isCheckingAddress, setIsCheckingAddress] = useState(true)
  
  // Form state for create express order
  const [recipientWallet, setRecipientWallet] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [itemType, setItemType] = useState('package')
  const [weight, setWeight] = useState('')
  const [walletError, setWalletError] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  
  // Guarantee-related state
  const [enableGuarantee, setEnableGuarantee] = useState(false)
  const [penaltyAmount, setPenaltyAmount] = useState('')
  const [insuranceAmount, setInsuranceAmount] = useState('')
  const [guaranteeHours, setGuaranteeHours] = useState('48')
  
  // Update status form state
  const [selectedPackageId, setSelectedPackageId] = useState('')
  const [newStatus, setNewStatus] = useState('collected')
  const [currentLocation, setCurrentLocation] = useState('')
  const [statusNotes, setStatusNotes] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  
  // Package list state
  const [packages, setPackages] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  // Check if current address is valid for delivery access
  useEffect(() => {
    if (account) {
      validateDeliveryAccess()
    }
  }, [account, navigate])

  const validateDeliveryAccess = async () => {
    setIsCheckingAddress(true)
    try {
      // Check if the worker is registered and valid
      const isValid = await workerAPI.validateWorker(account)
      if (isValid) {
        setIsValidDeliveryAddress(true)
        loadRecentPackages()
      } else {
        setIsValidDeliveryAddress(false)
        setTimeout(() => {
          navigate('/signin')
        }, 3000)
      }
    } catch (error) {
      console.error('Error validating delivery access:', error)
      setIsValidDeliveryAddress(false)
      setTimeout(() => {
        navigate('/signin')
      }, 3000)
    } finally {
      setIsCheckingAddress(false)
    }
  }

  // Redirect if not connected
  useEffect(() => {
    if (!isConnected) {
      navigate('/signin')
    }
  }, [isConnected, navigate])

  const handleDisconnect = () => {
    disconnect()
    navigate('/signin')
  }

  // Validate Ethereum wallet address
  const validateWalletAddress = (address) => {
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/
    return ethAddressRegex.test(address)
  }

  // Handle recipient wallet input change
  const handleRecipientWalletChange = (e) => {
    const value = e.target.value
    setRecipientWallet(value)
    
    if (value.trim() === '') {
      setWalletError('')
    } else if (!validateWalletAddress(value)) {
      setWalletError('Please enter a valid Ethereum address (0x followed by 40 hexadecimal characters)')
    } else {
      setWalletError('')
    }
  }

  // Load recent packages from backend
  const loadRecentPackages = async () => {
    setIsLoading(true)
    try {
      // Get packages assigned to this delivery worker
      const response = await deliveryAPI.getAssignedPackages(account)
      if (response.success && response.data) {
        const formattedPackages = response.data.map(pkg => ({
          id: pkg.trackingNumber || pkg.mailId,
          recipient: pkg.metadata?.recipientName || 'Unknown',
          address: pkg.metadata?.deliveryAddress || 'Unknown',
          status: pkg.status || 'Unknown',
          createTime: pkg.createdAt ? new Date(pkg.createdAt).toLocaleString() : 'Unknown',
          updateTime: pkg.updatedAt ? new Date(pkg.updatedAt).toLocaleString() : 'Unknown'
        }))
        setPackages(formattedPackages)
      } else {
        setPackages([])
      }
    } catch (error) {
      console.error('Error loading packages:', error)
      setPackages([])
    } finally {
      setIsLoading(false)
    }
  }

  // Handle form submission
  const handleCreateExpressSubmit = async (e) => {
    e.preventDefault()
    
    if (!recipientWallet || walletError || !recipientName.trim() || !deliveryAddress.trim()) {
      alert('Please fill in all required fields with valid information')
      return
    }

    // Validate guarantee fields if enabled
    if (enableGuarantee) {
      if (!penaltyAmount || !insuranceAmount) {
        alert('Please fill in penalty amount and insurance amount for guarantee')
        return
      }
      if (parseFloat(insuranceAmount) < parseFloat(penaltyAmount)) {
        alert('Insurance amount must be greater than or equal to penalty amount')
        return
      }
    }

    setIsCreating(true)
    try {
      const mailId = generateMailId()
      const trackingNumber = generateTrackingNumber()
      
      // Calculate guaranteed delivery time
      const guaranteedHours = enableGuarantee ? parseInt(guaranteeHours) : 48
      const guaranteedDeliveryTime = Math.floor(Date.now() / 1000) + (guaranteedHours * 60 * 60)
      
      const mailData = {
        mailId,
        trackingNumber,
        senderAddress: account, // Current delivery worker's address
        recipientId: recipientWallet,
        mailType: itemType,
        guaranteedDeliveryTime,
        requiresTimeProof: true,
        metadata: {
          weight: weight ? `${weight}kg` : '1.0kg',
          size: 'Medium',
          priority: 1,
          insurance: enableGuarantee ? insuranceAmount : '0.01',
          requiresSignature: true,
          recipientName,
          recipientPhone,
          deliveryAddress,
          hasGuarantee: enableGuarantee
        }
      }
      
      const response = await mailAPI.register(mailData)
      
      if (response.success) {
        let successMessage = `Express order created successfully!\nTracking Number: ${trackingNumber}\nMail ID: ${mailId}`
        
        // Create delivery guarantee if enabled
        if (enableGuarantee) {
          try {
            const guaranteeId = `GUARANTEE_${Date.now()}_${Math.random().toString(36).substr(2, 8).toUpperCase()}`
            const guaranteeData = {
              guaranteeId,
              mailId,
              penaltyAmount,
              insurance: insuranceAmount,
              guaranteedDeliveryTime,
              escalationContacts: [recipientWallet],
              requiresProofOfTime: true
            }
            
            const guaranteeResponse = await guaranteeAPI.create(guaranteeData)
            
            if (guaranteeResponse.success) {
              successMessage += `\n\n🛡️ Delivery Guarantee Created:\n• Guarantee ID: ${guaranteeId}\n• Penalty: ${penaltyAmount} ETH\n• Insurance: ${insuranceAmount} ETH\n• Delivery Time: ${guaranteedHours} hours`
            } else {
              successMessage += `\n\n⚠️ Mail created but guarantee failed: ${guaranteeResponse.error}`
            }
          } catch (guaranteeError) {
            console.error('Guarantee creation error:', guaranteeError)
            successMessage += `\n\n⚠️ Mail created but guarantee failed: ${handleAPIError(guaranteeError)}`
          }
        }
        
        alert(successMessage)
        
        // Add new package to the local state
        const newPackage = {
          id: trackingNumber,
          recipient: recipientName,
          address: deliveryAddress,
          status: 'Registered',
          createTime: new Date().toLocaleString(),
          updateTime: new Date().toLocaleString(),
          hasGuarantee: enableGuarantee
        }
        setPackages(prev => [newPackage, ...prev])
        
        // Reset form
        resetCreateForm()
        setActiveTab('overview')
      }
    } catch (error) {
      const errorMessage = handleAPIError(error)
      alert(`Failed to create express order: ${errorMessage}`)
    } finally {
      setIsCreating(false)
    }
  }
  
  // Reset create form
  const resetCreateForm = () => {
    setRecipientWallet('')
    setRecipientName('')
    setRecipientPhone('')
    setDeliveryAddress('')
    setItemType('package')
    setWeight('')
    setWalletError('')
    setEnableGuarantee(false)
    setPenaltyAmount('')
    setInsuranceAmount('')
    setGuaranteeHours('48')
  }

  // Handle update status submission
  const handleUpdateStatusSubmit = async () => {
    if (!selectedPackageId || !newStatus || !currentLocation.trim()) {
      alert('Please fill in all required fields')
      return
    }
    
    setIsUpdating(true)
    try {
      const statusData = {
        trackingNumber: selectedPackageId,
        location: currentLocation,
        coordinates: {
          latitude: 40712800, // Default NYC coordinates - in real app, use actual GPS
          longitude: -74006000
        },
        status: newStatus,
        signature: '0x' + '1'.repeat(130), // Mock signature - would be real cryptographic signature
        timeData: {
          ntpServer: 'time.google.com',
          atomicTime: Math.floor(Date.now() / 1000),
          timezone: 'UTC'
        }
      }
      
      if (statusNotes.trim()) {
        statusData.notes = statusNotes
      }
      
      const response = await deliveryAPI.updateStatus(statusData)
      
      if (response.success) {
        alert(`Status updated successfully for ${selectedPackageId}`)
        
        // Update local package state
        setPackages(prev => prev.map(pkg => 
          pkg.id === selectedPackageId 
            ? { ...pkg, status: newStatus, updateTime: new Date().toLocaleString() }
            : pkg
        ))
        
        // Reset form
        setSelectedPackageId('')
        setNewStatus('collected')
        setCurrentLocation('')
        setStatusNotes('')
        setActiveTab('overview')
      }
    } catch (error) {
      const errorMessage = handleAPIError(error)
      alert(`Failed to update status: ${errorMessage}`)
    } finally {
      setIsUpdating(false)
    }
  }

  // Reset form when switching tabs
  const handleTabChange = (tab) => {
    if (tab !== 'create') {
      resetCreateForm()
    }
    if (tab !== 'update') {
      setSelectedPackageId('')
      setNewStatus('collected')
      setCurrentLocation('')
      setStatusNotes('')
    }
    setActiveTab(tab)
  }

  // No mock data - all data should come from backend API

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Create New Express */}
        <div className="bg-white rounded-lg p-6 shadow-lg border-2 border-dashed border-blue-300 hover:border-blue-500 transition-colors">
          <div className="text-center space-y-4">
            <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
              <Plus className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800">Create a New Express</h3>
            <p className="text-gray-600">Create new express orders and enter them into the system</p>
            <Button 
              onClick={() => handleTabChange('create')}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              Create New Express
            </Button>
          </div>
        </div>

        {/* Update Express */}
        <div className="bg-white rounded-lg p-6 shadow-lg border-2 border-dashed border-green-300 hover:border-green-500 transition-colors">
          <div className="text-center space-y-4">
            <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
              <Edit className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800">Update the Express</h3>
            <p className="text-gray-600">Update delivery status of existing express</p>
            <Button 
              onClick={() => handleTabChange('update')}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              Update Express Status
            </Button>
          </div>
        </div>
      </div>

      {/* Recent Express List */}
      <div className="bg-white rounded-lg p-6 shadow-lg">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Recently Processed Express</h3>
        {isLoading ? (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 text-blue-600 mx-auto mb-2 animate-spin" />
            <p className="text-gray-600">Loading packages...</p>
          </div>
        ) : packages.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No packages assigned to you yet</p>
            <p className="text-sm">Create new express orders or wait for assignments</p>
          </div>
        ) : (
          <div className="space-y-4">
            {packages.map((pkg) => (
              <div key={pkg.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center space-x-4">
                  <Package className="w-8 h-8 text-blue-600" />
                  <div>
                    <p className="font-medium text-gray-800">Express Number: {pkg.id}</p>
                    <p className="text-sm text-gray-600">Recipient: {pkg.recipient}</p>
                    <p className="text-xs text-gray-500">Address: {pkg.address}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    pkg.status.toLowerCase().includes('delivery') || pkg.status.toLowerCase().includes('transit') ? 'bg-blue-100 text-blue-800' : 
                    pkg.status.toLowerCase().includes('delivered') ? 'bg-green-100 text-green-800' :
                    pkg.status.toLowerCase().includes('exception') ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {pkg.status}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">{pkg.updateTime}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  const renderCreateForm = () => (
    <div className="bg-white rounded-lg p-6 shadow-lg">
      <h3 className="text-xl font-semibold text-gray-800 mb-6">Create New Express Order</h3>
      <form onSubmit={handleCreateExpressSubmit} className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recipient Name <span className="text-red-500">*</span>
            </label>
            <input 
              type="text" 
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500" 
              placeholder="Please enter recipient name"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Contact Phone</label>
            <input 
              type="tel" 
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500" 
              placeholder="Please enter contact phone"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Delivery Address <span className="text-red-500">*</span>
          </label>
          <textarea 
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500" 
            rows="3" 
            placeholder="Please enter detailed delivery address"
            required
          ></textarea>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Recipient Wallet Address <span className="text-red-500">*</span>
          </label>
          <input 
            type="text" 
            value={recipientWallet}
            onChange={handleRecipientWalletChange}
            className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
              walletError ? 'border-red-500 focus:ring-red-500' : ''
            }`}
            placeholder="0x1234567890123456789012345678901234567890" 
          />
          {walletError && (
            <p className="text-red-500 text-sm mt-1">{walletError}</p>
          )}
          <p className="text-gray-500 text-xs mt-1">
            Enter the recipient's Ethereum wallet address (42 characters starting with 0x)
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Item Type</label>
            <select 
              value={itemType}
              onChange={(e) => setItemType(e.target.value)}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="document">Document</option>
              <option value="package">Package</option>
              <option value="fragile">Fragile</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Weight (kg)</label>
            <input 
              type="number" 
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500" 
              placeholder="0.0" 
              step="0.1"
              min="0"
            />
          </div>
        </div>
        
        {/* Delivery Guarantee Section */}
        <div className="border-t pt-6 mt-6">
          <div className="flex items-center space-x-3 mb-4">
            <Shield className="w-5 h-5 text-purple-600" />
            <h4 className="text-lg font-semibold text-gray-800">Delivery Guarantee (Optional)</h4>
          </div>
          
          <div className="mb-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enableGuarantee}
                onChange={(e) => setEnableGuarantee(e.target.checked)}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-700">Enable delivery guarantee with penalty system</span>
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Guarantee on-time delivery with financial penalties for delays
            </p>
          </div>
          
          {enableGuarantee && (
            <div className="space-y-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Penalty Amount (ETH) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={penaltyAmount}
                    onChange={(e) => setPenaltyAmount(e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="0.01"
                    step="0.001"
                    min="0.001"
                    required={enableGuarantee}
                  />
                  <p className="text-xs text-gray-500 mt-1">Amount paid if delivery is late</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Insurance Amount (ETH) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={insuranceAmount}
                    onChange={(e) => setInsuranceAmount(e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="0.02"
                    step="0.001"
                    min={penaltyAmount || "0.001"}
                    required={enableGuarantee}
                  />
                  <p className="text-xs text-gray-500 mt-1">Must be ≥ penalty amount</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Guarantee Hours <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={guaranteeHours}
                    onChange={(e) => setGuaranteeHours(e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    required={enableGuarantee}
                  >
                    <option value="24">24 Hours</option>
                    <option value="48">48 Hours</option>
                    <option value="72">72 Hours</option>
                    <option value="168">1 Week</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Guaranteed delivery time</p>
                </div>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-amber-800">
                    <p className="font-medium">Guarantee Terms:</p>
                    <ul className="mt-1 space-y-1">
                      <li>• Penalty is paid automatically if delivery is late</li>
                      <li>• Insurance amount is locked during transit</li>
                      <li>• Recipient can claim penalty if guarantee fails</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex space-x-4 pt-4">
          <Button 
            type="submit" 
            className="bg-blue-600 hover:bg-blue-700"
            disabled={!recipientWallet || walletError || !recipientName.trim() || !deliveryAddress.trim() || isCreating || (enableGuarantee && (!penaltyAmount || !insuranceAmount || parseFloat(insuranceAmount) < parseFloat(penaltyAmount)))}
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating Order...
              </>
            ) : (
              'Create Express Order'
            )}
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => handleTabChange('overview')}
            disabled={isCreating}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )

  const renderUpdateForm = () => (
    <div className="bg-white rounded-lg p-6 shadow-lg">
      <h3 className="text-xl font-semibold text-gray-800 mb-6">Update Express Status</h3>
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Express Number <span className="text-red-500">*</span>
          </label>
          <select 
            value={selectedPackageId}
            onChange={(e) => setSelectedPackageId(e.target.value)}
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500"
            required
          >
            <option value="">Please select express to update</option>
            {packages.map((pkg) => (
              <option key={pkg.id} value={pkg.id}>{pkg.id} - {pkg.recipient}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Update Status <span className="text-red-500">*</span>
          </label>
          <select 
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500"
            required
          >
            <option value="collected">Collected</option>
            <option value="in_transit">In Transit</option>
            <option value="out_for_delivery">Out for Delivery</option>
            <option value="delivered">Delivered</option>
            <option value="exception">Exception</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Current Location <span className="text-red-500">*</span>
          </label>
          <input 
            type="text" 
            value={currentLocation}
            onChange={(e) => setCurrentLocation(e.target.value)}
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500" 
            placeholder="Please enter current location"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
          <textarea 
            value={statusNotes}
            onChange={(e) => setStatusNotes(e.target.value)}
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500" 
            rows="3" 
            placeholder="Please enter notes for status update"
          ></textarea>
        </div>
        <div className="flex space-x-4 pt-4">
          <Button 
            onClick={handleUpdateStatusSubmit}
            className="bg-green-600 hover:bg-green-700"
            disabled={!selectedPackageId || !newStatus || !currentLocation.trim() || isUpdating}
          >
            {isUpdating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Updating Status...
              </>
            ) : (
              'Update Status'
            )}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => handleTabChange('overview')}
            disabled={isUpdating}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )

  // Show loading while checking address
  if (isCheckingAddress) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Truck className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Verifying delivery permissions...</p>
        </div>
      </div>
    )
  }

  // Show access denied if address is not valid
  if (!isValidDeliveryAddress) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg p-8 shadow-lg text-center">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Access Denied</h1>
            <p className="text-gray-600 mb-6">
              Your wallet address is not authorized for delivery access. Please contact the administrator to add your address to the valid delivery personnel list.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-500 mb-2">Your wallet address:</p>
              <p className="font-mono text-gray-800 break-all">{account}</p>
            </div>
            <div className="space-y-3">
              <Button 
                onClick={() => navigate('/signin')}
                className="w-full bg-red-600 hover:bg-red-700"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Sign In
              </Button>
              <Button 
                onClick={handleDisconnect}
                variant="outline"
                className="w-full"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Disconnect Wallet
              </Button>
            </div>
            <p className="text-xs text-gray-400 mt-4">
              Redirecting to sign in page in 3 seconds...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
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
              <Truck className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-800">Delivery Staff Workstation</h1>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-lg shadow">
              <Wallet className="w-5 h-5 text-blue-600" />
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

        {/* Navigation Tabs */}
        <div className="flex space-x-4 mb-6">
          <Button 
            onClick={() => handleTabChange('overview')}
            variant={activeTab === 'overview' ? 'default' : 'outline'}
          >
            Work Overview
          </Button>
          <Button 
            onClick={() => handleTabChange('create')}
            variant={activeTab === 'create' ? 'default' : 'outline'}
          >
            Create Express
          </Button>
          <Button 
            onClick={() => handleTabChange('update')}
            variant={activeTab === 'update' ? 'default' : 'outline'}
          >
            Update Status
          </Button>
        </div>

        {/* Content Area */}
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'create' && renderCreateForm()}
        {activeTab === 'update' && renderUpdateForm()}
      </div>
    </div>
  )
}

export default DeliveryDashboard

