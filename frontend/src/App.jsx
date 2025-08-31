import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { WalletProvider } from './contexts/WalletContext.jsx'
import HomePage from './components/HomePage.jsx'
import SignInPage from './components/SignInPage.jsx'
import SignUpPage from './components/SignUpPage.jsx'
import DeliveryDashboard from './components/DeliveryDashboard.jsx'
import RecipientDashboard from './components/RecipientDashboard.jsx'
import AdminDashboard from './components/AdminDashboard.jsx'
import './App.css'

function App() {
  return (
    <WalletProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/signin" element={<SignInPage />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/delivery-dashboard" element={<DeliveryDashboard />} />
            <Route path="/recipient-dashboard" element={<RecipientDashboard />} />
            <Route path="/admin-dashboard" element={<AdminDashboard />} />
          </Routes>
        </div>
      </Router>
    </WalletProvider>
  )
}

export default App
