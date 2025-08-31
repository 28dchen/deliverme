import { useState } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { useNavigate } from 'react-router-dom'
import { useWallet } from '../contexts/WalletContext.jsx'
import { userAPI, handleAPIError } from '../services/api.js'
import { Truck, User, Wallet, ArrowLeft, Loader2, Shield, Mail, Lock, AlertCircle, LogOut } from 'lucide-react'

function SignInPage() {
  const navigate = useNavigate()
  const { connectWallet, authenticateUser, disconnect, isConnecting, account } = useWallet()
  const [currentStep, setCurrentStep] = useState('wallet') // 'wallet' or 'credentials'
  const [selectedRole, setSelectedRole] = useState('')
  const [credentials, setCredentials] = useState({ email: '', password: '' })
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [authError, setAuthError] = useState('')

  // Step 1: Connect wallet
  const handleWalletConnect = async () => {
    const result = await connectWallet()
    if (result.success) {
      setCurrentStep('credentials')
      setAuthError('')
    } else {
      setAuthError(result.error)
    }
  }

  // Step 2: Authenticate with email/password for each role
  const handleRoleAuth = async (role) => {
    if (!credentials.email || !credentials.password) {
      const errorMessage = 'Please enter both email and password'
      const failureMessage = `❌ Sign In Failed!\n\nError: ${errorMessage}\n\n• Email field is required\n• Password field is required\n• Please fill in all fields`
      
      alert(failureMessage)
      setAuthError(errorMessage)
      return
    }

    setIsAuthenticating(true)
    setAuthError('')

    try {
      // First validate credentials locally for demo purposes
      const validCredentials = {
        'test@example.com': { password: 'testPassword123', roles: ['recipient', 'delivery', 'admin'] },
        'admin@blockchain.com': { password: 'admin123', roles: ['admin'] },
        'delivery@mail.com': { password: 'delivery123', roles: ['delivery'] },
        'recipient@mail.com': { password: 'recipient123', roles: ['recipient'] }
      }

      
      /*if (!userCreds || userCreds.password !== credentials.password) {
        const errorMessage = 'Invalid email or password'
        const failureMessage = `❌ Sign In Failed!\n\nError: ${errorMessage}\n\n• Double-check your email address\n• Verify your password is correct\n• Use the test credentials provided below`
        
        alert(failureMessage)
        setAuthError(errorMessage)
        return
      }

      if (!userCreds.roles.includes(role)) {
        const errorMessage = `This account is not authorized for ${role} role`
        const failureMessage = `❌ Sign In Failed!\n\nError: ${errorMessage}\n\n• Check your account permissions\n• Try a different role\n• Contact administrator for access`
        
        alert(failureMessage)
        setAuthError(errorMessage)
        return
      }*/

      // Then authenticate with backend
      const result = await authenticateUser(credentials.email, credentials.password, role)
      
      console.log('Authentication API response:', result)
      
      if (result && result.success) {
        // Success alert with user details
        const user = result.user || {}
        const successMessage = `✅ Sign In Successful!\n\n• Welcome ${user.name || 'User'}!\n• Email: ${credentials.email}\n• Role: ${role.charAt(0).toUpperCase() + role.slice(1)}\n• Wallet: ${user.userAddress ? user.userAddress.slice(0, 6) + '...' + user.userAddress.slice(-4) : 'Connected'}\n\nRedirecting to your dashboard...`
        
        alert(successMessage)
        
        // Navigate to appropriate dashboard based on role
        if (role === 'delivery') {
          navigate('/delivery-dashboard')
        } else if (role === 'recipient') {
          navigate('/recipient-dashboard')
        } else if (role === 'admin') {
          navigate('/admin-dashboard')
        }
      } else {
        // Failure alert with detailed error
        const errorMessage = result?.error || 'Authentication failed'
        const failureMessage = `❌ Sign In Failed!\n\nError: ${errorMessage}\n\n• Please check your email and password\n• Make sure you have the correct role permissions\n• Contact support if the problem persists`
        
        alert(failureMessage)
        setAuthError(errorMessage)
      }
    } catch (error) {
      console.error('Sign in error:', error)
      const errorMessage = handleAPIError(error)
      
      // Network/system error alert
      const failureMessage = `❌ Sign In Failed!\n\nSystem Error: ${errorMessage}\n\n• Check your internet connection\n• Verify the backend server is running\n• Try again in a moment`
      
      alert(failureMessage)
      setAuthError(errorMessage)
    } finally {
      setIsAuthenticating(false)
    }
  }

  const handleCredentialsChange = (e) => {
    const { name, value } = e.target
    setCredentials(prev => ({ ...prev, [name]: value }))
    if (authError) setAuthError('')
  }

  const handleBackToWallet = () => {
    setCurrentStep('wallet')
    setCredentials({ email: '', password: '' })
    setAuthError('')
  }

  // Handle wallet disconnect
  const handleDisconnectWallet = () => {
    disconnect()
    setCurrentStep('wallet')
    setCredentials({ email: '', password: '' })
    setAuthError('')
    alert('✅ Wallet Disconnected!\n\nYou have successfully disconnected your wallet. You can connect a different wallet or return to the home page.')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex flex-col items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Header with Back Button and Sign Up Link */}
        <div className="flex justify-between items-center mb-8">
          <Button 
            onClick={() => navigate('/')}
            variant="ghost"
            className="text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
          
          {/* Sign Up Link */}
          <Button
            onClick={() => navigate('/signup')}
            variant="ghost"
            size="sm"
            className="text-xs text-gray-500 hover:text-green-600 hover:bg-green-50 px-2 py-1"
          >
            Don't have an account? Sign Up
          </Button>
        </div>

        {/* Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            {currentStep === 'wallet' ? 'Connect Wallet' : 'Sign In'}
          </h1>
          <p className="text-lg text-gray-600">
            {currentStep === 'wallet' 
              ? 'First, connect your Web3 wallet to authenticate'
              : 'Enter your registered email and password'
            }
          </p>
          
          {/* Progress Indicator */}
          <div className="flex items-center justify-center mt-6 space-x-4">
            <div className={`flex items-center space-x-2 ${currentStep === 'wallet' ? 'text-blue-600' : 'text-green-600'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'wallet' ? 'bg-blue-100 border-2 border-blue-600' : 'bg-green-100'}`}>
                <Wallet className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium">Connect Wallet</span>
            </div>
            <div className={`w-8 h-0.5 ${account ? 'bg-green-600' : 'bg-gray-300'}`}></div>
            <div className={`flex items-center space-x-2 ${currentStep === 'credentials' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'credentials' ? 'bg-blue-100 border-2 border-blue-600' : 'bg-gray-100'}`}>
                <Lock className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium">Enter Credentials</span>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {authError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700 max-w-md mx-auto">
            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
            <span className="text-sm">{authError}</span>
          </div>
        )}

        {/* Step 1: Wallet Connection */}
        {currentStep === 'wallet' && (
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-xl p-8 shadow-lg text-center">
              <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-6">
                <Wallet className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Connect Your Wallet</h2>
              <p className="text-gray-600 mb-6">
                Connect your Web3 wallet to begin the authentication process
              </p>
              {account && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700 mb-2">
                    ✓ Wallet Connected: {account.slice(0, 6)}...{account.slice(-4)}
                  </p>
                  <Button
                    onClick={handleDisconnectWallet}
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                  >
                    <LogOut className="w-3 h-3 mr-1" />
                    Disconnect
                  </Button>
                </div>
              )}
              <Button
                onClick={handleWalletConnect}
                disabled={isConnecting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Wallet className="w-4 h-4 mr-2" />
                    {account ? 'Proceed to Credentials' : 'Connect Wallet'}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Credentials & Role Selection */}
        {currentStep === 'credentials' && (
          <div className="max-w-2xl mx-auto">
            {/* Back button */}
            <div className="mb-6">
              <Button
                onClick={handleBackToWallet}
                variant="ghost"
                className="text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Wallet
              </Button>
            </div>
            
            {/* Credentials Form */}
            <div className="bg-white rounded-xl p-8 shadow-lg mb-8">
              <div className="text-center mb-6">
                <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Enter Your Credentials</h2>
                <p className="text-gray-600">Use your registered email and password</p>
                <div className="mt-2 p-2 bg-gray-50 rounded-lg flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    Wallet: {account?.slice(0, 6)}...{account?.slice(-4)}
                  </p>
                  <Button
                    onClick={handleDisconnectWallet}
                    variant="ghost"
                    size="sm"
                    className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 p-1"
                  >
                    <LogOut className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={credentials.email}
                      onChange={handleCredentialsChange}
                      placeholder="Enter your registered email"
                      className="pl-10"
                      disabled={isAuthenticating}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      value={credentials.password}
                      onChange={handleCredentialsChange}
                      placeholder="Enter your password"
                      className="pl-10"
                      disabled={isAuthenticating}
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Role Selection */}
            <div className="grid md:grid-cols-3 gap-4">
              {/* Recipient Role */}
              <div
                onClick={() => handleRoleAuth('recipient')}
                className={`bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all transform hover:scale-105 cursor-pointer border-2 border-transparent hover:border-green-500 ${isAuthenticating ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="text-center">
                  <div className="bg-green-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                    <User className="w-6 h-6 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-2">Sign in as Recipient</h3>
                  <p className="text-sm text-gray-600">Track packages and view delivery history</p>
                </div>
              </div>

              {/* Delivery Role */}
              <div
                onClick={() => handleRoleAuth('delivery')}
                className={`bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all transform hover:scale-105 cursor-pointer border-2 border-transparent hover:border-blue-500 ${isAuthenticating ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="text-center">
                  <div className="bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                    <Truck className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-2">Sign in as Delivery</h3>
                  <p className="text-sm text-gray-600">Manage deliveries and update status</p>
                </div>
              </div>

              {/* Admin Role */}
              <div
                onClick={() => handleRoleAuth('admin')}
                className={`bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all transform hover:scale-105 cursor-pointer border-2 border-transparent hover:border-purple-500 ${isAuthenticating ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="text-center">
                  <div className="bg-purple-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                    <Shield className="w-6 h-6 text-purple-600" />
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-2">Sign in as Admin</h3>
                  <p className="text-sm text-gray-600">System administration and oversight</p>
                </div>
              </div>
            </div>

            {isAuthenticating && (
              <div className="mt-4 text-center">
                <div className="inline-flex items-center px-4 py-2 bg-blue-50 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin mr-2 text-blue-600" />
                  <span className="text-sm text-blue-600">Authenticating...</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Login Info */}
        <div className="text-center mt-8">
          <p className="text-gray-600 text-sm">
            Use the test credentials provided above to access the system
          </p>
        </div>

        {/* Bottom Description */}
        <div className="text-center mt-8 p-6 bg-white rounded-lg shadow-md">
          <div className="flex items-center justify-center mb-2">
            <Shield className="w-5 h-5 text-gray-500 mr-2" />
            <span className="text-gray-600 font-medium">Secure Authentication</span>
          </div>
          <p className="text-sm text-gray-500">
            Two-step authentication with Web3 wallet connection and email/password verification ensures maximum security
          </p>
        </div>
      </div>
    </div>
  )
}

export default SignInPage

