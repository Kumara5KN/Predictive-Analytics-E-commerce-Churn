from flask import Flask, request, jsonify, send_from_directory, make_response
from flask_cors import CORS
import pandas as pd
import numpy as np
import pickle
import os
from datetime import datetime
import warnings
import xgboost as xgb
import sys
import io
import base64
from sklearn.impute import SimpleImputer

# Suppress warnings
warnings.simplefilter(action='ignore', category=FutureWarning)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# ==============================================================================
# CONSTANTS AND CONFIGURATION
# ==============================================================================

BENCHMARK_PROFILE = {
    'Tenure (Months)': 9,
    'Cashback Amount (₹)': 12000,
    'Days Since Last Order': 5,
    'Satisfaction Score': 4,
    'Warehouse Distance (km)': 10,
}

RISK_DIRECTIONS = {
    'Tenure (Months)': -1,
    'Cashback Amount (₹)': -1,
    'Days Since Last Order': 1,
    'Satisfaction Score': -1,
    'Warehouse Distance (km)': 1,
}

BENCHMARK_TOTAL_ORDERS = 8
BENCHMARK_MAX_INACTIVITY = 30

# Initialize model and features as None/empty
model = None
feature_names = []
feature_importances = None

# Initialize with default imputation values
imputation_values = {
    'numeric_mean': {},
    'numeric_median': {},
    'categorical_mode': {}
}

# ==============================================================================
# MODEL LOADING (STRICT MODE: Exits if model fails to load)
# ==============================================================================

def load_artifacts():
    """Load model and feature names. Exits application on critical failure."""
    default_feature_names = [
        'Tenure', 'CityTier', 'WarehouseToHome', 'HourSpendOnApp', 'SatisfactionScore',
        'Complain', 'OrderAmountHikeFromlastYear', 'CouponUsed', 'OrderCount',
        'DaySinceLastOrder', 'CashbackAmount', 'NumberOfDeviceRegistered',
        'NumberOfAddress', 'OrderFrequency', 'EngagementIntensity', 'ValueScore',
        'PreferredLoginDevice_Mobile Phone', 'Gender_Male', 'MaritalStatus_Married',
        'PreferredPaymentMode_Credit Card', 'PreferedOrderCat_Laptop & Accessory',
        'CustomerSegment_Established', 'HighRecencyFlag', 'LowSatisfactionFlag',
        'ComplaintFlag'
    ]

    ARTIFACTS_FOLDER = 'Artifacts'
    model_path = os.path.join(ARTIFACTS_FOLDER, 'best_rf_xgb_cat_ensemble.pkl')
    features_path = os.path.join(ARTIFACTS_FOLDER, 'feature_names.pkl')

    model_local = None
    feature_names_local = default_feature_names
    simulated_importances_local = None

    # --- 1. Load Feature Names ---
    if os.path.exists(features_path):
        try:
            with open(features_path, 'rb') as ff:
                feature_names_local = pickle.load(ff)
            print(f"✅ Feature names loaded: {len(feature_names_local)} features")
        except Exception as e:
            print(f"❌ CRITICAL ERROR: Failed to load feature names file: {e}")
            sys.exit(1)

    # --- 2. Load ML Model (Mandatory) ---
    if os.path.exists(model_path):
        try:
            print(f"🔍 Attempting to load model from: {model_path}")
            with open(model_path, 'rb') as mf:
                model_local = pickle.load(mf)
            print(f"✅ Model loaded successfully. Model type: {type(model_local)}")

            if hasattr(model_local, '__class__') and 'XGB' in str(model_local.__class__):
                if hasattr(model_local, 'use_label_encoder'):
                    model_local.use_label_encoder = False

            return model_local, feature_names_local, simulated_importances_local

        except Exception as e:
            print(f"❌ CRITICAL ERROR: Failed to load ML model from {model_path}. Dependency issue likely: {e}")
            print("🛑 The application cannot run without the model. Exiting.")
            sys.exit(1)
    else:
        print(f"❌ CRITICAL ERROR: Model file not found at: {model_path}")
        print("🛑 The application cannot run without the model. Exiting.")
        sys.exit(1)

def initialize_default_imputation_values():
    """Initialize default imputation values for common features"""
    global imputation_values
    
    # Default values based on typical e-commerce customer data
    default_values = {
        'Tenure': 12,                    # 1 year average
        'OrderCount': 8,                 # BENCHMARK_TOTAL_ORDERS
        'CashbackAmount': 5000,          # Moderate cashback
        'DaySinceLastOrder': 15,         # 2 weeks average
        'HourSpendOnApp': 45,            # Moderate app usage
        'OrderAmountHikeFromlastYear': 15, # Typical growth
        'CouponUsed': 2,                 # Average coupon usage
        'NumberOfDeviceRegistered': 2,   # Typical device count
        'SatisfactionScore': 4,          # Good satisfaction
        'WarehouseToHome': 15,           # Average distance
        'NumberOfAddress': 3,            # Typical address count
        'CityTier': 2,                   # Average city tier
        'Complain': 0                    # Most customers don't complain
    }
    
    # Set both mean and median to same defaults for initialization
    for key, value in default_values.items():
        imputation_values['numeric_mean'][key] = value
        imputation_values['numeric_median'][key] = value
    
    # Default categorical values
    categorical_defaults = {
        'PreferredLoginDevice': 'Mobile Phone',
        'PreferredPaymentMode': 'Credit Card',
        'PreferedOrderCat': 'Laptop & Accessory',
        'Gender': 'Male',
        'MaritalStatus': 'Single',
        'CustomerSegment': 'Active_New'
    }
    
    for key, value in categorical_defaults.items():
        imputation_values['categorical_mode'][key] = value
    
    print("✅ Default imputation values initialized")

# Load model at startup
try:
    model, feature_names, feature_importances = load_artifacts()
    model_available = model is not None
    
    # Initialize default imputation values based on typical data ranges
    initialize_default_imputation_values()
    
except SystemExit:
    model = None
    model_available = False

# ==============================================================================
# ENHANCED IMPUTATION FUNCTIONS WITH ML PREDICTION FOR MISSING VALUES
# ==============================================================================

