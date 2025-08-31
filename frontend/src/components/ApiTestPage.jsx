import { useState } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { healthAPI, userAPI, workerAPI, deliveryAPI, handleAPIError } from '../services/api.js'
import { RefreshCw, CheckCircle, XCircle, Clock, User, Truck } from 'lucide-react'

function ApiTestPage() {
  const [testResults, setTestResults] = useState({})
  const [isRunning, setIsRunning] = useState(false)

  const runTest = async (testName, testFunction) => {
    setTestResults(prev => ({ ...prev, [testName]: { status: 'running' } }))
    
    try {
      const startTime = Date.now()
      const result = await testFunction()
      const duration = Date.now() - startTime
      
      setTestResults(prev => ({
        ...prev,
        [testName]: {
          status: 'success',
          result,
          duration
        }
      }))
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [testName]: {
          status: 'error',
          error: handleAPIError(error),
          duration: 0
        }
      }))
    }
  }

  const runAllTests = async () => {
    setIsRunning(true)
    setTestResults({})

    const tests = [
      {
        name: 'Health Check',
        test: () => healthAPI.checkHealth()
      },
      {
        name: 'Blockchain Status',
        test: () => healthAPI.checkBlockchainStatus()
      },
      {
        name: 'Get Worker Info (Valid)',
        test: () => workerAPI.getWorker('0x2Cb2E88CBE054982833A4A08658e1341Ca04b8dC')
      },
      {
        name: 'Get Worker Info (Invalid)',
        test: () => workerAPI.getWorker('0x1234567890123456789012345678901234567890')
      },
      {
        name: 'Get User Info',
        test: () => userAPI.getUser('0x0BBe0E741C165952307aD4901A5804704849C81c')
      },
      {
        name: 'Get Delivery Performance',
        test: () => deliveryAPI.getPerformance()
      }
    ]

    for (const testCase of tests) {
      await runTest(testCase.name, testCase.test)
      // Add small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    setIsRunning(false)
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'running':
        return <Clock className="w-4 h-4 text-yellow-600 animate-spin" />
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'error':
        return <XCircle className="w-4 h-4 text-red-600" />
      default:
        return null
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'running':
        return 'border-yellow-200 bg-yellow-50'
      case 'success':
        return 'border-green-200 bg-green-50'
      case 'error':
        return 'border-red-200 bg-red-50'
      default:
        return 'border-gray-200 bg-gray-50'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">API Integration Test</h1>
          <p className="text-lg text-gray-600">Test the connection between frontend and blockchain backend</p>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-lg mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">API Endpoint Tests</h2>
            <Button 
              onClick={runAllTests}
              disabled={isRunning}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Running Tests...
                </>
              ) : (
                'Run All Tests'
              )}
            </Button>
          </div>

          <div className="space-y-4">
            {Object.keys(testResults).length === 0 && !isRunning && (
              <div className="text-center py-8 text-gray-500">
                <Truck className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Click "Run All Tests" to test API endpoints</p>
              </div>
            )}

            {Object.entries(testResults).map(([testName, result]) => (
              <div
                key={testName}
                className={`border-2 rounded-lg p-4 ${getStatusColor(result.status)}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(result.status)}
                    <h3 className="font-medium text-gray-800">{testName}</h3>
                  </div>
                  {result.duration > 0 && (
                    <span className="text-sm text-gray-500">{result.duration}ms</span>
                  )}
                </div>

                {result.status === 'success' && result.result && (
                  <div className="mt-2">
                    <details className="cursor-pointer">
                      <summary className="text-sm font-medium text-gray-700 hover:text-gray-900">
                        View Response
                      </summary>
                      <pre className="mt-2 text-xs bg-gray-100 p-3 rounded overflow-auto max-h-40">
                        {JSON.stringify(result.result, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}

                {result.status === 'error' && result.error && (
                  <div className="mt-2">
                    <p className="text-sm text-red-700 font-medium">Error:</p>
                    <p className="text-sm text-red-600">{result.error}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Connection Info */}
        <div className="bg-white rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Connection Information</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Frontend</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Running on: {window.location.origin}</li>
                <li>• Framework: React + Vite</li>
                <li>• State: Connected</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Backend</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• API Base: http://localhost:3001</li>
                <li>• Mode: Mock (Development)</li>
                <li>• Status: {isRunning ? 'Testing...' : 'Ready'}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ApiTestPage