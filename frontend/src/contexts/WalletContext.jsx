import { createContext, useContext, useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { userAPI, workerAPI, handleAPIError } from '../services/api.js'

const WalletContext = createContext()

export const useWallet = () => {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider')
  }
  return context
}

export const WalletProvider = ({ children }) => {
  const [account, setAccount] = useState(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [provider, setProvider] = useState(null)
  const [userRole, setUserRole] = useState(null) // 'delivery' or 'recipient'

  // Check if wallet is already connected on page load
  useEffect(() => {
    checkWalletConnection()
    
    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged)
      window.ethereum.on('chainChanged', () => {
        window.location.reload()
      })
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
      }
    }
  }, [])

  const handleAccountsChanged = (accounts) => {
    if (accounts.length === 0) {
      disconnect()
    } else {
      setAccount(accounts[0])
    }
  }

  const checkWalletConnection = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const accounts = await provider.listAccounts()
        if (accounts.length > 0) {
          setAccount(accounts[0].address)
          setProvider(provider)
        }
      } catch (error) {
        console.error('Error checking wallet connection:', error)
      }
    }
  }

  // Connect wallet only (first step)
  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask or another Web3 wallet!')
      return { success: false, error: 'No Web3 wallet found' }
    }

    setIsConnecting(true)
    try {
      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' })
      
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const address = await signer.getAddress()
      
      setAccount(address)
      setProvider(provider)
      
      return { success: true, address }
    } catch (error) {
      console.error('Error connecting wallet:', error)
      return { success: false, error: 'Failed to connect wallet' }
    } finally {
      setIsConnecting(false)
    }
  }

  // Authenticate with email and password (second step)
  const authenticateUser = async (email, password, role) => {
    if (!account) {
      return { success: false, error: 'Please connect your wallet first' }
    }

    try {
      // Frontend validation of email/password combinations for different roles
      /*const validCredentials = {
        'test@example.com': { password: 'testPassword123', name: 'Test User', roles: ['recipient', 'delivery', 'admin'] },
        'admin@blockchain.com': { password: 'admin123', name: 'Admin User', roles: ['admin'] },
        'delivery@mail.com': { password: 'delivery123', name: 'Delivery Worker', roles: ['delivery'] },
        'recipient@mail.com': { password: 'recipient123', name: 'Mail Recipient', roles: ['recipient'] }
      }

      const userCreds = validCredentials[email]
      if (!userCreds || userCreds.password !== password) {
        return { success: false, error: 'Invalid email or password' }
      }

      if (!userCreds.roles.includes(role)) {
        return { success: false, error: `This account is not authorized for ${role} role` }
      }*/

      // Use backend API with password and userAddress
      const response = await userAPI.authenticate(password, account)
      
      if (response.success) {
        setUserRole(role)
        
        // Store authentication info
        localStorage.setItem('userRole', role)
        localStorage.setItem('walletAddress', account)
        localStorage.setItem('authToken', response.token || 'mock_token_' + Date.now())
        localStorage.setItem('userEmail', email)
        // localStorage.setItem('userName', userCreds.name)
		localStorage.setItem('userName', "test")
        
        return { 
          success: true, 
          user: {
            userAddress: account,
            // name: userCreds.name,
			name: "test",
            email: email,
            role: role,
            ...response.data
          }
        }
      } else {
        return { success: false, error: response.error || 'Authentication failed' }
      }
      
    } catch (error) {
      const errorMessage = handleAPIError(error)
      return { success: false, error: errorMessage }
    }
  }

  // Legacy connectWallet method for compatibility (will be deprecated)
  const connectWalletWithRole = async (role) => {
    const walletResult = await connectWallet()
    if (!walletResult.success) {
      return false
    }
    
    // For legacy support, return true but user needs to authenticate separately
    return true
  }

  const disconnect = () => {
    setAccount(null)
    setProvider(null)
    setUserRole(null)
    localStorage.removeItem('userRole')
    localStorage.removeItem('walletAddress')
    localStorage.removeItem('authToken')
    localStorage.removeItem('userEmail')
    localStorage.removeItem('userName')
  }

  const shortenAddress = (address) => {
    if (!address) return ''
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const value = {
    account,
    provider,
    userRole,
    isConnecting,
    connectWallet,
    authenticateUser,
    connectWalletWithRole, // Legacy method
    disconnect,
    shortenAddress,
    isConnected: !!account
  }

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  )
}