import React, { useState, useMemo } from "react";
import "./BatchDashboard.css";

function BatchDashboard({ dashboardData }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [searchTerm, setSearchTerm] = useState("");

  if (!dashboardData || !dashboardData.batchResult) {
    return (
      <div className="batch-dashboard">
        <div className="no-data-message">
          <h3>No Batch Analysis Results Available</h3>
          <p>Please run a batch analysis first from the Batch Processing section.</p>
        </div>
      </div>
    );
  }

  const { batchResult } = dashboardData;
  const { dataset_info, risk_analysis, customer_segmentation, feature_analysis, all_predictions, data_source } = batchResult;

  // Calculate percentages for risk distribution
  const totalCustomers = dataset_info.total_customers;
  const riskDistribution = risk_analysis.risk_distribution || {};

  // Calculate risk counts from distribution
  const lowRiskCount = riskDistribution['P3: Low Risk (<=30%)'] || 0;
  const mediumRiskCount = riskDistribution['P2: Moderate Risk (31-70%)'] || 0;
  const highRiskCount = riskDistribution['P1: High Risk (>70%)'] || 0;

  // Enhanced feature analysis data
  const enhancedFeatureData = useMemo(() => {
    if (!all_predictions || all_predictions.length === 0) return null;

    const features = {
      paymentMethods: {},
      tenureBuckets: { '0-3': 0, '3-6': 0, '6-9': 0, '9-12': 0, '12+': 0 },
      cityTiers: { 'Tier 1': 0, 'Tier 2': 0, 'Tier 3': 0 },
      maritalStatus: { 'Single': 0, 'Married': 0, 'Divorced': 0 },
      gender: { 'Male': 0, 'Female': 0 },
      satisfactionScores: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
      complainStatus: { 'No Complaints': 0, 'Complaints': 0 },
      churnStatus: { 'Churned': 0, 'Retained': 0 }
    };

    all_predictions.forEach(customer => {
      // Payment Methods
      const paymentMethod = customer.PreferredPaymentMode || 'Credit Card';
      features.paymentMethods[paymentMethod] = (features.paymentMethods[paymentMethod] || 0) + 1;

      // Tenure Buckets
      const tenure = customer.Tenure || 0;
      if (tenure <= 3) features.tenureBuckets['0-3']++;
      else if (tenure <= 6) features.tenureBuckets['3-6']++;
      else if (tenure <= 9) features.tenureBuckets['6-9']++;
      else if (tenure <= 12) features.tenureBuckets['9-12']++;
      else features.tenureBuckets['12+']++;

      // City Tiers
      const cityTier = customer.CityTier || 2;
      features.cityTiers[`Tier ${cityTier}`] = (features.cityTiers[`Tier ${cityTier}`] || 0) + 1;

      // Marital Status
      const maritalStatus = customer.MaritalStatus || 'Single';
      features.maritalStatus[maritalStatus] = (features.maritalStatus[maritalStatus] || 0) + 1;

      // Gender
      const gender = customer.Gender || 'Male';
      features.gender[gender] = (features.gender[gender] || 0) + 1;

      // Satisfaction Scores
      const satisfaction = customer.SatisfactionScore || 3;
      features.satisfactionScores[satisfaction.toString()]++;

      // Complain Status
      const complain = customer.Complain || 0;
      if (complain === 1) features.complainStatus['Complaints']++;
      else features.complainStatus['No Complaints']++;

      // Churn Status
      const churnStatus = customer.Predicted_Churn;
      if (churnStatus === 'Yes' || churnStatus === 1 || churnStatus === true) {
        features.churnStatus['Churned']++;
      } else {
        features.churnStatus['Retained']++;
      }
    });

    return features;
  }, [all_predictions]);

  // Filter and paginate ALL predictions
  const filteredPredictions = useMemo(() => {
    if (!all_predictions) return [];
    
    return all_predictions.filter(customer => {
      if (!searchTerm) return true;
      
      const searchLower = searchTerm.toLowerCase();
      return (
        (customer.Customer_ID && customer.Customer_ID.toString().toLowerCase().includes(searchLower)) ||
        (customer.Risk_Level && customer.Risk_Level.toLowerCase().includes(searchLower)) ||
        (customer.Predicted_Churn && customer.Predicted_Churn.toString().toLowerCase().includes(searchLower))
      );
    });
  }, [all_predictions, searchTerm]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredPredictions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPredictions = filteredPredictions.slice(startIndex, endIndex);

  // Function to download ALL customer data
  const downloadAllCustomers = async () => {
    try {
      const downloadBtn = document.querySelector('.download-all-btn');
      const originalText = downloadBtn.innerHTML;
      downloadBtn.innerHTML = '<div class="spinner-small"></div> Generating Full Report...';
      downloadBtn.disabled = true;

      let fileToProcess = null;
      
      const fileInput = document.getElementById('batch-file');
      if (fileInput && fileInput.files && fileInput.files[0]) {
        fileToProcess = fileInput.files[0];
      } else if (window.uploadedBatchFile) {
        fileToProcess = window.uploadedBatchFile;
      } else {
        alert("❌ No CSV file found. Please go back to 'Batch Processing' and upload your CSV file again to download the complete report.");
        downloadBtn.innerHTML = originalText;
        downloadBtn.disabled = false;
        return;
      }

      const formData = new FormData();
      formData.append('file', fileToProcess);

      const response = await fetch('https://predictive-analytics-e-commerce-churn.onrender.com/api/batch/download-report', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('text/csv')) {
        throw new Error(`Expected CSV but got: ${contentType}`);
      }

      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error('Downloaded file is empty');
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      
      const contentDisposition = response.headers.get('content-disposition');
      let filename = 'churn_analysis_complete_report.csv';
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      downloadBtn.innerHTML = originalText;
      downloadBtn.disabled = false;

    } catch (error) {
      console.error('❌ Error downloading full report:', error);
      let errorMessage = 'Error downloading complete report. ';
      
      if (error.message.includes('Failed to fetch')) {
        errorMessage += 'Cannot connect to server. Please make sure the backend is running on port 5000.';
      } else {
        errorMessage += error.message;
      }
      
      alert(errorMessage);
      
      const downloadBtn = document.querySelector('.download-all-btn');
      if (downloadBtn) {
        downloadBtn.innerHTML = '<span className="btn-icon">📥</span> Download Complete Report';
        downloadBtn.disabled = false;
      }
    }
  };

  // Function to download specific risk level customers
  const downloadRiskCustomers = async (riskLevel) => {
    try {
      const downloadBtn = document.querySelector(`.download-${riskLevel}-btn`);
      const originalText = downloadBtn.innerHTML;
      downloadBtn.innerHTML = '<div class="spinner-small"></div> Generating Report...';
      downloadBtn.disabled = true;

      let fileToProcess = null;
      
      const fileInput = document.getElementById('batch-file');
      if (fileInput && fileInput.files && fileInput.files[0]) {
        fileToProcess = fileInput.files[0];
      } else if (window.uploadedBatchFile) {
        fileToProcess = window.uploadedBatchFile;
      } else {
        alert(`❌ No CSV file found. Please go back to 'Batch Processing' and upload your CSV file again to download ${riskLevel} risk customers.`);
        downloadBtn.innerHTML = originalText;
        downloadBtn.disabled = false;
        return;
      }

      const formData = new FormData();
      formData.append('file', fileToProcess);
      formData.append('risk_level', riskLevel);

      const response = await fetch('https://predictive-analytics-e-commerce-churn.onrender.com/api/batch/download-risk-customers', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('text/csv')) {
        throw new Error(`Expected CSV but got: ${contentType}`);
      }

      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error('Downloaded file is empty');
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `churn_analysis_${riskLevel}_risk_customers.csv`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      downloadBtn.innerHTML = originalText;
      downloadBtn.disabled = false;

    } catch (error) {
      console.error(`❌ Error downloading ${riskLevel} risk customers:`, error);
      let errorMessage = `Error downloading ${riskLevel} risk customers. `;
      
      if (error.message.includes('Failed to fetch')) {
        errorMessage += 'Cannot connect to server. Please make sure the backend is running on port 5000.';
      } else {
        errorMessage += error.message;
      }
      
      alert(errorMessage);
      
      const downloadBtn = document.querySelector(`.download-${riskLevel}-btn`);
      if (downloadBtn) {
        const riskDisplay = riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1);
        downloadBtn.innerHTML = `<span className="btn-icon">📥</span> Download ${riskDisplay} Risk`;
        downloadBtn.disabled = false;
      }
    }
  };

  // Function to handle page change
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  // Function to handle items per page change
  const handleItemsPerPageChange = (e) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  // Render Chart Components

  // 1. Churn Rate Chart
  const renderChurnRateChart = () => {
    if (!enhancedFeatureData) return null;
    
    const data = enhancedFeatureData.churnStatus;
    const total = Object.values(data).reduce((sum, count) => sum + count, 0);
    const churnRate = ((data['Churned'] / total) * 100).toFixed(1);
    
    return (
      <div className="chart-container">
        <h4>Churn Rate Overview</h4>
        <div className="churn-rate-chart">
          <div className="churn-rate-metric">
            <div className="churn-rate-value">{churnRate}%</div>
            <div className="churn-rate-label">Overall Churn Rate</div>
          </div>
          <div className="churn-breakdown">
            <div className="churn-item retained">
              <div className="churn-count">{data['Retained']}</div>
              <div className="churn-label">Retained Customers</div>
              <div className="churn-percentage">{((data['Retained'] / total) * 100).toFixed(1)}%</div>
            </div>
            <div className="churn-item churned">
              <div className="churn-count">{data['Churned']}</div>
              <div className="churn-label">Churned Customers</div>
              <div className="churn-percentage">{churnRate}%</div>
            </div>
          </div>
          <div className="churn-gauge">
            <div className="gauge-track">
              <div 
                className="gauge-fill"
                style={{ width: `${churnRate}%` }}
              ></div>
            </div>
            <div className="gauge-labels">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 2. Gender Distribution Chart - Updated to Donut Charts
  const renderGenderChart = () => {
    if (!enhancedFeatureData) return null;
    
    const data = enhancedFeatureData.gender;
    const total = Object.values(data).reduce((sum, count) => sum + count, 0);
    const malePercentage = ((data['Male'] / total) * 100).toFixed(1);
    const femalePercentage = ((data['Female'] / total) * 100).toFixed(1);
    
    return (
      <div className="chart-container">
        <h4>Gender Distribution</h4>
        <div className="donut-chart-container">
          {/* Male Donut Chart */}
          <div className="donut-chart-wrapper">
            <div className="donut-chart male-donut">
              <div className="donut-segment" style={{ '--percentage': malePercentage }}></div>
              <div className="donut-hole"></div>
              <div className="donut-center">
                <div className="donut-value">{malePercentage}%</div>
                <div className="donut-label">Male</div>
              </div>
            </div>
            <div className="donut-details">
              <div className="detail-count">{data['Male']} customers</div>
              <div className="detail-percentage">{malePercentage}% of total</div>
            </div>
          </div>
          
          {/* Female Donut Chart */}
          <div className="donut-chart-wrapper">
            <div className="donut-chart female-donut">
              <div className="donut-segment" style={{ '--percentage': femalePercentage }}></div>
              <div className="donut-hole"></div>
              <div className="donut-center">
                <div className="donut-value">{femalePercentage}%</div>
                <div className="donut-label">Female</div>
              </div>
            </div>
            <div className="donut-details">
              <div className="detail-count">{data['Female']} customers</div>
              <div className="detail-percentage">{femalePercentage}% of total</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 3. Customer Tenure Distribution
  const renderTenureHistogram = () => {
    if (!enhancedFeatureData) return null;
    
    const data = enhancedFeatureData.tenureBuckets;
    const maxValue = Math.max(...Object.values(data));
    
    return (
      <div className="chart-container">
        <h4>Customer Tenure Distribution</h4>
        <div className="histogram-chart">
          {Object.entries(data).map(([bucket, count]) => {
            const height = (count / maxValue) * 100;
            
            return (
              <div key={bucket} className="histogram-bar">
                <div 
                  className="histogram-fill tenure-bucket"
                  style={{ height: `${height}%` }}
                >
                  <span className="histogram-value">{count}</span>
                </div>
                <div className="histogram-label">{bucket} months</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 4. City Tier Distribution
  const renderCityTierChart = () => {
    if (!enhancedFeatureData) return null;
    
    const data = enhancedFeatureData.cityTiers;
    const total = Object.values(data).reduce((sum, count) => sum + count, 0);
    
    return (
      <div className="chart-container">
        <h4>City Tier Distribution</h4>
        <div className="vertical-bar-chart">
          {Object.entries(data).map(([tier, count]) => {
            const percentage = ((count / total) * 100).toFixed(1);
            const height = (count / Math.max(...Object.values(data))) * 100;
            
            return (
              <div key={tier} className="vertical-bar">
                <div className="bar-count">{count}</div>
                <div 
                  className="vertical-fill city-tier"
                  style={{ height: `${height}%` }}
                ></div>
                <div className="vertical-label">
                  {tier}
                  <div className="percentage">{percentage}%</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 5. Marital Status & Risk Distribution
  const renderMaritalStatusChart = () => {
    if (!enhancedFeatureData) return null;
    
    const data = enhancedFeatureData.maritalStatus;
    const riskData = {
      'Single': { low: 0, medium: 0, high: 0 },
      'Married': { low: 0, medium: 0, high: 0 },
      'Divorced': { low: 0, medium: 0, high: 0 }
    };

    // Calculate risk distribution per marital status
    all_predictions.forEach(customer => {
      const status = customer.MaritalStatus || 'Single';
      const risk = customer.Risk_Level || 'Low Risk';
      
      if (risk.includes('High')) riskData[status].high++;
      else if (risk.includes('Moderate')) riskData[status].medium++;
      else riskData[status].low++;
    });

    const maxValue = Math.max(...Object.values(data));
    
    return (
      <div className="chart-container">
        <h4>Marital Status & Risk Distribution</h4>
        <div className="stacked-bar-chart">
          {Object.entries(riskData).map(([status, risks]) => {
            const total = risks.low + risks.medium + risks.high;
            const lowPercent = (risks.low / total) * 100;
            const mediumPercent = (risks.medium / total) * 100;
            const highPercent = (risks.high / total) * 100;
            
            return (
              <div key={status} className="stacked-bar">
                <div className="stacked-label">{status}</div>
                <div className="stacked-track">
                  <div 
                    className="stacked-segment low-risk"
                    style={{ width: `${lowPercent}%` }}
                    title={`Low Risk: ${risks.low}`}
                  ></div>
                  <div 
                    className="stacked-segment medium-risk"
                    style={{ width: `${mediumPercent}%` }}
                    title={`Medium Risk: ${risks.medium}`}
                  ></div>
                  <div 
                    className="stacked-segment high-risk"
                    style={{ width: `${highPercent}%` }}
                    title={`High Risk: ${risks.high}`}
                  ></div>
                </div>
                <div className="stacked-total">{total}</div>
              </div>
            );
          })}
        </div>
        <div className="stacked-legend">
          <div className="legend-item">
            <div className="legend-color low-risk"></div>
            <span>Low Risk</span>
          </div>
          <div className="legend-item">
            <div className="legend-color medium-risk"></div>
            <span>Medium Risk</span>
          </div>
          <div className="legend-item">
            <div className="legend-color high-risk"></div>
            <span>High Risk</span>
          </div>
        </div>
      </div>
    );
  };

  // 6. Satisfaction Score Distribution
  const renderSatisfactionChart = () => {
    if (!enhancedFeatureData) return null;
    
    const data = enhancedFeatureData.satisfactionScores;
    const maxValue = Math.max(...Object.values(data));
    
    return (
      <div className="chart-container">
        <h4>Satisfaction Score Distribution</h4>
        <div className="satisfaction-chart">
          {[1, 2, 3, 4, 5].map(score => {
            const count = data[score.toString()] || 0;
            const height = (count / maxValue) * 100;
            
            return (
              <div key={score} className="satisfaction-bar">
                <div className="bar-count">{count}</div>
                <div 
                  className="satisfaction-fill"
                  style={{ height: `${height}%` }}
                ></div>
                <div className="satisfaction-label">
                  {score} ★
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="batch-dashboard">
      <div className="dashboard-header">
        <h2>📊 Batch Analysis Dashboard</h2>
        <div className="header-actions">
          <div className="data-source-info">
            <span className="source-label">Data Source:</span>
            <span className="source-value">{data_source === "demo" ? "Demo Data" : "Uploaded CSV"}</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="dashboard-tabs">
        <button 
          className={`tab-button ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          📈 Overview
        </button>
        <button 
          className={`tab-button ${activeTab === "features" ? "active" : ""}`}
          onClick={() => setActiveTab("features")}
        >
          🔍 Feature Analysis
        </button>
        <button 
          className={`tab-button ${activeTab === "customers" ? "active" : ""}`}
          onClick={() => setActiveTab("customers")}
        >
          👥 Customer Details
        </button>
        <button 
          className={`tab-button ${activeTab === "downloads" ? "active" : ""}`}
          onClick={() => setActiveTab("downloads")}
        >
          📩 Download Reports
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="tab-content">
          {/* Dataset Overview */}
          <div className="section-card dataset-overview">
            <h3>📁 Dataset Overview</h3>
            <div className="dataset-stats-grid">
              <div className="stat-card">
                <div className="stat-value">{dataset_info.total_customers}</div>
                <div className="stat-label">Total Customers</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{dataset_info.total_features}</div>
                <div className="stat-label">Features Analyzed</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{dataset_info.dataset_size_kb.toFixed(1)} KB</div>
                <div className="stat-label">Dataset Size</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{risk_analysis.total_predicted_churn}</div>
                <div className="stat-label">Predicted Churn</div>
              </div>
            </div>
          </div>

          {/* Risk Analysis */}
          <div className="section-card risk-analysis">
            <h3>⚠️ Risk Analysis Summary</h3>
            <div className="risk-metrics-grid">
              <div className="risk-metric">
                <div className="metric-value">{risk_analysis.average_probability?.toFixed(3) || '0.000'}</div>
                <div className="metric-label">Average Churn Probability</div>
              </div>
              <div className="risk-metric">
                <div className="metric-value">{((risk_analysis.churn_rate || 0) * 100).toFixed(1)}%</div>
                <div className="metric-label">Overall Churn Rate</div>
              </div>
              <div className="risk-metric">
                <div className="metric-value">{customer_segmentation.high_risk_customers || 0}</div>
                <div className="metric-label">High-Risk Customers</div>
              </div>
              <div className="risk-metric">
                <div className="metric-value">₹{(customer_segmentation.potential_revenue_loss || 0).toLocaleString()}</div>
                <div className="metric-label">Potential Revenue Loss</div>
              </div>
            </div>

            {/* Risk Distribution */}
            <div className="risk-distribution">
              <h4>Risk Level Distribution</h4>
              <div className="distribution-bars">
                {Object.entries(riskDistribution).map(([riskLevel, count]) => {
                  const percentage = totalCustomers > 0 ? (count / totalCustomers * 100).toFixed(1) : 0;
                  let barColor = "";
                  
                  if (riskLevel.includes("High")) barColor = "high-risk";
                  else if (riskLevel.includes("Moderate")) barColor = "medium-risk";
                  else barColor = "low-risk";

                  return (
                    <div key={riskLevel} className="distribution-item">
                      <div className="risk-label-container">
                        <div className="risk-category">{riskLevel}</div>
                        <div className="customer-count">{count} customers</div>
                      </div>
                      <div className="bar-container">
                        <div 
                          className={`risk-bar ${barColor}`}
                          style={{ width: `${percentage}%` }}
                        >
                          <span className="bar-count">{count}</span>
                        </div>
                      </div>
                      <div className="risk-percentage">{percentage}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Feature Analysis Summary */}
          {feature_analysis && Object.keys(feature_analysis).length > 0 && (
            <div className="section-card feature-analysis">
              <h3>🔍 High-Risk Customer Profile</h3>
              <div className="feature-grid">
                {Object.entries(feature_analysis).slice(0, 6).map(([feature, stats]) => (
                  <div key={feature} className="feature-card">
                    <div className="feature-name">{feature}</div>
                    <div className="feature-stats">
                      <div className="stat">
                        <span className="stat-label">Avg:</span>
                        <span className="stat-value">{(stats.mean || 0).toFixed(2)}</span>
                      </div>
                      <div className="stat">
                        <span className="stat-label">Med:</span>
                        <span className="stat-value">{(stats.median || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Feature Analysis Tab */}
      {activeTab === "features" && enhancedFeatureData && (
        <div className="tab-content">
          <div className="charts-grid">
            <div className="chart-row">
              <div className="chart-wrapper">
                {renderChurnRateChart()}
              </div>
              <div className="chart-wrapper">
                {renderGenderChart()}
              </div>
            </div>
            <div className="chart-row">
              <div className="chart-wrapper">
                {renderTenureHistogram()}
              </div>
              <div className="chart-wrapper">
                {renderCityTierChart()}
              </div>
            </div>
            <div className="chart-row">
              <div className="chart-wrapper">
                {renderMaritalStatusChart()}
              </div>
              <div className="chart-wrapper">
                {renderSatisfactionChart()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Details Tab */}
      {activeTab === "customers" && (
        <div className="tab-content">
          <div className="section-card all-predictions">
            <div className="predictions-header">
              <h3>👥 All Customer Predictions ({totalCustomers} Total)</h3>
              <div className="predictions-controls">
                <div className="search-box">
                  <input
                    type="text"
                    placeholder="Search customers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                  />
                </div>
                <div className="pagination-controls">
                  <select 
                    value={itemsPerPage} 
                    onChange={handleItemsPerPageChange}
                    className="items-per-page-select"
                  >
                    <option value={20}>20 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                    <option value={200}>200 per page</option>
                  </select>
                  
                  <div className="pagination-info">
                    Showing {startIndex + 1}-{Math.min(endIndex, filteredPredictions.length)} of {filteredPredictions.length} customers
                  </div>
                  
                  <div className="pagination-buttons">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="pagination-btn"
                    >
                      Previous
                    </button>
                    <span className="page-info">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="pagination-btn"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="predictions-table-container">
              <div className="predictions-table">
                <table>
                  <thead>
                    <tr>
                      <th>Customer ID</th>
                      <th>Churn Probability</th>
                      <th>Risk Level</th>
                      <th>Prediction</th>
                      <th>Tenure</th>
                      <th>Order Count</th>
                      <th>Cashback</th>
                      <th>Days Since Last Order</th>
                      <th>Satisfaction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentPredictions.map((customer, index) => {
                      const riskLevel = customer.Risk_Level || 'Unknown';
                      const churnProbability = customer.Churn_Probability || 0;
                      
                      return (
                        <tr key={index}>
                          <td className="customer-id">
                            {customer.Customer_ID || customer.CustomerID || `CUST_${startIndex + index + 1}`}
                          </td>
                          <td>
                            <div className="probability-bar">
                              <div 
                                className="probability-fill"
                                style={{ width: `${churnProbability * 100}%` }}
                              ></div>
                              <span className="probability-text">
                                {(churnProbability * 100).toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className={`risk-badge ${riskLevel.toLowerCase().replace(' ', '-')}`}>
                              {riskLevel}
                            </span>
                          </td>
                          <td>
                            <span className={`prediction ${customer.Predicted_Churn ? 'churn' : 'no-churn'}`}>
                              {customer.Predicted_Churn ? "🚨 Churn" : "✅ Retain"}
                            </span>
                          </td>
                          <td>{customer.Tenure || 'N/A'}</td>
                          <td>{customer.OrderCount || 'N/A'}</td>
                          <td>₹{(customer.CashbackAmount || 0).toLocaleString()}</td>
                          <td>{customer.DaySinceLastOrder || 'N/A'}</td>
                          <td>
                            <div className="satisfaction-score">
                              {customer.SatisfactionScore || 'N/A'}
                              {customer.SatisfactionScore && (
                                <span className="score-stars">
                                  {'★'.repeat(customer.SatisfactionScore)}{'☆'.repeat(5 - customer.SatisfactionScore)}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {filteredPredictions.length === 0 && (
              <div className="no-results">
                <p>No customers found matching your search criteria.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Downloads Tab */}
      {activeTab === "downloads" && (
        <div className="tab-content">
          <div className="section-card download-section">
            <h3>📩 Download Reports</h3>
            
            {/* Complete Report Section */}
            <div className="download-main-section">
              <div className="download-option-full">
                <h4>📊 Complete Analysis Report</h4>
                <p>Download the <strong>complete dataset</strong> with predictions for <strong>ALL {totalCustomers} customers</strong>, including churn probabilities, risk levels, and personalized retention recommendations in CSV format.</p>
                <button className="download-btn primary download-all-btn" onClick={downloadAllCustomers}>
                  <span className="btn-icon">📩</span>
                  Download Complete Report (All {totalCustomers} Customers)
                </button>
              </div>
            </div>

            {/* Risk Categories Section - Under Complete Report */}
            <div className="risk-categories-section">
              <h4>📉 Download by Risk Level</h4>
              <p>Download specific customer segments based on their churn risk level:</p>
              
              <div className="risk-cards-horizontal">
                {/* High Risk Card */}
                <div className="risk-card-horizontal high-risk">
                  <div className="risk-card-header">
                    <span className="risk-icon">🚨</span>
                    <div className="risk-title-container">
                      <h5>High Risk Customers</h5>
                      <div className="customer-count-badge">
                        {highRiskCount} customers
                      </div>
                    </div>
                  </div>
                  <button 
                    className="download-btn compact high-risk-btn download-high-btn"
                    onClick={() => downloadRiskCustomers('high')}
                    disabled={highRiskCount === 0}
                  >
                    <span className="btn-icon">📩</span>
                    Download High Risk
                  </button>
                </div>

                {/* Medium Risk Card */}
                <div className="risk-card-horizontal medium-risk">
                  <div className="risk-card-header">
                    <span className="risk-icon">⚠️</span>
                    <div className="risk-title-container">
                      <h5>Medium Risk Customers</h5>
                      <div className="customer-count-badge">
                        {mediumRiskCount} customers
                      </div>
                    </div>
                  </div>
                  <button 
                    className="download-btn compact medium-risk-btn download-medium-btn"
                    onClick={() => downloadRiskCustomers('medium')}
                    disabled={mediumRiskCount === 0}
                  >
                    <span className="btn-icon">📩</span>
                    Download Medium Risk
                  </button>
                </div>

                {/* Low Risk Card */}
                <div className="risk-card-horizontal low-risk">
                  <div className="risk-card-header">
                    <span className="risk-icon">✅</span>
                    <div className="risk-title-container">
                      <h5>Low Risk Customers</h5>
                      <div className="customer-count-badge">
                        {lowRiskCount} customers
                      </div>
                    </div>
                  </div>
                  <button 
                    className="download-btn compact low-risk-btn download-low-btn"
                    onClick={() => downloadRiskCustomers('low')}
                    disabled={lowRiskCount === 0}
                  >
                    <span className="btn-icon">📩</span>
                    Download Low Risk
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input for re-upload */}
      <input
        type="file"
        accept=".csv"
        id="batch-file"
        style={{ display: 'none' }}
        onChange={() => {}} // Empty handler, just for file access
      />
    </div>
  );
}

export default BatchDashboard;
