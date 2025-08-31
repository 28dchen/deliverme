import { Button } from '@/components/ui/button.jsx'
import { useNavigate } from 'react-router-dom'
import { Package, Shield, Truck } from 'lucide-react'

function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-4">
      <div className="max-w-4xl w-full text-center space-y-8">
        {/* Main Title */}
        <div className="space-y-4">
          <div className="flex items-center justify-center space-x-4 mb-6">
            <Shield className="w-12 h-12 text-blue-600" />
            <Package className="w-12 h-12 text-green-600" />
            <Truck className="w-12 h-12 text-orange-600" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-gray-800 leading-tight">
            Blockchain Tracked Physical Mail Delivery System
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Secure, transparent, and traceable logistics delivery management system based on blockchain technology
          </p>
        </div>

        {/* Key Features */}
        <div className="grid md:grid-cols-3 gap-6 my-12">
          <div className="bg-white rounded-lg p-6 shadow-lg hover:shadow-xl transition-shadow">
            <Shield className="w-8 h-8 text-blue-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Secure & Reliable</h3>
            <p className="text-gray-600">Based on blockchain technology, ensuring data immutability</p>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-lg hover:shadow-xl transition-shadow">
            <Package className="w-8 h-8 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Real-time Tracking</h3>
            <p className="text-gray-600">Full tracking of delivery status, transparent and visible</p>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-lg hover:shadow-xl transition-shadow">
            <Truck className="w-8 h-8 text-orange-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Efficient Delivery</h3>
            <p className="text-gray-600">Optimize delivery routes, improve delivery efficiency</p>
          </div>
        </div>


        {/* Action Buttons */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => navigate('/signin')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-lg rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
            >
              Sign In
            </Button>
            <Button 
              onClick={() => navigate('/signup')}
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 text-lg rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
            >
              Sign Up
            </Button>
          </div>
          <p className="text-gray-500">
            Sign in with existing credentials or sign up for a new account to access the blockchain delivery system
          </p>
        </div>
      </div>
    </div>
  )
}

export default HomePage