def calculate_imputation_values(df):
    """Calculate mean/median/mode for all columns for consistent imputation"""
    global imputation_values
    
    print("📊 Calculating imputation values from dataset...")
    
    # Numeric columns - use median for robust imputation
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    for col in numeric_cols:
        if df[col].notna().sum() > 0:  # Only if we have valid data
            imputation_values['numeric_median'][col] = df[col].median()
            imputation_values['numeric_mean'][col] = df[col].mean()
            print(f"   - {col}: median={df[col].median():.2f}, mean={df[col].mean():.2f}")
        else:
            # If all values are NaN, use default
            default_val = imputation_values['numeric_median'].get(col, 0)
            imputation_values['numeric_median'][col] = default_val
            imputation_values['numeric_mean'][col] = default_val
            print(f"   - {col}: ALL NaN, using default={default_val}")
    
    # Categorical columns - use mode
    categorical_cols = df.select_dtypes(include=['object', 'category']).columns
    for col in categorical_cols:
        if df[col].notna().sum() > 0:  # Only if we have valid data
            mode_values = df[col].mode()
            if len(mode_values) > 0:
                imputation_values['categorical_mode'][col] = mode_values[0]
                print(f"   - {col}: mode='{mode_values[0]}'")
        else:
            # If all values are NaN, use default
            default_val = imputation_values['categorical_mode'].get(col, 'Missing')
            imputation_values['categorical_mode'][col] = default_val
            print(f"   - {col}: ALL NaN, using default='{default_val}'")
    
    print("✅ Imputation values calculated from dataset")
    return imputation_values

def predict_missing_values_ml(df, target_column):
    """
    Use ML model to predict missing values for important features
    This is a simplified version - in production you'd train separate models
    """
    df_pred = df.copy()
    
    # For critical features, use more sophisticated imputation
    critical_features = ['CashbackAmount', 'OrderCount', 'Tenure', 'SatisfactionScore']
    
    for feature in critical_features:
        if feature in df_pred.columns and df_pred[feature].isna().sum() > 0:
            print(f"🤖 Using ML-based imputation for {feature}")
            
            # Simple rule-based prediction based on correlations
            if feature == 'CashbackAmount':
                # Predict cashback based on order count and tenure
                if 'OrderCount' in df_pred.columns and 'Tenure' in df_pred.columns:
                    avg_order_value = 850
                    df_pred[feature] = df_pred[feature].fillna(
                        df_pred['OrderCount'] * avg_order_value * 0.1  # 10% cashback assumption
                    )
            
            elif feature == 'OrderCount':
                # Predict order count based on tenure
                if 'Tenure' in df_pred.columns:
                    df_pred[feature] = df_pred[feature].fillna(
                        np.maximum(1, df_pred['Tenure'] / 3)  # Rough estimate
                    )
            
            elif feature == 'SatisfactionScore':
                # Predict satisfaction based on complain and recent activity
                if 'Complain' in df_pred.columns and 'DaySinceLastOrder' in df_pred.columns:
                    df_pred[feature] = df_pred[feature].fillna(
                        np.where(df_pred['Complain'] == 1, 2, 
                                np.where(df_pred['DaySinceLastOrder'] > 30, 3, 4))
                    )
    
    return df_pred

def smart_impute_dataframe(df, imputation_strategy='median', use_ml_prediction=True):
    """
    Enhanced smart imputation using ML best practices with prediction capabilities
    """
    df_imputed = df.copy()
    
    # First, use ML to predict critical missing values
    if use_ml_prediction:
        df_imputed = predict_missing_values_ml(df_imputed, 'CashbackAmount')
    
    # Handle numeric columns with comprehensive imputation
    numeric_cols = df_imputed.select_dtypes(include=[np.number]).columns
    
    for col in numeric_cols:
        if df_imputed[col].isna().sum() > 0:
            nan_count = df_imputed[col].isna().sum()
            print(f"🔧 Imputing {nan_count} NaN values in {col}")
            
            if imputation_strategy == 'mean' and col in imputation_values['numeric_mean']:
                fill_value = imputation_values['numeric_mean'][col]
                method = 'mean'
            elif imputation_strategy == 'median' and col in imputation_values['numeric_median']:
                fill_value = imputation_values['numeric_median'][col]
                method = 'median'
            else:
                # Fallback: use column median or default
                if df_imputed[col].notna().sum() > 0:
                    fill_value = df_imputed[col].median()
                    method = 'median (fallback)'
                else:
                    fill_value = imputation_values['numeric_median'].get(col, 0)
                    method = 'default'
            
            df_imputed[col] = df_imputed[col].fillna(fill_value)
            print(f"   → Filled {nan_count} values with {method}: {fill_value:.2f}")

    # Handle categorical columns
    categorical_cols = df_imputed.select_dtypes(include=['object', 'category']).columns
    for col in categorical_cols:
        if df_imputed[col].isna().sum() > 0:
            nan_count = df_imputed[col].isna().sum()
            print(f"🔧 Imputing {nan_count} NaN values in {col}")
            
            if col in imputation_values['categorical_mode']:
                fill_value = imputation_values['categorical_mode'][col]
                method = 'mode'
            else:
                fill_value = 'Unknown'
                method = 'unknown'
            
            df_imputed[col] = df_imputed[col].fillna(fill_value)
            print(f"   → Filled {nan_count} values with {method}: '{fill_value}'")

    # Final check: ensure no NaN values remain
    remaining_nans = df_imputed.isna().sum().sum()
    if remaining_nans > 0:
        print(f"⚠️  Warning: {remaining_nans} NaN values still remain after imputation")
        # Fill any remaining NaNs with appropriate defaults
        df_imputed = df_imputed.fillna(0)  # For numeric
        for col in categorical_cols:
            if col in df_imputed.columns:
                df_imputed[col] = df_imputed[col].fillna('Unknown')

    return df_imputed

