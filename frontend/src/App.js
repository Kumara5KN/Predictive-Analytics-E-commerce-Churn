import React, { useState } from 'react';
import IndividualAnalysis from './IndividualAnalysis';
import BatchAnalysis from './BatchAnalysis';
import Dashboard from './Dashboard';
import BatchDashboard from './BatchDashboard';
import Login from './Login';
import './App.css';
import logo from './assets/images/logo.png';

// --- CRITICAL FIX: Set API BASE URL to 5000 ---
const API_BASE_URL = 'http://localhost:5000';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [customerData, setCustomerData] = useState({
    Tenure: 5,
    OrderCount: 5,
    CashbackAmount: 12000,
    DaySinceLastOrder: 7,
    HourSpendOnApp: 30,
    OrderAmountHikeFromlastYear: 15,
    CouponUsed: 1,
    NumberOfDeviceRegistered: 3,
    SatisfactionScore: 3,
    WarehouseToHome: 10,
    NumberOfAddress: 4,
    CityTier: 1,
    PreferredLoginDevice: 'Mobile Phone',
    PreferredPaymentMode: 'Credit Card',
    PreferedOrderCat: 'Laptop & Accessory',
    Gender: 'Male',
    MaritalStatus: 'Single',
    Complain: 0
  });
  
  const [loading, setLoading] = useState(false); // For Individual Analysis
  
  const [selectedFile, setSelectedFile] = useState(null);
  const [batchResults, setBatchResults] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false); // For Batch Analysis
  
  const [currentView, setCurrentView] = useState('individual');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dashboardData, setDashboardData] = useState(null); // Individual Results
  const [batchDashboardData, setBatchDashboardData] = useState(null); // Batch Results

  // Login handler
  const handleLogin = (username, password) => {
    // Simple authentication - in real app, this would be API call
    if (username === 'admin' && password === 'admin123') {
      setIsLoggedIn(true);
      return true;
    }
    return false;
  };

  // Logout handler
  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentView('individual');
    setDashboardData(null);
    setBatchDashboardData(null);
    setBatchResults(null);
  };

  const handleInputChange = (newData) => {
    setCustomerData(newData);
  };

  const handleAnalysisComplete = (results) => {
    const newDashboardData = {
      individualResult: results,
      timestamp: new Date().toLocaleString(),
      type: 'individual',
      customerData: { ...customerData }
    };
    setDashboardData(newDashboardData);
    setCurrentView('dashboard');
  };

  const handleReset = () => {
    setCustomerData({
      Tenure: 5,
      OrderCount: 5,
      CashbackAmount: 12000,
      DaySinceLastOrder: 7,
      HourSpendOnApp: 30,
      OrderAmountHikeFromlastYear: 15,
      CouponUsed: 1,
      NumberOfDeviceRegistered: 3,
      SatisfactionScore: 3,
      WarehouseToHome: 10,
      NumberOfAddress: 4,
      CityTier: 1,
      PreferredLoginDevice: 'Mobile Phone',
      PreferredPaymentMode: 'Credit Card',
      PreferedOrderCat: 'Laptop & Accessory',
      Gender: 'Male',
      MaritalStatus: 'Single',
      Complain: 0
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);
    setBatchResults(null);
    setBatchDashboardData(null);
  };
  
  // --- Individual Prediction Example (Hypothetical, for completeness) ---
  const handleIndividualAnalyze = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerData),
      });
      const result = await response.json();
      if (result.success) {
        handleAnalysisComplete(result);
      } else {
        alert(`Individual analysis failed: ${result.error}`);
      }
    } catch (error) {
      alert(`Connection error: ${error.message}. Ensure backend is running on ${API_BASE_URL}.`);
    } finally {
      setLoading(false);
    }
  };

  // --- Batch Prediction (Updated to use unified endpoint on port 5000) ---
  const handleBatchAnalyze = async () => {
    setBatchLoading(true);
    
    try {
      const formData = new FormData();
      if (selectedFile) {
        formData.append('file', selectedFile);
      }
      
      console.log('📤 Sending batch analysis request to unified backend...');
      
      // Target port 5000 /api/batch/analyze
      const response = await fetch(`${API_BASE_URL}/api/batch/analyze`, {
        method: 'POST',
        body: selectedFile ? formData : undefined, 
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Batch analysis successful:', result);
        
        setBatchResults(result);
        setBatchDashboardData({
          batchResult: result,
          timestamp: new Date().toLocaleString(),
          type: 'batch',
        });
        setCurrentView('batch-dashboard');
      } else {
        console.error('❌ Batch analysis failed:', result.error);
        alert(`Analysis failed: ${result.error}. Message: ${result.message}`);
      }
    } catch (error) {
      console.error('❌ Error during batch analysis:', error);
      alert(`Connection error: ${error.message}. Please ensure the backend server is running on port 5000.`);
    } finally {
      setBatchLoading(false);
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const navigateToDashboard = () => {
    setCurrentView('dashboard');
  };

  const navigateToBatchDashboard = () => {
    setCurrentView('batch-dashboard');
  };

  // Show login page if not authenticated
  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  // Main application after login
  return (
    <div className="app">
      <div className="app-header">
        <div className="header-left">
          <div className="logo-title-container">
            <div className="app-logo">
              <img src={logo} alt="ChurnGuard Logo" className="logo-image" />
            </div>
            <div className="title-container">
              <h1 className="app-title">E-commerce ChurnGuard</h1>
            </div>
          </div>
        </div>
        <div className="header-right">
          <div className="header-stats">
            <div className="stat-item">
              <span className="stat-label">Model Accuracy</span>
              <span className="stat-value">92%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="main-layout">
        <div className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
          <nav className="sidebar-nav">
            <div className="nav-toggle-section">
              <button 
                className="nav-toggle-btn"
                onClick={toggleSidebar}
              >
                <span className="nav-toggle-icon">
                  {sidebarOpen ? '◀' : '▶'}
                </span>
                {sidebarOpen && <span className="nav-toggle-text">Collapse</span>}
                {!sidebarOpen && <span className="nav-toggle-text">Expand</span>}
              </button>
            </div>

            {/* Individual Analysis Section */}
            <div className="nav-section">
              {sidebarOpen && (
                <div className="nav-section-header">
                  <span className="nav-section-title">Individual Analysis</span>
                </div>
              )}
              <button 
                className={`nav-item ${currentView === 'individual' ? 'active' : ''}`}
                onClick={() => setCurrentView('individual')}
                data-tooltip="Individual Analysis"
              >
                <span className="nav-icon">🔍</span>
                {sidebarOpen && <span className="nav-text">Individual Analysis</span>}
              </button>
              <button 
                className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
                onClick={navigateToDashboard}
                data-tooltip="Individual Results"
              >
                <span className="nav-icon">📈</span>
                {sidebarOpen && <span className="nav-text">Individual Results</span>}
              </button>
            </div>

            {/* Batch Processing Section */}
            <div className="nav-section">
              {sidebarOpen && (
                <div className="nav-section-header">
                  <span className="nav-section-title">Batch Processing</span>
                </div>
              )}
              <button 
                className={`nav-item ${currentView === 'batch' ? 'active' : ''}`}
                onClick={() => setCurrentView('batch')}
                data-tooltip="Batch Processing"
              >
                <span className="nav-icon">⚡</span>
                {sidebarOpen && <span className="nav-text">Batch Processing</span>}
              </button>
              <button 
                className={`nav-item ${currentView === 'batch-dashboard' ? 'active' : ''}`}
                onClick={navigateToBatchDashboard}
                data-tooltip="Batch Results"
              >
                <span className="nav-icon">📊</span>
                {sidebarOpen && <span className="nav-text">Batch Results</span>}
              </button>
            </div>

            {/* Logout Section */}
            <div className="nav-section logout-section">
              {sidebarOpen && (
                <div className="nav-section-header">
                  <span className="nav-section-title">Account</span>
                </div>
              )}
              <button 
                className="nav-item logout-btn"
                onClick={handleLogout}
                data-tooltip="Logout"
              >
                <span className="nav-icon">🚪</span>
                {sidebarOpen && <span className="nav-text">Logout</span>}
              </button>
            </div>
          </nav>
        </div>

        <div className={`content-area ${!sidebarOpen ? 'expanded' : ''}`}>
          {currentView === 'individual' && (
            <>
              <div className="view-title-section">
                <h2 className="view-title">
                  <span className="view-icon">👤</span>
                  Individual Customer Analysis
                </h2>
              </div>
              <IndividualAnalysis
                customerData={customerData}
                onInputChange={handleInputChange}
                onReset={handleReset}
                loading={loading}
                setLoading={setLoading}
                onAnalyze={handleIndividualAnalyze} 
                onAnalysisComplete={handleAnalysisComplete}
              />
            </>
          )}

          {currentView === 'batch' && (
            <>
              <div className="view-title-section">
                <h2 className="view-title">
                  <span className="view-icon">⚡</span>
                  Batch Processing
                </h2>
              </div>
              <BatchAnalysis
                onFileChange={handleFileChange}
                onAnalyze={handleBatchAnalyze}
                loading={batchLoading}
                selectedFile={selectedFile}
              />
            </>
          )}

          {currentView === 'dashboard' && (
            <Dashboard dashboardData={dashboardData} />
          )}

          {currentView === 'batch-dashboard' && batchDashboardData && (
            <BatchDashboard dashboardData={batchDashboardData} />
          )}
          
          {currentView === 'batch-dashboard' && !batchDashboardData && (
            <div className="view-title-section" style={{padding: '40px', textAlign: 'center', color: '#94a3b8'}}>
                <h2>📊 Batch Analysis Dashboard</h2>
                <p>No batch analysis results available. Please navigate back to 'Batch Processing' (⚡) and run an analysis first.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;