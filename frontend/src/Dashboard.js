// Dashboard.js - Only overview display
import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import './Dashboard.css';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

function Dashboard({ dashboardData }) {
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    if (dashboardData && dashboardData.individualResult) {
      generateChartData();
    }
  }, [dashboardData]);

  const generateChartData = () => {
    const apiData = dashboardData.individualResult || {};
    const customerData = apiData.customer_data || {};
    
    // Get current customer values
    const satisfactionScore = customerData.SatisfactionScore || 3;
    const hasComplaint = customerData.Complain || 0;
    const tenure = customerData.Tenure || 5;
    const orderCount = customerData.OrderCount || 5;
    const churnProbability = apiData.probability || 0.5;

    // Calculate real-time data based on current customer profile
    const data = {
      // Chart 1: Current Customer Churn Probability (LEFT - PIE CHART)
      churnDistribution: {
        labels: ['Retention Probability', 'Churn Probability'],
        datasets: [
          {
            data: [
              Math.round((1 - churnProbability) * 100), // Retention %
              Math.round(churnProbability * 100) // Churn %
            ],
            backgroundColor: [
              '#10b981', // Green for retention
              '#ef4444'  // Red for churn
            ],
            borderColor: [
              '#059669',
              '#dc2626'
            ],
            borderWidth: 2,
          }
        ]
      },

      // Chart 2: Churn Rate by Complaint Status (RIGHT - BAR CHART)
      churnByComplaint: {
        labels: ['No Complaint', 'With Complaint'],
        datasets: [
          {
            label: 'Churn Probability',
            data: hasComplaint === 1 ? 
              [0, 0.85] : // If complaint, show only complaint bar
              [0.15, 0],  // If no complaint, show only no complaint bar
            backgroundColor: [
              hasComplaint === 0 ? 'rgba(16, 185, 129, 0.8)' : 'rgba(16, 185, 129, 0.2)',
              hasComplaint === 1 ? 'rgba(239, 68, 68, 0.8)' : 'rgba(239, 68, 68, 0.2)'
            ],
            borderColor: [
              '#10b981',
              '#ef4444'
            ],
            borderWidth: 1
          }
        ]
      },

      // Chart 3: Churn Rate by Satisfaction Score (RIGHT - BAR CHART)
      churnBySatisfaction: {
        labels: ['Score 1', 'Score 2', 'Score 3', 'Score 4', 'Score 5'],
        datasets: [
          {
            label: 'Churn Rate',
            data: [
              satisfactionScore === 1 ? 0.80 : 0,
              satisfactionScore === 2 ? 0.60 : 0,
              satisfactionScore === 3 ? 0.30 : 0,
              satisfactionScore === 4 ? 0.15 : 0,
              satisfactionScore === 5 ? 0.05 : 0
            ],
            backgroundColor: [
              satisfactionScore === 1 ? 'rgba(239, 68, 68, 0.8)' : 'rgba(239, 68, 68, 0.2)',
              satisfactionScore === 2 ? 'rgba(245, 158, 11, 0.8)' : 'rgba(245, 158, 11, 0.2)',
              satisfactionScore === 3 ? 'rgba(234, 179, 8, 0.8)' : 'rgba(234, 179, 8, 0.2)',
              satisfactionScore === 4 ? 'rgba(101, 163, 13, 0.8)' : 'rgba(101, 163, 13, 0.2)',
              satisfactionScore === 5 ? 'rgba(16, 185, 129, 0.8)' : 'rgba(16, 185, 129, 0.2)'
            ],
            borderColor: [
              '#ef4444',
              '#f59e0b',
              '#eab308',
              '#65a30d',
              '#10b981'
            ],
            borderWidth: 1
          }
        ]
      },

      // Chart 4: Tenure Duration vs Order Count (LEFT - BAR CHART)
      tenureVsOrders: {
        labels: ['Tenure (months)', 'Order Count'],
        datasets: [
          {
            label: 'Current Customer',
            data: [tenure, orderCount],
            backgroundColor: [
              'rgba(59, 130, 246, 0.8)',
              'rgba(16, 185, 129, 0.8)'
            ],
            borderColor: [
              '#3b82f6',
              '#10b981'
            ],
            borderWidth: 1
          }
        ]
      }
    };
    
    setChartData(data);
  };

  // Export Report Function
  const exportReport = () => {
    const apiData = dashboardData.individualResult || {};
    
    // Format the current date and time
    const now = new Date();
    const formattedDate = now.toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '');
    
    // Create report content WITHOUT Key Risk Drivers section
    const reportContent = `CUSTOMER CHURN RISK ANALYSIS REPORT
===================================
Generated: ${now.toLocaleString()}

EXECUTIVE SUMMARY
-----------------
• Churn Probability: ${analysisData.churnRisk}%
• Risk Level: ${analysisData.riskLevel.toUpperCase()}
• Potential Revenue Loss (Estimated): ${analysisData.businessImpact.potentialLoss}
• Primary Risk Factor: ${analysisData.executiveSummary.primaryRiskFactor}

RETENTION RECOMMENDATIONS
-------------------------
PRIORITY: ${analysisData.riskLevel.toUpperCase()}
${apiData.recommendations ? apiData.recommendations.map((rec, index) => 
  `${index + 1}. ${rec}`
).join('\n') : `1. Loyalty Reinforcement: Enroll in a tiered loyalty program or highlight existing status.
2. Proactive Value Communication: Use non-sales content (tips/guides) to maintain brand presence.
3. Advocacy & Growth: Offer incentives for referrals or reviews to generate brand advocacy.`}

BUSINESS IMPACT ANALYSIS
------------------------
• Estimated Customer Value: ${analysisData.businessImpact.estimatedCV}
• Recommended Retention Budget: ${analysisData.businessImpact.retentionBudget}
• ROI Potential: ${analysisData.businessImpact.roiPotential}

--- END OF REPORT`;

    // Create blob and download
    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customer_churn_report_${formattedDate}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!dashboardData) {
    return (
      <div className="dashboard">
        <div className="dashboard-header">
          <h2>Churn Analysis Dashboard</h2>
        </div>
        <div className="dashboard-placeholder">
          <div className="placeholder-content">
            <span className="placeholder-icon">🔍</span>
            <h3>No Analysis Data Available</h3>
            <p>Run a customer analysis to view insights and predictions</p>
          </div>
        </div>
      </div>
    );
  }

  // Extract data from API response
  const apiData = dashboardData.individualResult || {};
  const customerData = apiData.customer_data || {};
  
  // Function to determine primary risk factor based on customer data
  const getPrimaryRiskFactor = () => {
    // Check if API provides top driver
    if (apiData.top_driver && apiData.top_driver !== "general behavior") {
      return formatRiskFactorName(apiData.top_driver);
    }
    
    // If no top driver from API, calculate based on customer data
    const riskFactors = [];
    
    // Check tenure risk
    if (customerData.Tenure < 6) {
      riskFactors.push({ factor: 'Short Customer Tenure', severity: 'high' });
    } else if (customerData.Tenure < 12) {
      riskFactors.push({ factor: 'Medium Customer Tenure', severity: 'medium' });
    }
    
    // Check days since last order
    if (customerData.DaySinceLastOrder > 60) {
      riskFactors.push({ factor: 'Long Inactivity Period', severity: 'high' });
    } else if (customerData.DaySinceLastOrder > 30) {
      riskFactors.push({ factor: 'Recent Inactivity', severity: 'medium' });
    }
    
    // Check satisfaction score
    if (customerData.SatisfactionScore <= 2) {
      riskFactors.push({ factor: 'Low Satisfaction Score', severity: 'high' });
    } else if (customerData.SatisfactionScore === 3) {
      riskFactors.push({ factor: 'Average Satisfaction Score', severity: 'medium' });
    }
    
    // Check complaints
    if (customerData.Complain === 1) {
      riskFactors.push({ factor: 'Previous Complaints', severity: 'high' });
    }
    
    // Check order count
    if (customerData.OrderCount < 3) {
      riskFactors.push({ factor: 'Low Order Frequency', severity: 'medium' });
    }
    
    // Check cashback amount (low cashback might indicate low engagement)
    if (customerData.CashbackAmount < 50) {
      riskFactors.push({ factor: 'Low Reward Engagement', severity: 'medium' });
    }
    
    // Return the highest severity risk factor, or a default if none found
    if (riskFactors.length > 0) {
      // Sort by severity (high first, then medium)
      riskFactors.sort((a, b) => {
        const severityOrder = { high: 2, medium: 1, low: 0 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });
      return riskFactors[0].factor;
    }
    
    // Default fallback based on churn probability
    if (apiData.probability > 0.7) {
      return 'Multiple Risk Factors Combined';
    } else if (apiData.probability > 0.4) {
      return 'Moderate Behavioral Patterns';
    } else {
      return 'Standard Customer Profile';
    }
  };

  // Helper function to format risk factor names
  const formatRiskFactorName = (factor) => {
    const factorMap = {
      'tenure': 'Short Customer Tenure',
      'daysincelastorder': 'Recent Inactivity',
      'satisfactionscore': 'Low Satisfaction Level',
      'complain': 'Previous Customer Complaints',
      'cashbackamount': 'Low Reward Program Engagement',
      'ordercount': 'Infrequent Purchases',
      'warehousetohome': 'Long Delivery Distance',
      'hourspendonapp': 'Low App Engagement',
      'preferredlogindevice': 'Device Usage Pattern',
      'citytier': 'Geographic Location Factor'
    };
    
    return factorMap[factor.toLowerCase()] || factor;
  };

  // Enhanced data with dynamic values from API
  const analysisData = {
    churnRisk: Math.round((apiData.probability || 0.792) * 1000) / 10,
    retentionProbability: Math.round((1 - (apiData.probability || 0.792)) * 1000) / 10,
    riskLevel: apiData.risk_level || "high",
    confidence: 92,
    trend: "increasing",
    lastMonthComparison: 5.7,
    
    executiveSummary: {
      riskProbability: Math.round((apiData.probability || 0.792) * 1000) / 10,
      category: apiData.risk_level === "high" ? "critical" : apiData.risk_level === "medium" ? "monitoring" : "stable",
      riskLevel: apiData.risk_level === "high" ? "high immediate risk" : apiData.risk_level === "medium" ? "moderate risk" : "low immediate risk",
      recommendation: apiData.risk_level === "high" ? "immediate intervention required" : 
                     apiData.risk_level === "medium" ? "proactive monitoring recommended" : 
                     "proceeding directly to the action plan below",
      primaryRiskFactor: getPrimaryRiskFactor()
    },
    
    comparisonMetrics: {
      churnRisk: { 
        current: `${Math.round((apiData.probability || 0.792) * 1000) / 10}%`, 
        target: "<15%", 
        comparison: apiData.probability > 0.15 ? "Above Target" : "Below Target",
        value: Math.round((apiData.probability || 0.792) * 1000) / 10
      },
      tenure: { 
        current: `${apiData.customer_data?.Tenure || 3} mo`, 
        target: ">12 mo", 
        comparison: (apiData.customer_data?.Tenure || 3) > 12 ? "Above Target" : "Below Target",
        value: apiData.customer_data?.Tenure || 3
      },
      daysSinceOrder: { 
        current: `${apiData.customer_data?.DaySinceLastOrder || 25} d`, 
        target: "<7 d", 
        comparison: (apiData.customer_data?.DaySinceLastOrder || 25) > 7 ? "Above Target" : "Below Target",
        value: apiData.customer_data?.DaySinceLastOrder || 25
      },
      satisfaction: { 
        current: `${apiData.customer_data?.SatisfactionScore || 2}/5`, 
        target: ">4/5", 
        comparison: (apiData.customer_data?.SatisfactionScore || 2) > 4 ? "Above Target" : "Below Target",
        value: apiData.customer_data?.SatisfactionScore || 2
      }
    },
    
    businessImpact: apiData.business_impact ? {
      estimatedCV: `₹${Math.round(apiData.business_impact.estimated_clv || 18750).toLocaleString()}`,
      retentionBudget: `₹${Math.round(apiData.business_impact.retention_budget || 1250).toLocaleString()}`,
      potentialLoss: `₹${Math.round(apiData.business_impact.potential_revenue_loss || 4250).toLocaleString()}`,
      roiPotential: `${Math.round((apiData.business_impact.roi_retention || 3.4) * 10) / 10}x`
    } : {
      estimatedCV: "₹18,750",
      retentionBudget: "₹1,250",
      potentialLoss: "₹4,250",
      roiPotential: "3.4x"
    }
  };

  // Enhanced Churn Prediction Display Component with Gauge
  const ChurnPredictionDisplay = () => (
    <div className="churn-prediction-display">
      <div className="prediction-header">
        <h3>Churn Risk Prediction</h3>
      </div>
      
      <div className="prediction-main">
        {/* Main Risk Gauge */}
        <div className="risk-gauge-container">
          <div className="gauge-wrapper">
            <div className="risk-gauge">
              <div className="gauge-bg">
                <div className="gauge-sector safe"></div>
                <div className="gauge-sector warning"></div>
                <div className="gauge-sector critical"></div>
              </div>
              <div className="gauge-center">
                <div className="risk-percentage">{analysisData.churnRisk}%</div>
                <div className="risk-label">Churn Probability</div>
              </div>
            </div>
          </div>
          
          <div className="gauge-legend">
            <div className="legend-item">
              <div className="legend-color safe"></div>
              <span>Low (0-30%)</span>
            </div>
            <div className="legend-item">
              <div className="legend-color warning"></div>
              <span>Medium (31-70%)</span>
            </div>
            <div className="legend-item">
              <div className="legend-color critical"></div>
              <span>High (71-100%)</span>
            </div>
          </div>
        </div>

        {/* Risk Details */}
        <div className="risk-details">
          <div className="risk-status-card">
            <div className="status-header">
              <div className={`risk-badge ${analysisData.riskLevel}`}>
                {analysisData.riskLevel.toUpperCase()} RISK
              </div>
              <div className={`trend-indicator ${analysisData.trend}`}>
                {analysisData.trend === 'decreasing' ? '↘' : 
                 analysisData.trend === 'increasing' ? '↗' : '→'}
                <span>{Math.abs(analysisData.lastMonthComparison)}%</span>
              </div>
            </div>
            
            <div className="status-metrics">
              <div className="metric-comparison">
                <div className="comparison-item">
                  <span className="comparison-label">Churn Risk</span>
                  <span className="comparison-value current">{analysisData.churnRisk}%</span>
                  <div className="comparison-bar">
                    <div 
                      className="bar-fill risk" 
                      style={{ width: `${analysisData.churnRisk}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="comparison-item">
                  <span className="comparison-label">Retention Probability</span>
                  <span className="comparison-value positive">{analysisData.retentionProbability}%</span>
                  <div className="comparison-bar">
                    <div 
                      className="bar-fill retention" 
                      style={{ width: `${analysisData.retentionProbability}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Insights */}
          <div className="quick-insights">
            <h4>Quick Insights</h4>
            <div className="insights-grid">
              <div className={`insight-item ${analysisData.riskLevel === 'low' ? 'positive' : analysisData.riskLevel === 'medium' ? 'warning' : 'critical'}`}>
                <div className="insight-icon">
                  {analysisData.riskLevel === 'low' ? '✅' : analysisData.riskLevel === 'medium' ? '⚠️' : '🚨'}
                </div>
                <div className="insight-content">
                  <span className="insight-title">
                    {analysisData.riskLevel === 'low' ? 'Low Risk Category' : 
                     analysisData.riskLevel === 'medium' ? 'Medium Risk Category' : 
                     'High Risk Category'}
                  </span>
                  <span className="insight-desc">
                    {analysisData.riskLevel === 'low' ? 'Customer shows minimal churn signals' : 
                     analysisData.riskLevel === 'medium' ? 'Customer requires proactive monitoring' : 
                     'Immediate intervention recommended'}
                  </span>
                </div>
              </div>
              
              <div className="insight-item info">
                <div className="insight-icon">🎯</div>
                <div className="insight-content">
                  <span className="insight-title">Top Risk Driver</span>
                  <span className="insight-desc">{analysisData.executiveSummary.primaryRiskFactor}</span>
                </div>
              </div>
              
              <div className="insight-item positive">
                <div className="insight-icon">📊</div>
                <div className="insight-content">
                  <span className="insight-title">Retention Probability</span>
                  <span className="insight-desc">{analysisData.retentionProbability}% chance of retention</span>
                </div>
              </div>
              
              <div className="insight-item info">
                <div className="insight-icon">💰</div>
                <div className="insight-content">
                  <span className="insight-title">Recommended Budget</span>
                  <span className="insight-desc">{analysisData.businessImpact.retentionBudget}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Executive Overview Component
  const ExecutiveOverview = () => (
    <div className="analysis-section">
      <div className="section-header">
        <div className="section-icon">📋</div>
        <h3 className="section-title">Executive Overview</h3>
      </div>
      
      <div className="executive-content">
        <p className="executive-summary-text">
          This customer is currently evaluated at a <strong className="highlight-risk">{analysisData.executiveSummary.riskProbability}%</strong> churn probability 
          and is categorized as <strong className="highlight-category">{analysisData.executiveSummary.category}</strong> and poses a
          <strong className="highlight-level"> {analysisData.executiveSummary.riskLevel}</strong>. We recommend {analysisData.executiveSummary.recommendation}.
        </p>
      </div>
    </div>
  );

  // Performance Metrics Component
  const PerformanceMetrics = () => (
    <div className="analysis-section">
      <div className="section-header">
        <div className="section-icon">📊</div>
        <h3 className="section-title">Performance Metrics</h3>
      </div>
      
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-header">
            <h4 className="metric-title">Current Churn Risk</h4>
            <div className={`metric-trend ${analysisData.comparisonMetrics.churnRisk.comparison === 'Above Target' ? 'negative' : 'positive'}`}>
              {analysisData.comparisonMetrics.churnRisk.comparison === 'Above Target' ? '↑' : '↓'} {analysisData.comparisonMetrics.churnRisk.comparison}
            </div>
          </div>
          <div className="metric-value">{analysisData.comparisonMetrics.churnRisk.current}</div>
          <div className="metric-target">Target: {analysisData.comparisonMetrics.churnRisk.target}</div>
          <div className="metric-progress">
            <div className="progress-track">
              <div 
                className="progress-fill risk" 
                style={{ width: `${analysisData.comparisonMetrics.churnRisk.value}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <h4 className="metric-title">Customer Tenure</h4>
            <div className={`metric-trend ${analysisData.comparisonMetrics.tenure.comparison === 'Above Target' ? 'positive' : 'negative'}`}>
              {analysisData.comparisonMetrics.tenure.comparison === 'Above Target' ? '↑' : '↓'} {analysisData.comparisonMetrics.tenure.comparison}
            </div>
          </div>
          <div className="metric-value">{analysisData.comparisonMetrics.tenure.current}</div>
          <div className="metric-target">Target: {analysisData.comparisonMetrics.tenure.target}</div>
          <div className="metric-progress">
            <div className="progress-track">
              <div 
                className="progress-fill tenure" 
                style={{ width: `${Math.min((analysisData.comparisonMetrics.tenure.value / 12) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <h4 className="metric-title">Days Since Last Order</h4>
            <div className={`metric-trend ${analysisData.comparisonMetrics.daysSinceOrder.comparison === 'Above Target' ? 'negative' : 'positive'}`}>
              {analysisData.comparisonMetrics.daysSinceOrder.comparison === 'Above Target' ? '↑' : '↓'} {analysisData.comparisonMetrics.daysSinceOrder.comparison}
            </div>
          </div>
          <div className="metric-value">{analysisData.comparisonMetrics.daysSinceOrder.current}</div>
          <div className="metric-target">Target: {analysisData.comparisonMetrics.daysSinceOrder.target}</div>
          <div className="metric-progress">
            <div className="progress-track">
              <div 
                className="progress-fill days" 
                style={{ width: `${Math.min((analysisData.comparisonMetrics.daysSinceOrder.value / 30) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <h4 className="metric-title">Satisfaction Score</h4>
            <div className={`metric-trend ${analysisData.comparisonMetrics.satisfaction.comparison === 'Above Target' ? 'positive' : 'negative'}`}>
              {analysisData.comparisonMetrics.satisfaction.comparison === 'Above Target' ? '↑' : '↓'} {analysisData.comparisonMetrics.satisfaction.comparison}
            </div>
          </div>
          <div className="metric-value">{analysisData.comparisonMetrics.satisfaction.current}</div>
          <div className="metric-target">Target: {analysisData.comparisonMetrics.satisfaction.target}</div>
          <div className="metric-progress">
            <div className="progress-track">
              <div 
                className="progress-fill satisfaction" 
                style={{ width: `${(analysisData.comparisonMetrics.satisfaction.value / 5) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Business Impact Analysis Component
  const BusinessImpactAnalysis = () => (
    <div className="analysis-section">
      <div className="section-header">
        <div className="section-icon">💼</div>
        <h3 className="section-title">Business Impact Analysis</h3>
      </div>
      
      <div className="impact-grid">
        <div className="impact-card">
          <div className="impact-icon">💰</div>
          <div className="impact-content">
            <div className="impact-value">{analysisData.businessImpact.estimatedCV}</div>
            <div className="impact-label">Estimated Customer Value</div>
          </div>
        </div>
        
        <div className="impact-card">
          <div className="impact-icon">🛡️</div>
          <div className="impact-content">
            <div className="impact-value">{analysisData.businessImpact.retentionBudget}</div>
            <div className="impact-label">Retention Budget</div>
          </div>
        </div>
        
        <div className="impact-card warning">
          <div className="impact-icon">⚠️</div>
          <div className="impact-content">
            <div className="impact-value">{analysisData.businessImpact.potentialLoss}</div>
            <div className="impact-label">Potential Loss</div>
          </div>
        </div>
        
        <div className="impact-card highlight">
          <div className="impact-icon">📈</div>
          <div className="impact-content">
            <div className="impact-value">{analysisData.businessImpact.roiPotential}</div>
            <div className="impact-label">ROI Potential</div>
          </div>
        </div>
      </div>
    </div>
  );

  // Combined Churn Risk Analysis Report Card
  const ChurnRiskAnalysisReport = () => (
    <div className="churn-risk-analysis-report">
      <div className="report-header">
        <h1 className="report-main-title">Churn Risk Analysis Report</h1>
        <div className="risk-tag-enhanced">
          <span className="risk-level-badge-large">{analysisData.riskLevel.toUpperCase()} RISK</span>
          <span className="risk-percentage-display">({analysisData.churnRisk}%)</span>
          <span className="risk-factor">Primary risk factor identified as {analysisData.executiveSummary.primaryRiskFactor}.</span>
        </div>
      </div>
      
      <div className="report-content">
        <ExecutiveOverview />
        <PerformanceMetrics />
        <BusinessImpactAnalysis />
      </div>
    </div>
  );

  // Simple Recommendations Component
  const Recommendations = () => (
    <div className="recommendations-simple">
      <div className="section-header">
        <div className="section-icon">🎯</div>
        <h2 className="section-title">Recommended Actions</h2>
      </div>
      <div className="recommendations-list">
        {apiData.recommendations && apiData.recommendations.map((rec, index) => (
          <div key={index} className="recommendation-item">
            <div className="recommendation-number">{index + 1}</div>
            <div className="recommendation-text">{rec}</div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="header-main">
          <h2>Churn Analysis Dashboard</h2>
        </div>
        <div className="header-actions">
          <button className="btn secondary" onClick={exportReport}>Export Report</button>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="overview-tab-enhanced">
          {/* Churn Risk Prediction with Gauge */}
          <ChurnPredictionDisplay />

          {/* Combined Churn Risk Analysis Report Card */}
          <ChurnRiskAnalysisReport />

          {/* Recommendations */}
          {apiData.recommendations && <Recommendations />}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;