def clean_nan_values_ml(data, imputation_strategy='median'):
    """Enhanced NaN cleaning with better prediction for missing values"""
    if isinstance(data, dict):
        cleaned = data.copy()
        
        # For single prediction, use global imputation values with prediction logic
        for key, value in data.items():
            if pd.isna(value) or value is None or value == '':
                if key in imputation_values['numeric_median']:
                    if imputation_strategy == 'mean':
                        fill_value = imputation_values['numeric_mean'][key]
                    else:
                        fill_value = imputation_values['numeric_median'][key]
                    
                    # Apply simple prediction logic for critical features
                    if key == 'CashbackAmount' and 'OrderCount' in cleaned:
                        if not pd.isna(cleaned.get('OrderCount')):
                            fill_value = max(fill_value, cleaned['OrderCount'] * 85)  # Predict based on orders
                    
                    cleaned[key] = fill_value
                    print(f"🔧 Imputed {key} with {imputation_strategy}: {fill_value:.2f}")
                    
                elif key in imputation_values['categorical_mode']:
                    fill_value = imputation_values['categorical_mode'][key]
                    cleaned[key] = fill_value
                    print(f"🔧 Imputed {key} with mode: {fill_value}")
                    
                else:
                    # Enhanced fallback with prediction logic
                    if any(x in key.lower() for x in ['tenure', 'count', 'number', 'amount']):
                        # Predict based on related features if available
                        if 'OrderCount' in key.lower() and 'Tenure' in cleaned:
                            if not pd.isna(cleaned.get('Tenure')):
                                cleaned[key] = max(1, cleaned['Tenure'] / 4)  # Predict orders from tenure
                            else:
                                cleaned[key] = 8  # Default
                        else:
                            cleaned[key] = 0
                    elif 'score' in key.lower():
                        cleaned[key] = 3  # Neutral score
                    elif 'complain' in key.lower():
                        cleaned[key] = 0  # No complaints by default
                    else:
                        cleaned[key] = 0
                    print(f"🔧 Imputed {key} with enhanced fallback: {cleaned[key]}")
        return cleaned
    
    elif isinstance(data, pd.DataFrame):
        return smart_impute_dataframe(data, imputation_strategy)
    
    return data

def validate_input_data(input_data):
    """Enhanced validation with better NaN handling"""
    errors = []
    
    # Clean NaN values first using enhanced ML imputation
    cleaned_data = clean_nan_values_ml(input_data)
    
    # Extract values with safe defaults
    tenure = cleaned_data.get('Tenure', 0) or 0
    day_since_last = cleaned_data.get('DaySinceLastOrder', 0) or 0
    cashback = cleaned_data.get('CashbackAmount', 0) or 0
    order_count = cleaned_data.get('OrderCount', 0) or 0
    satisfaction = cleaned_data.get('SatisfactionScore', 3) or 3
    
    # Enhanced validation with better error messages
    if tenure > 200:
        errors.append("Tenure seems unusually high (max 200 months expected)")
    if tenure < 0:
        errors.append("Tenure cannot be negative")
    if day_since_last > 365:
        errors.append("Last order over 1 year ago - please verify data")
    if day_since_last < 0:
        errors.append("Days since last order cannot be negative")
    if cashback > 100000:
        errors.append("Cashback amount seems unusually high")
    if cashback < 0:
        errors.append("Cashback amount cannot be negative")
    if order_count == 0 and cashback > 0:
        errors.append("Cashback without orders - data inconsistency")
    if satisfaction < 1 or satisfaction > 5:
        errors.append("Satisfaction score must be between 1 and 5")
    
    return errors, cleaned_data

# ==============================================================================
# ENHANCED BATCH PROCESSING WITH BETTER IMPUTATION
# ==============================================================================

def process_batch_dataframe(df):
    """
    Enhanced batch processing with comprehensive data cleaning and imputation
    """
    print(f"🔄 Processing batch dataframe with {len(df)} rows, {len(df.columns)} columns")
    
    # Create a copy to avoid modifying original
    processed_df = df.copy()
    
    # Calculate imputation values from THIS dataset
    calculate_imputation_values(processed_df)
    
    # Enhanced cleaning: handle various NaN representations
    processed_df = processed_df.replace([np.inf, -np.inf], np.nan)
    processed_df = processed_df.fillna(np.nan)  # Ensure all nulls are NaN
    
    # Convert numeric columns properly
    numeric_columns = processed_df.select_dtypes(include=[np.number]).columns
    for col in numeric_columns:
        processed_df[col] = pd.to_numeric(processed_df[col], errors='coerce')
    
    # Apply enhanced ML imputation
    processed_df = clean_nan_values_ml(processed_df, 'median')
    
    # Final validation: ensure no NaN values
    nan_summary = processed_df.isna().sum()
    if nan_summary.sum() > 0:
        print(f"⚠️  Final NaN check: {nan_summary.sum()} NaN values remaining")
        for col, count in nan_summary.items():
            if count > 0:
                print(f"   - {col}: {count} NaN values")
        # Fill any remaining NaNs
        processed_df = processed_df.fillna(0)
    
    print(f"✅ Batch processing complete. Final shape: {processed_df.shape}")
    return processed_df

# ==============================================================================
# EXISTING HELPER FUNCTIONS (UPDATED TO USE ENHANCED IMPUTATION)
# ==============================================================================

def create_business_features(df):
    """Create additional business-relevant features with safe operations"""
    df = df.copy()

    # First clean all NaN values using enhanced ML imputation
    df = clean_nan_values_ml(df, 'median')

    # Safe feature engineering with bounds checking
    for col in ['CashbackAmount', 'OrderCount', 'Tenure', 'HourSpendOnApp', 'DaySinceLastOrder', 'SatisfactionScore', 'Complain']:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
            # Re-impute any new NaN created by conversion
            if df[col].isna().sum() > 0:
                df[col] = df[col].fillna(imputation_values['numeric_median'].get(col, 0))

    # Ensure OrderCount has minimum value of 1 for division safety
    df['OrderCount'] = df['OrderCount'].clip(lower=1)
    df['Tenure'] = df['Tenure'].clip(lower=0)
    df['DaySinceLastOrder'] = df['DaySinceLastOrder'].clip(lower=0)

    # Safe feature calculations with bounds
    df['ValueScore'] = (df['CashbackAmount'] * df['OrderCount']) / (df['Tenure'] + 1)
    df['EngagementIntensity'] = np.where(
        df['DaySinceLastOrder'] > 0,
        df['HourSpendOnApp'] / df['DaySinceLastOrder'],
        df['HourSpendOnApp']  # If no days since last order, use raw hours
    )
    df['CashbackPerOrder'] = df['CashbackAmount'] / df['OrderCount']
    df['OrderFrequency'] = np.where(
        df['OrderCount'] > 0,
        df['Tenure'] / df['OrderCount'],
        0  # If no orders, frequency is 0
    )
    
    # Binary flags
    df['HighRecencyFlag'] = (df['DaySinceLastOrder'] > 30).astype(int)
    df['LowSatisfactionFlag'] = (df['SatisfactionScore'] <= 2).astype(int)
    df['ComplaintFlag'] = (df['Complain'] == 1).astype(int)

    # Customer segmentation
    if 'Tenure' in df.columns and 'OrderCount' in df.columns:
        df['CustomerSegment'] = np.where(
            df['Tenure'] > 12, 'Established',
            np.where(df['OrderCount'] > 10, 'Active_New', 'New_LowEngagement')
        ).astype(str)
    else:
        df['CustomerSegment'] = 'Unknown'

    # Clean any new NaN created during feature engineering
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    df[numeric_cols] = df[numeric_cols].fillna(0)
    
    return df

