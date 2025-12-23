#!/usr/bin/env python3
"""
Sleep Quality Analysis API Server
==================================
Provides JSON endpoints for the web dashboard using the analysis from sleep_analysis_main.py
"""

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
import requests
import pandas as pd
import numpy as np
from scipy.signal import find_peaks
from scipy.fft import fft, fftfreq
import warnings
from datetime import datetime
import os

warnings.filterwarnings('ignore')

app = Flask(__name__, static_folder='.')
CORS(app)  # Enable CORS for all routes

# ThingSpeak Configuration
CHANNEL_ID = "3188672"
READ_API_KEY = "W1N28S1IJEC81SI6"
THINGSPEAK_URL = f"https://api.thingspeak.com/channels/{CHANNEL_ID}/feeds.json"

USERS = [1, 2, 3, 4]
SESSIONS = [0, 1, 2, 3]  # 0=baseline, 1-3=sleep sessions

# Cache for data (refresh every 5 minutes)
data_cache = {
    'data': None,
    'timestamp': None,
    'ttl': 300  # 5 minutes
}

# =====================================
# DATA FETCHING AND PROCESSING
# =====================================

def fetch_thingspeak_data():
    """Fetch all data from ThingSpeak channel"""
    try:
        params = {
            'api_key': READ_API_KEY,
            'results': 8000
        }
        
        response = requests.get(THINGSPEAK_URL, params=params, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        
        if 'feeds' not in data or not data['feeds']:
            return None
            
        # Convert to DataFrame
        df = pd.DataFrame(data['feeds'])
        
        # Convert timestamps to datetime
        df['created_at'] = pd.to_datetime(df['created_at'])
        
        # Convert fields to numeric and rename columns
        df['bpm'] = pd.to_numeric(df['field1'], errors='coerce')
        df['spo2'] = pd.to_numeric(df['field2'], errors='coerce')
        df['ecg'] = pd.to_numeric(df['field3'], errors='coerce')
        df['temp'] = pd.to_numeric(df['field4'], errors='coerce')
        df['emg'] = pd.to_numeric(df['field5'], errors='coerce')
        df['mpu'] = pd.to_numeric(df['field6'], errors='coerce')
        df['user'] = pd.to_numeric(df['field7'], errors='coerce')
        df['session'] = pd.to_numeric(df['field8'], errors='coerce')
        
        # Keep only relevant columns
        df = df[['created_at', 'bpm', 'spo2', 'ecg', 'temp', 'emg', 'mpu', 'user', 'session', 'entry_id']]
        
        # Remove rows with invalid user/session data
        df = df.dropna(subset=['user', 'session'])
        df = df[(df['user'].isin(USERS)) & (df['session'].isin(SESSIONS))]
        
        return df
        
    except Exception as e:
        print(f"Error fetching data: {e}")
        return None

def get_cached_data():
    """Get cached data or fetch fresh if expired"""
    now = datetime.now()
    
    if (data_cache['data'] is None or 
        data_cache['timestamp'] is None or 
        (now - data_cache['timestamp']).total_seconds() > data_cache['ttl']):
        
        print("Fetching fresh data from ThingSpeak...")
        df = fetch_thingspeak_data()
        
        if df is not None:
            data_cache['data'] = df
            data_cache['timestamp'] = now
        
    return data_cache['data']

# =====================================
# ANALYSIS FUNCTIONS (from sleep_analysis_main.py)
# =====================================

def calculate_hrv_manual(bpm_data):
    """Calculate HRV metrics manually (RMSSD and SDNN)"""
    if len(bpm_data) < 3:
        return 0, 0
    
    rr_intervals = 60000 / np.array(bpm_data)
    rr_intervals = rr_intervals[np.abs(rr_intervals - np.mean(rr_intervals)) < 3 * np.std(rr_intervals)]
    
    if len(rr_intervals) < 2:
        return 0, 0
    
    successive_diffs = np.diff(rr_intervals)
    rmssd = np.sqrt(np.mean(successive_diffs**2))
    sdnn = np.std(rr_intervals)
    
    return rmssd, sdnn

def moving_average(data, window_size=5):
    """Simple moving average smoothing"""
    return data.rolling(window=window_size, center=True).mean().fillna(data)

def extract_session_features(session_df):
    """Extract features for a single session"""
    if len(session_df) < 5:
        return None
    
    # Basic stats
    bpm_data = session_df['bpm'].values
    spo2_data = session_df['spo2'].values
    ecg_data = session_df['ecg'].values
    emg_data = session_df['emg'].values
    mpu_data = session_df['mpu'].values
    
    mean_bpm = np.nanmean(bpm_data)
    hrv_rmssd, hrv_sdnn = calculate_hrv_manual(bpm_data[~np.isnan(bpm_data)])
    
    mean_spo2 = np.nanmean(spo2_data)
    min_spo2 = np.nanmin(spo2_data)
    spo2_dip_count = np.sum(spo2_data < 95)
    
    mean_emg = np.nanmean(emg_data)
    emg_rms = np.sqrt(np.nanmean(emg_data**2))
    
    total_motion = np.nansum(np.abs(mpu_data))
    
    # Latest reading
    latest = session_df.iloc[-1]
    
    return {
        'mean_bpm': float(mean_bpm) if not np.isnan(mean_bpm) else 0,
        'hrv_rmssd': float(hrv_rmssd) if not np.isnan(hrv_rmssd) else 0,
        'hrv_sdnn': float(hrv_sdnn) if not np.isnan(hrv_sdnn) else 0,
        'mean_spo2': float(mean_spo2) if not np.isnan(mean_spo2) else 0,
        'min_spo2': float(min_spo2) if not np.isnan(min_spo2) else 0,
        'spo2_dip_count': int(spo2_dip_count),
        'mean_emg': float(mean_emg) if not np.isnan(mean_emg) else 0,
        'emg_rms': float(emg_rms) if not np.isnan(emg_rms) else 0,
        'total_motion': float(total_motion) if not np.isnan(total_motion) else 0,
        'data_points': len(session_df),
        'latest_bpm': float(latest['bpm']) if not pd.isna(latest['bpm']) else 0,
        'latest_spo2': float(latest['spo2']) if not pd.isna(latest['spo2']) else 0,
        'latest_ecg': float(latest['ecg']) if not pd.isna(latest['ecg']) else 0,
        'latest_emg': float(latest['emg']) if not pd.isna(latest['emg']) else 0,
        'latest_mpu': float(latest['mpu']) if not pd.isna(latest['mpu']) else 0,
        'latest_timestamp': latest['created_at'].isoformat(),
        'start_timestamp': session_df.iloc[0]['created_at'].isoformat(),
        'end_timestamp': session_df.iloc[-1]['created_at'].isoformat(),
    }

# =====================================
# API ENDPOINTS
# =====================================

@app.route('/')
def serve_index():
    """Serve the main index.html"""
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    """Serve static files"""
    return send_from_directory('.', path)

@app.route('/api/status')
def api_status():
    """Check API status"""
    df = get_cached_data()
    
    if df is None:
        return jsonify({
            'status': 'error',
            'message': 'Unable to fetch data from ThingSpeak',
            'channel': CHANNEL_ID
        }), 500
    
    return jsonify({
        'status': 'ok',
        'channel': CHANNEL_ID,
        'total_entries': len(df),
        'users': df['user'].unique().tolist(),
        'sessions': df['session'].unique().tolist(),
        'last_update': data_cache['timestamp'].isoformat() if data_cache['timestamp'] else None
    })

@app.route('/api/subjects')
def get_all_subjects():
    """Get data for all subjects"""
    df = get_cached_data()
    
    if df is None:
        return jsonify({'error': 'No data available'}), 500
    
    subjects = {}
    
    for user in USERS:
        user_data = df[df['user'] == user]
        
        if len(user_data) == 0:
            continue
        
        # Use integer keys, not strings
        subjects[int(user)] = {
            'baseline': None,
            'nap1': None,
            'nap2': None,
            'nap3': None,
            'rawData': []
        }
        
        for session in SESSIONS:
            session_df = user_data[user_data['session'] == session]
            
            if len(session_df) > 0:
                features = extract_session_features(session_df)
                
                if features:
                    session_key = 'baseline' if session == 0 else f'nap{session}'
                    subjects[int(user)][session_key] = features
        
        # Add raw data (last 50 points for each session)
        for session in SESSIONS:
            session_df = user_data[user_data['session'] == session].tail(50)
            for _, row in session_df.iterrows():
                subjects[int(user)]['rawData'].append({
                    'created_at': row['created_at'].isoformat(),
                    'bpm': float(row['bpm']) if not pd.isna(row['bpm']) else None,
                    'spo2': float(row['spo2']) if not pd.isna(row['spo2']) else None,
                    'ecg': float(row['ecg']) if not pd.isna(row['ecg']) else None,
                    'emg': float(row['emg']) if not pd.isna(row['emg']) else None,
                    'mpu': float(row['mpu']) if not pd.isna(row['mpu']) else None,
                    'session': int(row['session'])
                })
    
    return jsonify({
        'subjects': subjects,
        'lastUpdate': datetime.now().isoformat(),
        'totalFeeds': len(df),
        'channel': {
            'id': CHANNEL_ID,
            'name': 'Sleep Quality Monitoring'
        }
    })

@app.route('/api/subject/<int:subject_id>')
def get_subject(subject_id):
    """Get data for a specific subject"""
    if subject_id not in USERS:
        return jsonify({'error': 'Invalid subject ID'}), 404
    
    df = get_cached_data()
    
    if df is None:
        return jsonify({'error': 'No data available'}), 500
    
    user_data = df[df['user'] == subject_id]
    
    if len(user_data) == 0:
        return jsonify({'error': f'No data for subject {subject_id}'}), 404
    
    result = {
        'baseline': None,
        'nap1': None,
        'nap2': None,
        'nap3': None,
        'rawData': [],
        'lastUpdated': datetime.now().isoformat()
    }
    
    for session in SESSIONS:
        session_df = user_data[user_data['session'] == session]
        
        if len(session_df) > 0:
            features = extract_session_features(session_df)
            
            if features:
                session_key = 'baseline' if session == 0 else f'nap{session}'
                result[session_key] = features
    
    # Add raw data
    for _, row in user_data.iterrows():
        result['rawData'].append({
            'created_at': row['created_at'].isoformat(),
            'entry_id': int(row['entry_id']) if not pd.isna(row['entry_id']) else None,
            'field1': float(row['bpm']) if not pd.isna(row['bpm']) else None,
            'field2': float(row['spo2']) if not pd.isna(row['spo2']) else None,
            'field3': float(row['ecg']) if not pd.isna(row['ecg']) else None,
            'field4': float(row['temp']) if not pd.isna(row['temp']) else None,
            'field5': float(row['emg']) if not pd.isna(row['emg']) else None,
            'field6': float(row['mpu']) if not pd.isna(row['mpu']) else None,
            'field7': int(row['user']),
            'field8': int(row['session'])
        })
    
    return jsonify(result)

@app.route('/api/latest')
def get_latest():
    """Get latest readings from all users"""
    df = get_cached_data()
    
    if df is None:
        return jsonify({'error': 'No data available'}), 500
    
    latest_data = {}
    
    for user in USERS:
        user_data = df[df['user'] == user]
        
        if len(user_data) > 0:
            latest = user_data.iloc[-1]
            latest_data[user] = {
                'bpm': float(latest['bpm']) if not pd.isna(latest['bpm']) else None,
                'spo2': float(latest['spo2']) if not pd.isna(latest['spo2']) else None,
                'ecg': float(latest['ecg']) if not pd.isna(latest['ecg']) else None,
                'emg': float(latest['emg']) if not pd.isna(latest['emg']) else None,
                'mpu': float(latest['mpu']) if not pd.isna(latest['mpu']) else None,
                'session': int(latest['session']),
                'timestamp': latest['created_at'].isoformat()
            }
    
    return jsonify(latest_data)

@app.route('/api/refresh')
def refresh_data():
    """Force refresh data from ThingSpeak"""
    data_cache['data'] = None
    data_cache['timestamp'] = None
    
    df = get_cached_data()
    
    if df is None:
        return jsonify({'error': 'Failed to refresh data'}), 500
    
    return jsonify({
        'status': 'refreshed',
        'entries': len(df),
        'timestamp': data_cache['timestamp'].isoformat()
    })

if __name__ == '__main__':
    print("🌙 Sleep Quality Analysis API Server")
    print(f"📡 ThingSpeak Channel: {CHANNEL_ID}")
    print(f"🔑 API Key: {READ_API_KEY[:4]}...{READ_API_KEY[-4:]}")
    print("🚀 Starting server on http://localhost:5000")
    print("\nAvailable endpoints:")
    print("  GET /api/status         - API status")
    print("  GET /api/subjects       - All subjects data")
    print("  GET /api/subject/<id>   - Specific subject data")
    print("  GET /api/latest         - Latest readings")
    print("  GET /api/refresh        - Force data refresh")
    print("\n")
    
    app.run(debug=True, port=5000, host='0.0.0.0')
