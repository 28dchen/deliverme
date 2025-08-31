import { useState } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { useNavigate } from 'react-router-dom'
import { useWallet } from '../contexts/WalletContext.jsx'
import { userAPI, handleAPIError } from '../services/api.js'
import { User, Wallet, ArrowLeft, Loader2, Mail, Lock, AlertCircle, CheckCircle, LogOut } from 'lucide-react'

function SignUpPage() {
  const navigate = useNavigate()
  const { connectWallet, disconnect, isConnecting, account } = useWallet()
  const [currentStep, setCurrentStep] = useState('wallet') // 'wallet' or 'registration'
  const [credentials, setCredentials] = useState({ name: '', email: '', password: '' })
  const [isRegistering, setIsRegistering] = useState(false)
  const [authError, setAuthError] = useState('')

  // Step 1: Connect wallet
  const handleWalletConnect = async () => {
    const result = await connectWallet()
    if (result.success) {
      setCurrentStep('registration')
      setAuthError('')
    } else {
      setAuthError(result.error)
    }
  }

  // Step 2: Handle Sign Up
  const handleSignUp = async (e) => {
    e.preventDefault()
    
    if (!credentials.name || !credentials.email || !credentials.password) {
      setAuthError('Please fill in all fields for registration')
      return
    }

    if (credentials.password.length < 6) {
      setAuthError('Password must be at least 6 characters long')
      return
    }

    setIsRegistering(true)
    setAuthError('')

    try {
      // First check if user is already registered
      try {
        const checkResponse = await fetch(`http://localhost:3001/api/user/check/${account}`)
        const checkData = await checkResponse.json()
        
        if (checkData.success && checkData.data.isRegistered) {
          const errorMessage = 'This wallet address is already registered'
          const failureMessage = `❌ Registration Failed!\n\nError: ${errorMessage}\n\n• This wallet is already associated with an account\n• Try signing in instead\n• Use a different wallet address`
          
          alert(failureMessage)
          setAuthError(errorMessage)
          return
        }
      } catch (checkError) {
        console.log('Could not check registration status, proceeding with registration')
      }
      
      // Register user with backend API, including wallet address
      const response = await userAPI.register({
        name: credentials.name,
        email: credentials.email,
        password: credentials.password,
        userAddress: account // Pass the connected wallet address
      })
      
      console.log('Registration API response:', response)
      
      if (response && response.success) {
        // Success alert with API response details
        const successMessage = response.userId 
          ? `✅ Registration Successful!\n\n• User ID: ${response.userId}\n• Email: ${credentials.email}\n• Name: ${credentials.name}\n\nYou can now sign in with your credentials.`
          : `✅ Registration Successful!\n\n• Email: ${credentials.email}\n• Name: ${credentials.name}\n\nYou can now sign in with your credentials.`
        
        alert(successMessage)
        
        // Navigate to sign in page
        navigate('/signin')
      } else {
        // Failure alert with API error details
        const errorMessage = response?.message || response?.error || 'Registration failed'
        const failureMessage = `❌ Registration Failed!\n\nError: ${errorMessage}\n\nPlease try again or contact support if the problem persists.`
        
        alert(failureMessage)
        setAuthError(errorMessage)
      }
    } catch (error) {
      console.error('Registration error:', error)
      const errorMessage = handleAPIError(error)
      
      // Network/system error alert
      const failureMessage = `❌ Registration Failed!\n\nSystem Error: ${errorMessage}\n\nPlease check your connection and try again.`
      
      alert(failureMessage)
      setAuthError(errorMessage)
    } finally {
      setIsRegistering(false)
    }
  }

  const handleCredentialsChange = (e) => {
    const { name, value } = e.target
    setCredentials(prev => ({ ...prev, [name]: value }))
    if (authError) setAuthError('')
  }

  const handleBackToWallet = () => {
    setCurrentStep('wallet')
    setCredentials({ name: '', email: '', password: '' })
    setAuthError('')
  }

  // Handle wallet disconnect
  const handleDisconnectWallet = () => {
    disconnect()
    setCurrentStep('wallet')
    setCredentials({ name: '', email: '', password: '' })
    setAuthError('')
    alert('✅ Wallet Disconnected!\n\nYou have successfully disconnected your wallet. You can connect a different wallet or return to the home page.')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-100 flex flex-col items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Header with Back Button */}
        <div className="flex justify-between items-center mb-8">
          <Button 
            onClick={() => navigate('/')}
            variant="ghost"
            className="text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
          
          {/* Sign In Link */}
          <Button
            onClick={() => navigate('/signin')}
            variant="ghost"
            size="sm"
            className="text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 px-2 py-1"
          >
            Already have an account? Sign In
          </Button>
        </div>

        {/* Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            {currentStep === 'wallet' ? 'Connect Wallet' : 'Create Account'}
          </h1>
          <p className="text-lg text-gray-600">
            {currentStep === 'wallet' 
              ? 'First, connect your Web3 wallet to authenticate'
              : 'Fill in your information to create a new account'
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
            <div className={`flex items-center space-x-2 ${currentStep === 'registration' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'registration' ? 'bg-blue-100 border-2 border-blue-600' : 'bg-gray-100'}`}>
                <User className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium">Create Account</span>
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
                Connect your Web3 wallet to begin the registration process
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
                    {account ? 'Proceed to Registration' : 'Connect Wallet'}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Registration Form */}
        {currentStep === 'registration' && (
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
            
            {/* Registration Form */}
            <div className="bg-white rounded-xl p-8 shadow-lg mb-8">
              <div className="text-center mb-6">
                <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <User className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Create Your Account</h2>
                <p className="text-gray-600">Fill in your information to register</p>
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

              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                    Full Name
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      value={credentials.name}
                      onChange={handleCredentialsChange}
                      placeholder="Enter your full name"
                      className="pl-10"
                      disabled={isRegistering}
                      required
                    />
                  </div>
                </div>

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
                      placeholder="Enter your email address"
                      className="pl-10"
                      disabled={isRegistering}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                    Password <span className="text-xs text-gray-500">(min. 6 characters)</span>
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      value={credentials.password}
                      onChange={handleCredentialsChange}
                      placeholder="Create a password (min. 6 chars)"
                      className="pl-10"
                      disabled={isRegistering}
                      required
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <Button
                    type="submit"
                    disabled={!credentials.name || !credentials.email || !credentials.password || isRegistering}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
                  >
                    {isRegistering ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Create Account
                      </>
                    )}
                  </Button>
                </div>
              </form>

              {/* Sign Up Information */}
              <div className="mt-6 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-xs text-green-700 font-medium">Registration Information:</p>
                <p className="text-xs text-green-600">
                  After registration, you'll be able to sign in as a recipient to track packages and view delivery history. For delivery or admin access, contact the administrator after registration.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Description */}
        <div className="text-center mt-8 p-6 bg-white rounded-lg shadow-md">
          <div className="flex items-center justify-center mb-2">
            <User className="w-5 h-5 text-gray-500 mr-2" />
            <span className="text-gray-600 font-medium">New User Registration</span>
          </div>
          <p className="text-sm text-gray-500">
            Create a new account with Web3 wallet connection and email verification for secure access to the blockchain delivery system
          </p>
        </div>
      </div>
    </div>
  )
}

export default SignUpPage