def safe_model_predict(model, X):
    """Prediction method that handles different model types, fails if model is null."""
    if model is None:
        raise ValueError("ML Model is not loaded. Cannot perform prediction.")

    try:
        if hasattr(model, 'predict_proba'):
            preds = model.predict(X)
            probs = model.predict_proba(X)[:, 1]
            return preds, probs
        else:
            preds = model.predict(X)
            probs = np.array([0.9 if pred == 1 else 0.1 for pred in preds])
            return preds, probs
    except Exception as e:
        print(f"⚠️ Model prediction failed during execution: {e}")
        raise

def align_and_predict(input_df, model, feature_names):
    """Make predictions on input data - Fails if model is None."""
    if model is None:
        print("❌ Prediction attempt failed: Model is not loaded.")
        raise ValueError("Model artifact is unavailable.")

    try:
        df = input_df.copy()
        df = create_business_features(df)

        categorical_cols = ['PreferredLoginDevice', 'Gender', 'MaritalStatus', 'PreferredPaymentMode', 'PreferedOrderCat', 'CustomerSegment']
        for c in categorical_cols:
            if c not in df.columns:
                df[c] = 'Missing'
            else:
                df[c] = df[c].fillna('Missing').astype('category')

        if 'Complain' in df.columns:
            df['Complain'] = df['Complain'].astype('category')

        df_encoded = pd.get_dummies(df, columns=categorical_cols, drop_first=True, dtype=int)
        final_df = pd.DataFrame(0, index=df_encoded.index, columns=feature_names)
        for col in final_df.columns:
            if col in df_encoded.columns:
                final_df[col] = df_encoded[col]

        X = final_df.values

        preds, probs = safe_model_predict(model, X)
        return preds, probs

    except Exception as e:
        print(f"❌ Prediction pipeline failed: {e}")
        raise

def calculate_business_impact(prediction_prob, customer_profile, input_data):
    """Calculate business impact of churn risk in Indian Rupees"""
    avg_order_value_inr = 850
    order_count = input_data.get('OrderCount', 1)
    cashback_amount = input_data.get('CashbackAmount', 0)
    clv = (order_count * avg_order_value_inr) + cashback_amount
    retention_cost_multiplier = {'low': 0.05, 'medium': 0.15, 'high': 0.25}

    if prediction_prob < 0.3:
        risk_level = 'low'
    elif prediction_prob < 0.7:
        risk_level = 'medium'
    else:
        risk_level = 'high'

    recommended_retention_budget = clv * retention_cost_multiplier[risk_level]
    potential_loss = clv * prediction_prob
    roi = (potential_loss - recommended_retention_budget) / recommended_retention_budget if recommended_retention_budget > 0 else 0

    return {
        'estimated_clv': clv,
        'risk_level': risk_level,
        'retention_budget': recommended_retention_budget,
        'potential_revenue_loss': potential_loss,
        'roi_retention': roi
    }

def feature_contribution_approx(input_dict, importances, top_n=10):
    """Calculate approximate feature contributions (Requires feature_importances object to be loaded)"""
    if importances is None:
        return pd.DataFrame(columns=['Feature', 'Contribution', 'Type']).to_dict('records')

    imp = importances.copy().head(30)
    rows = []

    for feat, impv in imp.items():
        found_val = 1
        for k, v in input_dict.items():
            if k.lower().replace(' ', '') in feat.lower().replace('_', '').replace(' ', ''):
                try:
                    found_val = float(v)
                except Exception:
                    found_val = 1
                break

        multiplier = 1
        if 'DaySinceLastOrder' in feat and found_val > BENCHMARK_PROFILE['Days Since Last Order']:
            multiplier = found_val / BENCHMARK_PROFILE['Days Since Last Order']
        elif 'Tenure' in feat and found_val < BENCHMARK_PROFILE['Tenure (Months)']:
            multiplier = 1 + (BENCHMARK_PROFILE['Tenure (Months)'] - found_val) / BENCHMARK_PROFILE['Tenure (Months)']
        elif 'SatisfactionScore' in feat and found_val < BENCHMARK_PROFILE['Satisfaction Score']:
            multiplier = 1 + (BENCHMARK_PROFILE['Satisfaction Score'] - found_val) * 0.5
        elif 'CashbackAmount' in feat and found_val < BENCHMARK_PROFILE['Cashback Amount (₹)']:
            multiplier = 1 + (BENCHMARK_PROFILE['Cashback Amount (₹)'] - found_val) / BENCHMARK_PROFILE['Cashback Amount (₹)']

        final_contribution = impv * max(0.1, multiplier)
        rows.append({'Feature': feat.replace('_', ' ').title(), 'Contribution': final_contribution})

    df = pd.DataFrame(rows).sort_values('Contribution', ascending=False).head(top_n).reset_index(drop=True)

    if df['Contribution'].sum() > 0:
        df['Contribution'] = df['Contribution'] / df['Contribution'].sum()

    df['Type'] = 'Contributing Factor'
    if len(df) > 0:
        df.loc[0:2, 'Type'] = 'Top Risk Driver'
    if len(df) > 5:
        df.loc[len(df) - 3:, 'Type'] = 'Mitigating Factor'

    return df.to_dict('records')

def get_retention_recommendations(prediction, probability):
    """Generates simple, accurate retention recommendations"""
    if probability < 0.3:
        return [
            "Loyalty Reinforcement: Enroll in a tiered loyalty program or highlight existing status.",
            "Proactive Value Communication: Use non-sales content (tips/guides) to maintain brand presence.",
            "Advocacy & Growth: Offer incentives for referrals or reviews to generate brand advocacy."
        ]
    elif probability < 0.7:
        return [
            "Timed Intervention: Deploy a high-value, exclusive discount/bonus offer within 7 days.",
            "Friction Removal: Focus surveys on pain points (payments/app) for immediate system fixes.",
            "Personalization: Send product recommendations based on purchase history to drive repeat visits."
        ]
    else:
        return [
            "Critical 1:1 Outreach: Initiate executive-level, high-touch contact (call/VIP chat) within 24 hours.",
            "Premium Incentives: Offer a premium, non-monetary incentive (e.g., free upgrade) to stabilize the customer.",
            "Root Cause Analysis: Immediately analyze past 3 interactions to resolve specific dissatisfaction causes."
        ]

def analyze_batch_results(df_with_predictions):
    """Comprehensive analysis of batch prediction results"""
    total_customers = len(df_with_predictions)
    
    # Create a copy for calculations to avoid modifying original
    df_calc = df_with_predictions.copy()
    
    # Ensure Predicted_Churn is numeric for calculations
    if 'Predicted_Churn' in df_calc.columns:
        df_calc['Predicted_Churn'] = pd.to_numeric(df_calc['Predicted_Churn'], errors='coerce').fillna(0)
    
    # Risk distribution
    risk_counts = {
        'P1: High Risk (>70%)': len(df_calc[df_calc['Churn_Probability'] > 0.7]),
        'P2: Moderate Risk (31-70%)': len(df_calc[(df_calc['Churn_Probability'] > 0.3) & (df_calc['Churn_Probability'] <= 0.7)]),
        'P3: Low Risk (<=30%)': len(df_calc[df_calc['Churn_Probability'] <= 0.3])
    }
    
    # Overall metrics
    avg_probability = df_calc['Churn_Probability'].mean()
    total_predicted_churn = df_calc['Predicted_Churn'].sum()
    churn_rate = total_predicted_churn / total_customers if total_customers > 0 else 0
    
    # Feature analysis for high-risk customers
    high_risk_customers = df_calc[df_calc['Churn_Probability'] > 0.7]
    
    feature_analysis = {}
    if len(high_risk_customers) > 0:
        numeric_features = ['Tenure', 'CashbackAmount', 'DaySinceLastOrder', 'SatisfactionScore', 'OrderCount']
        for feature in numeric_features:
            if feature in high_risk_customers.columns:
                feature_analysis[feature] = {
                    'mean': float(high_risk_customers[feature].mean()),
                    'median': float(high_risk_customers[feature].median()),
                    'std': float(high_risk_customers[feature].std())
                }
    
    # Customer segmentation analysis
    segmentation = {
        'high_risk_count': len(high_risk_customers),
        'high_risk_avg_probability': float(high_risk_customers['Churn_Probability'].mean()) if len(high_risk_customers) > 0 else 0,
        'total_potential_loss': float(high_risk_customers['Churn_Probability'].sum() * 850) if len(high_risk_customers) > 0 else 0
    }
    
    # Enhanced: Ensure all predictions have proper values (no NaN)
    all_predictions_clean = df_with_predictions.replace({np.nan: None}).to_dict('records')
    
    # Additional check: replace any remaining None values with appropriate defaults
    for prediction in all_predictions_clean:
        for key, value in prediction.items():
            if value is None:
                if any(x in key.lower() for x in ['tenure', 'count', 'number', 'amount']):
                    prediction[key] = 0
                elif 'probability' in key.lower():
                    prediction[key] = 0.0
                elif 'score' in key.lower():
                    prediction[key] = 3
                else:
                    prediction[key] = ''
    
    return {
        'total_customers': total_customers,
        'risk_distribution': risk_counts,
        'average_probability': float(avg_probability),
        'churn_rate': float(churn_rate),
        'total_predicted_churn': int(total_predicted_churn),
        'feature_analysis': feature_analysis,
        'segmentation': segmentation,
        'all_predictions': all_predictions_clean  # Return ALL predictions with cleaned values
    }

# ==============================================================================
# ENHANCED DOWNLOAD FUNCTIONALITY WITH BETTER DATA HANDLING
# ==============================================================================

def generate_comprehensive_report(df_with_predictions):
    """Generate a comprehensive report with summary statistics"""
    
    # Create a copy for calculations
    df_calc = df_with_predictions.copy()
    
    # Ensure Predicted_Churn is numeric for calculations
    if 'Predicted_Churn' in df_calc.columns:
        # Convert "Yes"/"No" to 1/0 if needed
        if df_calc['Predicted_Churn'].dtype == 'object':
            df_calc['Predicted_Churn'] = df_calc['Predicted_Churn'].map({'Yes': 1, 'No': 0, 'yes': 1, 'no': 0}).fillna(0)
        df_calc['Predicted_Churn'] = pd.to_numeric(df_calc['Predicted_Churn'], errors='coerce').fillna(0)
    
    # Calculate summary statistics
    total_customers = len(df_calc)
    avg_churn_prob = df_calc['Churn_Probability'].mean()
    overall_churn_rate = df_calc['Predicted_Churn'].sum() / total_customers if total_customers > 0 else 0
    
    # Risk level counts
    high_risk = len(df_calc[df_calc['Churn_Probability'] > 0.7])
    moderate_risk = len(df_calc[(df_calc['Churn_Probability'] > 0.3) & (df_calc['Churn_Probability'] <= 0.7)])
    low_risk = len(df_calc[df_calc['Churn_Probability'] <= 0.3])
    
    # Calculate potential revenue loss (simplified)
    avg_order_value = 850
    potential_revenue_loss = df_calc['Churn_Probability'].sum() * avg_order_value
    
    # Create summary dataframe
    summary_data = {
        'Metric': [
            'Total Customers Analyzed',
            'Average Churn Probability',
            'Overall Churn Rate', 
            'High-Risk Customers',
            'Moderate-Risk Customers',
            'Low-Risk Customers',
            'Potential Revenue Loss',
            'Analysis Date'
        ],
        'Value': [
            total_customers,
            f"{avg_churn_prob:.2%}",
            f"{overall_churn_rate:.2%}",
            high_risk,
            moderate_risk,
            low_risk,
            f"₹{potential_revenue_loss:,.2f}",
            datetime.now().strftime('%d/%m/%Y')
        ]
    }
    
    summary_df = pd.DataFrame(summary_data)
    
    return summary_df

@app.route('/api/batch/download-report', methods=['POST'])
def download_batch_report():
    """Download full batch analysis report as CSV with ALL customer data and predictions"""
    if not model_available:
        return jsonify({"success": False, "error": "ML Model not available."}), 503

    try:
        print("🔍 Checking for file in request...")
        
        if 'file' not in request.files:
            print("❌ No file found in request.files")
            return jsonify({"error": "No file provided"}), 400

        file = request.files['file']
        print(f"📁 File object: {file}")
        print(f"📁 File filename: {file.filename}")
        
        if file.filename == '':
            print("❌ Empty filename")
            return jsonify({"error": "No file selected"}), 400
        
        if not file.filename.lower().endswith('.csv'):
            print("❌ Not a CSV file")
            return jsonify({"error": "Only CSV files are supported"}), 400
        
        print(f"📥 Processing file for FULL download: {file.filename}")
        
        # Read the uploaded CSV file
        try:
            batch_df = pd.read_csv(file)
            print(f"✅ Successfully loaded CSV with {len(batch_df)} rows and {len(batch_df.columns)} columns")
        except Exception as e:
            print(f"❌ Error reading CSV: {str(e)}")
            return jsonify({"error": f"Error reading CSV file: {str(e)}"}), 400
        
        print(f"📊 Loaded dataset with {len(batch_df)} customers and {len(batch_df.columns)} features")
        
        # ENHANCED: Use the new process_batch_dataframe function for comprehensive cleaning
        batch_df = process_batch_dataframe(batch_df)
        print("✅ Enhanced data cleaning and imputation completed")
        
        # Make predictions for ALL customers
        preds, probs = align_and_predict(batch_df, model, feature_names)
        print(f"✅ Predictions generated for {len(batch_df)} customers")
        
        # Add predictions to dataframe
        batch_df['Churn_Probability'] = probs
        batch_df['Predicted_Churn_Numeric'] = preds  # Keep numeric version for calculations
        
        # Add risk levels with clear categorization
        def risk_category(p):
            if p <= 0.30:
                return 'Low Risk'
            elif p <= 0.70:
                return 'Moderate Risk'
            else:
                return 'High Risk'
        
        batch_df['Risk_Level'] = batch_df['Churn_Probability'].apply(risk_category)
        
        # Add detailed recommendations based on risk level
        def get_detailed_recommendation(risk_level, churn_prob):
            if risk_level == 'High Risk':
                return "Immediate personalized outreach + Exclusive offers + Executive escalation"
            elif risk_level == 'Moderate Risk':
                return "Proactive engagement campaigns + Loyalty program enrollment + Personalized recommendations"
            else:
                return "Regular communication + Upselling opportunities + Referral program promotion"
        
        batch_df['Retention_Recommendation'] = batch_df.apply(
            lambda row: get_detailed_recommendation(row['Risk_Level'], row['Churn_Probability']), axis=1
        )
        
        # Add customer ID if not present
        customer_id_col = None
        for col in ['Customer_ID', 'CustomerID', 'customer_id', 'Customer Id', 'CustomerID', 'Customer']:
            if col in batch_df.columns:
                customer_id_col = col
                break
        
        if not customer_id_col:
            batch_df.insert(0, 'Customer_ID', [f'CUST_{i+1:04d}' for i in range(len(batch_df))])
            customer_id_col = 'Customer_ID'
            print("✅ Added Customer_ID column")
        
        # Format churn probability as percentage for better readability
        batch_df['Churn_Probability_Percent'] = (batch_df['Churn_Probability'] * 100).round(2).astype(str) + '%'
        
        # Format Predicted_Churn as Yes/No for clarity (use the numeric version)
        batch_df['Predicted_Churn'] = batch_df['Predicted_Churn_Numeric'].map({1: 'Yes', 0: 'No'})
        
        # Generate summary statistics using numeric version for calculations
        summary_df = generate_comprehensive_report(batch_df)
        
        # Reorder columns to have predictions at the end for better readability
        prediction_columns = ['Churn_Probability', 'Churn_Probability_Percent', 'Risk_Level', 'Predicted_Churn', 'Retention_Recommendation']
        other_columns = [col for col in batch_df.columns if col not in prediction_columns and col != 'Predicted_Churn_Numeric']
        
        # Ensure Customer_ID is first
        if customer_id_col in other_columns:
            other_columns.remove(customer_id_col)
        final_columns = [customer_id_col] + other_columns + prediction_columns
        batch_df = batch_df[final_columns]
        
        # Create a comprehensive CSV with ALL data
        output = io.StringIO()
        
        # Write the main data - ALL CUSTOMERS
        batch_df.to_csv(output, index=False)
        
        # Add summary section
        output.write("\n\nSUMMARY STATISTICS\n")
        summary_df.to_csv(output, index=False, header=False)
        
        # Add analysis metadata
        output.write("\n\nANALYSIS METADATA\n")
        output.write("Field,Value\n")
        output.write(f"Total Customers Analyzed,{len(batch_df)}\n")
        output.write(f"Analysis Timestamp,{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        output.write(f"Model Used,Ensemble ML Model\n")
        output.write(f"Data Source,Uploaded CSV\n")
        output.write(f"Imputation Strategy,Median with ML Prediction\n")
        output.write(f"NaN Values Handled,Yes - Using Smart Imputation\n")
        
        csv_data = output.getvalue()
        
        # Create response with CSV file
        response = make_response(csv_data)
        timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        filename = f"churn_analysis_complete_report_{timestamp}.csv"
        response.headers["Content-Disposition"] = f"attachment; filename={filename}"
        response.headers["Content-Type"] = "text/csv"
        
        print(f"✅ Generated FULL report with ALL {len(batch_df)} customers, {len(batch_df.columns)} columns")
        print(f"📁 File will be downloaded as: {filename}")
        
        return response

    except Exception as e:
        error_msg = f"Error generating full report: {str(e)}"
        print(f"❌ {error_msg}")
        import traceback
        print(f"🔍 Detailed traceback: {traceback.format_exc()}")
        return jsonify({
            "success": False,
            "error": "Internal server error generating report",
            "message": error_msg
        }), 500

# ==============================================================================
# NEW ENDPOINT FOR RISK-SPECIFIC DOWNLOADS
# ==============================================================================

@app.route('/api/batch/download-risk-customers', methods=['POST'])
def download_risk_customers():
    """Download customers filtered by specific risk level"""
    if not model_available:
        return jsonify({"success": False, "error": "ML Model not available."}), 503

    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        # Get risk level from form data
        risk_level = request.form.get('risk_level', 'high').lower()
        valid_risk_levels = ['high', 'medium', 'low']
        if risk_level not in valid_risk_levels:
            return jsonify({"error": f"Invalid risk level. Must be one of: {valid_risk_levels}"}), 400

        # Read and process the file
        batch_df = pd.read_csv(file)
        batch_df = process_batch_dataframe(batch_df)
        
        # Make predictions
        preds, probs = align_and_predict(batch_df, model, feature_names)
        batch_df['Churn_Probability'] = probs
        batch_df['Predicted_Churn_Numeric'] = preds
        
        # Filter by risk level
        if risk_level == 'high':
            filtered_df = batch_df[batch_df['Churn_Probability'] > 0.7]
            risk_label = 'High Risk'
        elif risk_level == 'medium':
            filtered_df = batch_df[(batch_df['Churn_Probability'] > 0.3) & (batch_df['Churn_Probability'] <= 0.7)]
            risk_label = 'Moderate Risk'
        else:  # low
            filtered_df = batch_df[batch_df['Churn_Probability'] <= 0.3]
            risk_label = 'Low Risk'
        
        # Add formatted columns
        filtered_df['Risk_Level'] = risk_label
        filtered_df['Predicted_Churn'] = filtered_df['Predicted_Churn_Numeric'].map({1: 'Yes', 0: 'No'})
        filtered_df['Churn_Probability_Percent'] = (filtered_df['Churn_Probability'] * 100).round(2).astype(str) + '%'
        
        # Create response
        output = io.StringIO()
        filtered_df.to_csv(output, index=False)
        
        response = make_response(output.getvalue())
        timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        filename = f"churn_analysis_{risk_level}_risk_customers_{timestamp}.csv"
        response.headers["Content-Disposition"] = f"attachment; filename={filename}"
        response.headers["Content-Type"] = "text/csv"
        
        print(f"✅ Generated {risk_label} report with {len(filtered_df)} customers")
        return response

    except Exception as e:
        error_msg = f"Error generating {risk_level} risk report: {str(e)}"
        print(f"❌ {error_msg}")
        return jsonify({
            "success": False,
            "error": f"Error generating {risk_level} risk report",
            "message": error_msg
        }), 500

# ==============================================================================
# OTHER ROUTES (UNCHANGED BUT USING ENHANCED IMPUTATION)
# ==============================================================================

@app.route('/')
def home():
    return jsonify({
        "message": "Churn Prediction API is running!",
        "status": "active",
        "model_loaded": model_available,
        "endpoints": {
            "predict": "/api/predict",
            "batch-predict": "/api/batch-predict",
            "batch-analyze": "/api/batch/analyze",
            "batch-download": "/api/batch/download-report",
            "batch-download-risk": "/api/batch/download-risk-customers",
            "health": "/api/health"
        }
    })

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "model_loaded": model_available,
        "imputation_initialized": len(imputation_values['numeric_median']) > 0,
        "timestamp": datetime.now().isoformat()
    })

@app.route('/api/predict', methods=['POST'])
def predict_churn():
    """Predict churn for a single customer - REQUIRES MODEL TO BE LOADED"""
    if not model_available:
        print("❌ Prediction request failed: Model not loaded (503).")
        return jsonify({"success": False, "error": "ML Model not available.", "message": "Server failed to load the prediction artifact."}), 503

    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        print(f"📥 Received prediction request with data: {data}")

        # Clean NaN values from input data using enhanced ML imputation
        validation_errors, cleaned_data = validate_input_data(data)
        if validation_errors:
            return jsonify({
                "success": False,
                "error": "Validation failed",
                "validation_errors": validation_errors
            }), 400

        input_df = pd.DataFrame([cleaned_data])

        preds, probs = align_and_predict(input_df, model, feature_names)

        probability = float(probs[0])
        prediction = int(preds[0])

        print(f"🎯 ML Model prediction - Probability: {probability:.3f}, Prediction: {prediction}")

        current_profile = {
            'Tenure (Months)': cleaned_data.get('Tenure', 0),
            'Cashback Amount (₹)': cleaned_data.get('CashbackAmount', 0),
            'Days Since Last Order': cleaned_data.get('DaySinceLastOrder', 0),
            'Satisfaction Score': cleaned_data.get('SatisfactionScore', 0),
            'Warehouse Distance (km)': cleaned_data.get('WarehouseToHome', 0),
            'Complain': cleaned_data.get('Complain', 0),
            'Total Orders': cleaned_data.get('OrderCount', 0)
        }

        business_impact = calculate_business_impact(probability, current_profile, cleaned_data)
        feature_importance_data = feature_contribution_approx(cleaned_data, feature_importances)
        recommendations = get_retention_recommendations(prediction, probability)
        
        # Enhanced risk level calculation
        if probability < 0.3:
            risk_level = "low"
        elif probability < 0.7:
            risk_level = "medium" 
        else:
            risk_level = "high"
            
        top_driver = feature_importance_data[0]['Feature'] if feature_importance_data else "general behavior"

        response = {
            "success": True,
            "prediction": prediction,
            "probability": probability,
            "business_impact": business_impact,
            "feature_importance": feature_importance_data,
            "recommendations": recommendations,
            "risk_level": risk_level,
            "top_driver": top_driver,
            "current_profile": current_profile,
            "customer_data": cleaned_data,
            "timestamp": datetime.now().isoformat(),
            "model_used": "ml_model"
        }

        print(f"📤 Sending ML prediction response")
        return jsonify(response)

    except Exception as e:
        error_msg = f"Error processing prediction request: {str(e)}"
        print(f"❌ {error_msg}")

        return jsonify({
            "success": False,
            "error": "Internal server error during ML prediction.",
            "message": error_msg
        }), 500

@app.route('/api/batch-predict', methods=['POST'])
def batch_predict():
    """Predict churn for multiple customers - REQUIRES MODEL TO BE LOADED"""
    if not model_available:
        print("❌ Batch request failed: Model not loaded (503).")
        return jsonify({"success": False, "error": "ML Model not available.", "message": "Server failed to load the prediction artifact."}), 503

    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        if not file.filename.endswith('.csv'):
            return jsonify({"error": "Only CSV files are supported"}), 400

        batch_df = pd.read_csv(file)
        
        # ENHANCED: Use the new process_batch_dataframe function
        batch_df = process_batch_dataframe(batch_df)
        
        preds, probs = align_and_predict(batch_df, model, feature_names)
        batch_df['Churn_Probability'] = probs
        batch_df['Predicted_Churn'] = preds

        def risk_category(p):
            if p <= 0.30:
                return 'P3: Low Risk (<=30%)'
            elif p <= 0.70:
                return 'P2: Moderate Risk (31-70%)'
            else:
                return 'P1: High Risk (>70%)'

        batch_df['Risk_Level'] = batch_df['Churn_Probability'].apply(risk_category)
        
        # Comprehensive analysis
        analysis_results = analyze_batch_results(batch_df)
        
        response = {
            "success": True,
            "total_customers": len(batch_df),
            "risk_distribution": analysis_results['risk_distribution'],
            "average_probability": analysis_results['average_probability'],
            "churn_rate": analysis_results['churn_rate'],
            "total_predicted_churn": analysis_results['total_predicted_churn'],
            "feature_analysis": analysis_results['feature_analysis'],
            "segmentation": analysis_results['segmentation'],
            "all_predictions": analysis_results['all_predictions'],  # Return ALL predictions
            "full_analysis": analysis_results,
            "timestamp": datetime.now().isoformat()
        }

        return jsonify(response)

    except Exception as e:
        error_msg = f"Error processing batch prediction: {str(e)}"
        print(f"❌ {error_msg}")

        return jsonify({
            "success": False,
            "error": "Internal server error during batch ML prediction.",
            "message": error_msg
        }), 500

@app.route('/api/batch/analyze', methods=['POST'])
def batch_analyze():
    """Enhanced batch analysis with comprehensive insights - RETURNS ALL CUSTOMERS"""
    if not model_available:
        return jsonify({"success": False, "error": "ML Model not available."}), 503

    try:
        # Use demo data if no file provided
        if 'file' not in request.files or request.files['file'].filename == '':
            # Generate demo data
            np.random.seed(42)
            demo_data = []
            for i in range(100):
                customer = {
                    'Tenure': np.random.randint(1, 36),
                    'CityTier': np.random.randint(1, 4),
                    'WarehouseToHome': np.random.randint(5, 50),
                    'HourSpendOnApp': np.random.randint(10, 120),
                    'SatisfactionScore': np.random.randint(1, 6),
                    'Complain': np.random.choice([0, 1], p=[0.9, 0.1]),
                    'OrderAmountHikeFromlastYear': np.random.randint(5, 30),
                    'CouponUsed': np.random.randint(0, 10),
                    'OrderCount': np.random.randint(1, 50),
                    'DaySinceLastOrder': np.random.randint(1, 90),
                    'CashbackAmount': np.random.randint(100, 20000),
                    'NumberOfDeviceRegistered': np.random.randint(1, 5),
                    'NumberOfAddress': np.random.randint(1, 6),
                    'PreferredLoginDevice': np.random.choice(['Mobile Phone', 'Computer']),
                    'PreferredPaymentMode': np.random.choice(['Credit Card', 'Debit Card', 'UPI']),
                    'PreferedOrderCat': np.random.choice(['Laptop & Accessory', 'Mobile', 'Fashion', 'Grocery']),
                    'Gender': np.random.choice(['Male', 'Female']),
                    'MaritalStatus': np.random.choice(['Single', 'Married'])
                }
                demo_data.append(customer)
            
            batch_df = pd.DataFrame(demo_data)
            data_source = "demo"
        else:
            file = request.files['file']
            if not file.filename.endswith('.csv'):
                return jsonify({"error": "Only CSV files are supported"}), 400
            batch_df = pd.read_csv(file)
            data_source = "uploaded"

        # ENHANCED: Use the new process_batch_dataframe function
        batch_df = process_batch_dataframe(batch_df)

        # Make predictions
        preds, probs = align_and_predict(batch_df, model, feature_names)
        batch_df['Churn_Probability'] = probs
        batch_df['Predicted_Churn'] = preds

        # Risk categorization
        def risk_category(p):
            if p <= 0.30:
                return 'Low Risk'
            elif p <= 0.70:
                return 'Moderate Risk'
            else:
                return 'High Risk'

        batch_df['Risk_Level'] = batch_df['Churn_Probability'].apply(risk_category)
        
        # Comprehensive analysis
        analysis_results = analyze_batch_results(batch_df)
        
        # Enhanced response with ALL customers
        response = {
            "success": True,
            "data_source": data_source,
            "dataset_info": {
                "total_customers": len(batch_df),
                "total_features": len(batch_df.columns),
                "dataset_size_kb": len(batch_df.to_csv(index=False).encode('utf-8')) / 1024,
                "feature_names": list(batch_df.columns),
                "data_types": {col: str(batch_df[col].dtype) for col in batch_df.columns},
                "imputation_strategy": "median",
                "imputation_values_summary": {
                    "numeric_features": len(imputation_values['numeric_median']),
                    "categorical_features": len(imputation_values['categorical_mode'])
                }
            },
            "risk_analysis": {
                "risk_distribution": analysis_results['risk_distribution'],
                "average_probability": analysis_results['average_probability'],
                "churn_rate": analysis_results['churn_rate'],
                "total_predicted_churn": analysis_results['total_predicted_churn']
            },
            "customer_segmentation": {
                "high_risk_customers": analysis_results['segmentation']['high_risk_count'],
                "high_risk_avg_probability": analysis_results['segmentation']['high_risk_avg_probability'],
                "potential_revenue_loss": analysis_results['segmentation']['total_potential_loss']
            },
            "feature_analysis": analysis_results['feature_analysis'],
            "all_predictions": analysis_results['all_predictions'],  # Return ALL predictions
            "timestamp": datetime.now().isoformat()
        }

        return jsonify(response)

    except Exception as e:
        error_msg = f"Error processing batch analysis: {str(e)}"
        print(f"❌ {error_msg}")
        return jsonify({
            "success": False,
            "error": "Internal server error during batch analysis",
            "message": error_msg
        }), 500

@app.route('/api/benchmarks', methods=['GET'])
def get_benchmarks():
    """Get benchmark values for comparison"""
    return jsonify({
        "benchmarks": BENCHMARK_PROFILE,
        "risk_directions": RISK_DIRECTIONS,
        "benchmark_orders": BENCHMARK_TOTAL_ORDERS
    })

# ==============================================================================
# ERROR HANDLERS
# ==============================================================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500

@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({"error": "Method not allowed"}), 405

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================

if __name__ == '__main__':
    print("🚀 Starting Churn Prediction API (Strict ML Mode)...")
    if model_available:
        print("✅ Model loaded: True (Using actual ML model)")
    else:
        print("❌ Model failed to load. The application is attempting to start but will fail all predictions.")

    print("📊 Available endpoints:")
    print("    - GET  /api/health")
    print("    - POST /api/predict")
    print("    - POST /api/batch-predict")
    print("    - POST /api/batch/analyze")
    print("    - POST /api/batch/download-report")
    print("    - POST /api/batch/download-risk-customers")
    print("    - GET  /api/benchmarks")

    app.run(debug=True, host='0.0.0.0', port=5000)