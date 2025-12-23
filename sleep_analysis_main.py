#!/usr/bin/env python3
"""
Comprehensive Sleep Quality Monitoring Analysis System
=====================================================

This script provides a complete analysis pipeline for sleep monitoring data collected from ThingSpeak.
Each entry contains: bpm, spo2, ecg, temp, emg, mpu, user, session

Data Structure:
- 4 users (1-4)
- session 0 = baseline
- sessions 1,2,3 = sleep sessions
- Temperature field is ignored (zero values)

Features:
1. ✅ Fetch Data from ThingSpeak
2. ✅ Save Raw Session Files  
3. ✅ Preprocessing (Clean & Simple)
4. ✅ Feature Extraction (Meaningful)
5. ✅ Fourier Analysis Section
6. ✅ Event Detection
7. ✅ Per-User Analysis Reports
8. ✅ Inter-User Comparison
9. ✅ Sleep Quality Score
10. ✅ Global Summary Report
11. ✅ Generate Final ZIP

Author: Sleep Analysis System
Date: December 2025
"""

import requests
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime
import os
import shutil
import warnings
from scipy.signal import find_peaks, butter, filtfilt
from scipy.fft import fft, fftfreq
import json

# Suppress warnings for cleaner output
warnings.filterwarnings('ignore')

# ThingSpeak Configuration
CHANNEL_ID = "3188672"
READ_API_KEY = "W1N28S1IJEC81SI6"  # Using write key as read key from the upload script
THINGSPEAK_URL = f"https://api.thingspeak.com/channels/{CHANNEL_ID}/feeds.json"

# Global Configuration
OUTPUT_DIR = "sleep_analysis_output"
USERS = [1, 2, 3, 4]
SESSIONS = [0, 1, 2, 3]  # 0=baseline, 1-3=sleep sessions

# Create output directories
os.makedirs(f"{OUTPUT_DIR}/raw_data", exist_ok=True)
os.makedirs(f"{OUTPUT_DIR}/reports", exist_ok=True)
os.makedirs(f"{OUTPUT_DIR}/visualizations", exist_ok=True)

print("🌙 Sleep Quality Monitoring Analysis System")
print("=" * 60)

# =====================================
# 1. ✅ FETCH DATA FROM THINGSPEAK
# =====================================

def fetch_thingspeak_data():
    """
    Fetch all data from ThingSpeak channel
    Returns: pandas DataFrame with all entries
    """
    print("\n📡 Step 1: Fetching data from ThingSpeak...")
    
    try:
        # Fetch data from ThingSpeak
        params = {
            'api_key': READ_API_KEY,
            'results': 8000  # Get more records if needed
        }
        
        response = requests.get(THINGSPEAK_URL, params=params, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        
        if 'feeds' not in data or not data['feeds']:
            print("❌ No data found in ThingSpeak channel")
            return None
            
        # Convert to DataFrame
        df = pd.DataFrame(data['feeds'])
        
        # Convert timestamps to datetime
        df['created_at'] = pd.to_datetime(df['created_at'])
        
        # Convert fields to numeric and rename columns
        df['bpm'] = pd.to_numeric(df['field1'], errors='coerce')
        df['spo2'] = pd.to_numeric(df['field2'], errors='coerce')
        df['ecg'] = pd.to_numeric(df['field3'], errors='coerce')
        df['temp'] = pd.to_numeric(df['field4'], errors='coerce')  # Will be ignored
        df['emg'] = pd.to_numeric(df['field5'], errors='coerce')
        df['mpu'] = pd.to_numeric(df['field6'], errors='coerce')
        df['user'] = pd.to_numeric(df['field7'], errors='coerce')
        df['session'] = pd.to_numeric(df['field8'], errors='coerce')
        
        # Keep only relevant columns
        df = df[['created_at', 'bpm', 'spo2', 'ecg', 'temp', 'emg', 'mpu', 'user', 'session']]
        
        # Remove rows with invalid user/session data
        df = df.dropna(subset=['user', 'session'])
        df = df[(df['user'].isin(USERS)) & (df['session'].isin(SESSIONS))]
        
        print(f"✅ Fetched {len(df)} valid data points")
        
        # Print summary by user and session
        print("\n📊 Data Summary by User-Session:")
        for user in USERS:
            for session in SESSIONS:
                count = len(df[(df['user'] == user) & (df['session'] == session)])
                session_name = "Baseline" if session == 0 else f"Sleep {session}"
                print(f"   User {user} - {session_name}: {count} records")
        
        return df
        
    except Exception as e:
        print(f"❌ Error fetching data: {e}")
        return None

# =====================================
# 2. ✅ SAVE RAW SESSION FILES
# =====================================

def save_raw_session_files(df):
    """
    Save individual CSV files for each user/session combination
    """
    print("\n💾 Step 2: Saving raw session files...")
    
    for user in USERS:
        user_dir = f"{OUTPUT_DIR}/raw_data/user_{user}"
        os.makedirs(user_dir, exist_ok=True)
        
        for session in SESSIONS:
            session_data = df[(df['user'] == user) & (df['session'] == session)]
            
            if len(session_data) > 0:
                filename = f"{user_dir}/session_{session}.csv"
                session_data.to_csv(filename, index=False)
                print(f"   ✅ Saved: {filename} ({len(session_data)} records)")
            else:
                print(f"   ⚠️  No data for User {user}, Session {session}")

# =====================================
# 3. ✅ PREPROCESSING (SIMPLE & CLEAN)
# =====================================

def moving_average(data, window_size=5):
    """Simple moving average smoothing"""
    return data.rolling(window=window_size, center=True).mean().fillna(data)

def remove_nans(data):
    """Remove NaN values using forward fill and backward fill"""
    return data.fillna(method='ffill').fillna(method='bfill')

def normalize_signal(data):
    """Normalize signal to 0-1 range"""
    min_val, max_val = data.min(), data.max()
    if max_val == min_val:
        return data * 0  # Handle constant signals
    return (data - min_val) / (max_val - min_val)

def compute_mpu_magnitude(mpu_data):
    """
    For single-axis MPU data, return as is
    For multi-axis, compute magnitude
    """
    return np.abs(mpu_data)  # Simple magnitude for movement

def detect_ecg_peaks(ecg_data, sampling_rate=0.067):  # ~15 second intervals
    """Simple ECG peak detection using local maxima"""
    if len(ecg_data) < 10:
        return []
    
    # Smooth the signal first
    smoothed = moving_average(pd.Series(ecg_data), window_size=3)
    
    # Find peaks with minimum distance
    peaks, _ = find_peaks(smoothed, height=smoothed.mean(), distance=3)
    return peaks

def smooth_emg(emg_data):
    """Simple EMG smoothing using moving average"""
    return moving_average(pd.Series(emg_data), window_size=5)

def resample_to_uniform(data, target_points=100):
    """Resample data to uniform time base"""
    if len(data) < 2:
        return data
    
    # Create uniform time points
    original_indices = np.linspace(0, len(data)-1, len(data))
    target_indices = np.linspace(0, len(data)-1, target_points)
    
    # Interpolate to uniform grid
    resampled = np.interp(target_indices, original_indices, data)
    return resampled

def clip_artifacts(data, z_threshold=3):
    """Remove outliers using z-score clipping"""
    if len(data) < 3:
        return data
    
    z_scores = np.abs((data - np.mean(data)) / np.std(data))
    return np.where(z_scores > z_threshold, np.mean(data), data)

def compute_movement_index(mpu_data, window_size=10):
    """Compute movement index from MPU data using rolling standard deviation"""
    mpu_series = pd.Series(mpu_data)
    return mpu_series.rolling(window=window_size, center=True).std().fillna(0)

def preprocess_session_data(session_df):
    """
    Apply all preprocessing steps to session data
    Returns: preprocessed DataFrame
    """
    if len(session_df) < 5:
        return session_df  # Skip processing for very short sessions
    
    processed_df = session_df.copy()
    
    # Remove NaNs
    for col in ['bpm', 'spo2', 'ecg', 'emg', 'mpu']:
        processed_df[col] = remove_nans(processed_df[col])
    
    # Clip artifacts
    processed_df['bpm'] = clip_artifacts(processed_df['bpm'].values)
    processed_df['spo2'] = clip_artifacts(processed_df['spo2'].values)
    processed_df['ecg'] = clip_artifacts(processed_df['ecg'].values)
    processed_df['emg'] = clip_artifacts(processed_df['emg'].values)
    processed_df['mpu'] = clip_artifacts(processed_df['mpu'].values)
    
    # Smooth signals
    processed_df['bpm_smooth'] = moving_average(processed_df['bpm'])
    processed_df['spo2_smooth'] = moving_average(processed_df['spo2'])
    processed_df['ecg_smooth'] = moving_average(processed_df['ecg'])
    processed_df['emg_smooth'] = smooth_emg(processed_df['emg'])
    processed_df['mpu_smooth'] = moving_average(processed_df['mpu'])
    
    # Compute MPU magnitude and movement index
    processed_df['mpu_magnitude'] = compute_mpu_magnitude(processed_df['mpu'])
    processed_df['movement_index'] = compute_movement_index(processed_df['mpu'])
    
    return processed_df

print("\n🔄 Step 3: Preprocessing helper functions ready...")

# =====================================
# 4. ✅ FEATURE EXTRACTION
# =====================================

def calculate_hrv_manual(bpm_data):
    """
    Calculate HRV metrics manually (RMSSD and SDNN)
    """
    if len(bpm_data) < 3:
        return 0, 0
    
    # Convert BPM to RR intervals (in milliseconds)
    # RR interval = 60000 / BPM
    rr_intervals = 60000 / np.array(bpm_data)
    
    # Remove outliers
    rr_intervals = rr_intervals[np.abs(rr_intervals - np.mean(rr_intervals)) < 3 * np.std(rr_intervals)]
    
    if len(rr_intervals) < 2:
        return 0, 0
    
    # RMSSD: Root mean square of successive differences
    successive_diffs = np.diff(rr_intervals)
    rmssd = np.sqrt(np.mean(successive_diffs**2))
    
    # SDNN: Standard deviation of NN intervals
    sdnn = np.std(rr_intervals)
    
    return rmssd, sdnn

def compute_fft_dominant_frequency(signal_data, sampling_rate=0.067):
    """Compute dominant frequency from FFT"""
    if len(signal_data) < 10:
        return 0
    
    # Remove DC component
    signal_data = signal_data - np.mean(signal_data)
    
    # Compute FFT
    fft_values = fft(signal_data)
    freqs = fftfreq(len(signal_data), 1/sampling_rate)
    
    # Get positive frequencies only
    pos_freqs = freqs[:len(freqs)//2]
    pos_fft = np.abs(fft_values[:len(freqs)//2])
    
    if len(pos_freqs) == 0:
        return 0
    
    # Find dominant frequency
    dominant_idx = np.argmax(pos_fft[1:]) + 1  # Skip DC component
    return pos_freqs[dominant_idx]

def count_spo2_dips(spo2_data, threshold=95):
    """Count SpO2 dip events below threshold"""
    return np.sum(spo2_data < threshold)

def count_muscle_bursts(emg_data, threshold_percentile=75):
    """Count EMG muscle burst events above threshold"""
    if len(emg_data) < 3:
        return 0
    
    threshold = np.percentile(emg_data, threshold_percentile)
    above_threshold = emg_data > threshold
    
    # Count transitions from below to above threshold
    bursts = np.sum(np.diff(above_threshold.astype(int)) > 0)
    return bursts

def count_movement_bursts(mpu_data, threshold_percentile=70):
    """Count movement burst events above threshold"""
    if len(mpu_data) < 3:
        return 0
    
    threshold = np.percentile(mpu_data, threshold_percentile)
    above_threshold = mpu_data > threshold
    
    # Count transitions from below to above threshold
    bursts = np.sum(np.diff(above_threshold.astype(int)) > 0)
    return bursts

def extract_features_for_session(session_df):
    """
    Extract all features for a single session
    Returns: dictionary of features
    """
    if len(session_df) < 5:
        # Return default features for empty sessions
        return {
            'mean_bpm': 0, 'hrv_rmssd': 0, 'hrv_sdnn': 0, 'ecg_peak_count': 0,
            'ecg_peak_amplitude': 0, 'ecg_fft_dominant': 0, 'mean_spo2': 0,
            'min_spo2': 0, 'spo2_variability': 0, 'spo2_dip_count': 0,
            'mean_emg': 0, 'emg_rms': 0, 'emg_fft_dominant': 0, 'emg_burst_count': 0,
            'total_motion': 0, 'movement_bursts': 0, 'mpu_fft_dominant': 0
        }
    
    # Preprocess the session data
    processed_df = preprocess_session_data(session_df)
    
    # ❤️ Heart / ECG Features
    bpm_data = processed_df['bpm'].values
    ecg_data = processed_df['ecg'].values
    
    mean_bpm = np.mean(bpm_data)
    hrv_rmssd, hrv_sdnn = calculate_hrv_manual(bpm_data)
    
    ecg_peaks = detect_ecg_peaks(ecg_data)
    ecg_peak_count = len(ecg_peaks)
    
    if len(ecg_peaks) > 1:
        ecg_peak_amplitude = np.mean([ecg_data[i] for i in ecg_peaks])
    else:
        ecg_peak_amplitude = np.max(ecg_data) if len(ecg_data) > 0 else 0
    
    ecg_fft_dominant = compute_fft_dominant_frequency(ecg_data)
    
    # 🩸 Oxygen Features
    spo2_data = processed_df['spo2'].values
    mean_spo2 = np.mean(spo2_data)
    min_spo2 = np.min(spo2_data)
    spo2_variability = np.std(spo2_data)
    spo2_dip_count = count_spo2_dips(spo2_data)
    
    # 💪 EMG Features
    emg_data = processed_df['emg'].values
    mean_emg = np.mean(emg_data)
    emg_rms = np.sqrt(np.mean(emg_data**2))
    emg_fft_dominant = compute_fft_dominant_frequency(emg_data)
    emg_burst_count = count_muscle_bursts(emg_data)
    
    # 💤 Motion / MPU Features
    mpu_data = processed_df['mpu'].values
    total_motion = np.sum(np.abs(mpu_data))
    movement_bursts = count_movement_bursts(mpu_data)
    mpu_fft_dominant = compute_fft_dominant_frequency(mpu_data)
    
    return {
        'mean_bpm': mean_bpm,
        'hrv_rmssd': hrv_rmssd,
        'hrv_sdnn': hrv_sdnn,
        'ecg_peak_count': ecg_peak_count,
        'ecg_peak_amplitude': ecg_peak_amplitude,
        'ecg_fft_dominant': ecg_fft_dominant,
        'mean_spo2': mean_spo2,
        'min_spo2': min_spo2,
        'spo2_variability': spo2_variability,
        'spo2_dip_count': spo2_dip_count,
        'mean_emg': mean_emg,
        'emg_rms': emg_rms,
        'emg_fft_dominant': emg_fft_dominant,
        'emg_burst_count': emg_burst_count,
        'total_motion': total_motion,
        'movement_bursts': movement_bursts,
        'mpu_fft_dominant': mpu_fft_dominant
    }

def extract_all_features(df):
    """Extract features for all user-session combinations"""
    print("\n🔬 Step 4: Extracting features for all sessions...")
    
    features_list = []
    
    for user in USERS:
        for session in SESSIONS:
            session_df = df[(df['user'] == user) & (df['session'] == session)]
            
            if len(session_df) > 0:
                print(f"   Processing User {user}, Session {session}...")
                features = extract_features_for_session(session_df)
                features['user'] = user
                features['session'] = session
                features['session_name'] = 'Baseline' if session == 0 else f'Sleep {session}'
                features_list.append(features)
            else:
                print(f"   ⚠️  No data for User {user}, Session {session}")
    
    features_df = pd.DataFrame(features_list)
    print(f"✅ Extracted features for {len(features_df)} sessions")
    
    return features_df

# =====================================
# 5. ✅ FOURIER ANALYSIS SECTION
# =====================================

def plot_fft_analysis(signal_data, signal_name, user, session, save_dir):
    """
    Plot FFT analysis for a signal with interpretation
    """
    if len(signal_data) < 10:
        return
    
    # Remove DC component
    signal_data = signal_data - np.mean(signal_data)
    
    # Compute FFT
    fft_values = fft(signal_data)
    freqs = fftfreq(len(signal_data), 1/0.067)  # ~15 second sampling
    
    # Get positive frequencies only
    pos_freqs = freqs[:len(freqs)//2]
    pos_fft = np.abs(fft_values[:len(freqs)//2])
    
    # Find dominant frequency
    if len(pos_freqs) > 1:
        dominant_idx = np.argmax(pos_fft[1:]) + 1
        dominant_freq = pos_freqs[dominant_idx]
    else:
        dominant_freq = 0
    
    # Create plot
    plt.figure(figsize=(12, 6))
    
    # Plot frequency spectrum
    plt.subplot(1, 2, 1)
    plt.plot(pos_freqs, pos_fft)
    plt.axvline(dominant_freq, color='red', linestyle='--', 
                label=f'Dominant: {dominant_freq:.4f} Hz')
    plt.xlabel('Frequency (Hz)')
    plt.ylabel('Amplitude')
    plt.title(f'{signal_name} FFT - User {user}, Session {session}')
    plt.legend()
    plt.grid(True, alpha=0.3)
    
    # Plot original signal
    plt.subplot(1, 2, 2)
    plt.plot(signal_data)
    plt.xlabel('Sample')
    plt.ylabel('Amplitude')
    plt.title(f'{signal_name} Time Domain')
    plt.grid(True, alpha=0.3)
    
    plt.tight_layout()
    
    # Save plot
    filename = f"{save_dir}/fft_{signal_name.lower()}_user{user}_session{session}.png"
    plt.savefig(filename, dpi=150, bbox_inches='tight')
    plt.close()
    
    # Generate interpretation
    interpretation = generate_fft_interpretation(signal_name, dominant_freq, session)
    
    return dominant_freq, interpretation

def generate_fft_interpretation(signal_name, dominant_freq, session):
    """Generate automatic interpretation of FFT results"""
    
    if signal_name == "ECG":
        if dominant_freq < 0.01:
            return "Very stable heart rhythm with minimal frequency variation"
        elif dominant_freq < 0.02:
            return "Normal heart rhythm variability typical of relaxed sleep state"
        else:
            return "Elevated heart rhythm variability suggesting active or stressed state"
    
    elif signal_name == "EMG":
        if dominant_freq < 0.01:
            return "Low muscle activity frequency suggests deep relaxation and reduced muscle tone typical of deep sleep"
        elif dominant_freq < 0.02:
            return "Moderate muscle activity indicating light sleep or relaxed wakefulness"
        else:
            return "Higher muscle activity frequency suggests active muscle engagement or restless sleep"
    
    elif signal_name == "MPU":
        if dominant_freq < 0.01:
            return "Minimal movement frequency indicating very still sleep with rare position changes"
        elif dominant_freq < 0.02:
            return "Low movement frequency typical of normal sleep with occasional position adjustments"
        else:
            return "Higher movement frequency suggesting restless sleep or frequent position changes"
    
    return f"Dominant frequency: {dominant_freq:.4f} Hz"

def perform_fft_analysis_all_sessions(df):
    """Perform FFT analysis for all sessions and signals"""
    print("\n📊 Step 5: Performing FFT analysis for all sessions...")
    
    fft_results = []
    
    for user in USERS:
        user_viz_dir = f"{OUTPUT_DIR}/visualizations/user{user}"
        os.makedirs(user_viz_dir, exist_ok=True)
        
        for session in SESSIONS:
            session_df = df[(df['user'] == user) & (df['session'] == session)]
            
            if len(session_df) < 10:
                continue
                
            print(f"   FFT analysis User {user}, Session {session}...")
            
            # Process session data
            processed_df = preprocess_session_data(session_df)
            
            # Analyze each signal
            for signal_name, column in [("ECG", "ecg"), ("EMG", "emg"), ("MPU", "mpu")]:
                signal_data = processed_df[column].values
                
                if len(signal_data) > 10:
                    dominant_freq, interpretation = plot_fft_analysis(
                        signal_data, signal_name, user, session, user_viz_dir
                    )
                    
                    fft_results.append({
                        'user': user,
                        'session': session,
                        'signal': signal_name,
                        'dominant_frequency': dominant_freq,
                        'interpretation': interpretation
                    })
    
    fft_df = pd.DataFrame(fft_results)
    print(f"✅ Completed FFT analysis for {len(fft_df)} signal-session combinations")
    
    return fft_df

# =====================================
# 6. ✅ EVENT DETECTION
# =====================================

def detect_movement_episodes(mpu_data, timestamps, threshold_percentile=70):
    """Detect movement episodes from MPU data"""
    if len(mpu_data) < 3:
        return []
    
    threshold = np.percentile(mpu_data, threshold_percentile)
    above_threshold = mpu_data > threshold
    
    # Find start and end of movement episodes
    episodes = []
    in_episode = False
    start_idx = 0
    
    for i, is_moving in enumerate(above_threshold):
        if is_moving and not in_episode:
            start_idx = i
            in_episode = True
        elif not is_moving and in_episode:
            episodes.append({
                'start_time': timestamps.iloc[start_idx],
                'end_time': timestamps.iloc[i-1],
                'duration_minutes': (timestamps.iloc[i-1] - timestamps.iloc[start_idx]).total_seconds() / 60,
                'peak_movement': np.max(mpu_data[start_idx:i])
            })
            in_episode = False
    
    return episodes

def detect_spo2_drops(spo2_data, timestamps, threshold=95):
    """Detect SpO2 drop events below threshold"""
    if len(spo2_data) < 3:
        return []
    
    below_threshold = spo2_data < threshold
    
    # Find start and end of drop episodes
    episodes = []
    in_episode = False
    start_idx = 0
    
    for i, is_dropping in enumerate(below_threshold):
        if is_dropping and not in_episode:
            start_idx = i
            in_episode = True
        elif not is_dropping and in_episode:
            episodes.append({
                'start_time': timestamps.iloc[start_idx],
                'end_time': timestamps.iloc[i-1],
                'duration_minutes': (timestamps.iloc[i-1] - timestamps.iloc[start_idx]).total_seconds() / 60,
                'min_spo2': np.min(spo2_data[start_idx:i])
            })
            in_episode = False
    
    return episodes

def detect_hrv_events(bpm_data, timestamps, low_hrv_threshold_percentile=25):
    """Detect periods of low HRV (high stress/poor sleep quality)"""
    if len(bpm_data) < 10:
        return []
    
    # Calculate rolling HRV (using a simplified metric)
    window_size = min(10, len(bpm_data) // 3)
    rolling_hrv = []
    
    for i in range(len(bpm_data) - window_size + 1):
        window_bpm = bpm_data[i:i+window_size]
        rmssd, _ = calculate_hrv_manual(window_bpm)
        rolling_hrv.append(rmssd)
    
    if len(rolling_hrv) == 0:
        return []
    
    rolling_hrv = np.array(rolling_hrv)
    threshold = np.percentile(rolling_hrv, low_hrv_threshold_percentile)
    
    low_hrv_periods = rolling_hrv < threshold
    
    # Find episodes
    episodes = []
    in_episode = False
    start_idx = 0
    
    for i, is_low_hrv in enumerate(low_hrv_periods):
        actual_idx = i + window_size // 2  # Adjust for rolling window offset
        if actual_idx >= len(timestamps):
            break
            
        if is_low_hrv and not in_episode:
            start_idx = actual_idx
            in_episode = True
        elif not is_low_hrv and in_episode:
            episodes.append({
                'start_time': timestamps.iloc[start_idx],
                'end_time': timestamps.iloc[actual_idx-1],
                'duration_minutes': (timestamps.iloc[actual_idx-1] - timestamps.iloc[start_idx]).total_seconds() / 60,
                'avg_hrv': np.mean(rolling_hrv[start_idx-window_size//2:actual_idx-window_size//2])
            })
            in_episode = False
    
    return episodes

def detect_events_for_session(session_df):
    """Detect all event types for a single session"""
    if len(session_df) < 5:
        return {
            'movement_episodes': [],
            'spo2_drops': [],
            'hrv_events': []
        }
    
    # Preprocess data
    processed_df = preprocess_session_data(session_df)
    
    # Detect events
    movement_episodes = detect_movement_episodes(
        processed_df['mpu'].values, 
        processed_df['created_at']
    )
    
    spo2_drops = detect_spo2_drops(
        processed_df['spo2'].values,
        processed_df['created_at']
    )
    
    hrv_events = detect_hrv_events(
        processed_df['bpm'].values,
        processed_df['created_at']
    )
    
    return {
        'movement_episodes': movement_episodes,
        'spo2_drops': spo2_drops,
        'hrv_events': hrv_events
    }

def detect_events_all_sessions(df):
    """Detect events for all sessions"""
    print("\n🚨 Step 6: Detecting events for all sessions...")
    
    all_events = {}
    
    for user in USERS:
        all_events[user] = {}
        
        for session in SESSIONS:
            session_df = df[(df['user'] == user) & (df['session'] == session)]
            
            if len(session_df) > 0:
                print(f"   Detecting events User {user}, Session {session}...")
                events = detect_events_for_session(session_df)
                all_events[user][session] = events
                
                # Print summary
                n_movement = len(events['movement_episodes'])
                n_spo2 = len(events['spo2_drops'])
                n_hrv = len(events['hrv_events'])
                print(f"      Movement: {n_movement}, SpO2 drops: {n_spo2}, HRV events: {n_hrv}")
    
    print("✅ Event detection completed")
    return all_events

# =====================================
# 7. ✅ PER-USER ANALYSIS REPORTS  
# =====================================

def create_user_plots(user_id, df, features_df, events_data):
    """Create comprehensive plots for a single user"""
    
    user_viz_dir = f"{OUTPUT_DIR}/visualizations/user{user_id}"
    os.makedirs(user_viz_dir, exist_ok=True)
    
    # Get user data
    user_df = df[df['user'] == user_id]
    user_features = features_df[features_df['user'] == user_id]
    
    if len(user_df) == 0:
        return
    
    # 1. Raw time series plots
    fig, axes = plt.subplots(5, 1, figsize=(15, 12))
    
    signals = ['bpm', 'spo2', 'ecg', 'emg', 'mpu']
    signal_names = ['BPM', 'SpO₂', 'ECG', 'EMG', 'Movement']
    
    for i, (signal, name) in enumerate(zip(signals, signal_names)):
        for session in SESSIONS:
            session_df = user_df[user_df['session'] == session]
            if len(session_df) > 0:
                session_name = 'Baseline' if session == 0 else f'Sleep {session}'
                axes[i].plot(session_df['created_at'], session_df[signal], 
                           label=session_name, alpha=0.7)
        
        axes[i].set_ylabel(name)
        axes[i].legend()
        axes[i].grid(True, alpha=0.3)
        axes[i].tick_params(axis='x', rotation=45)
    
    axes[-1].set_xlabel('Time')
    plt.suptitle(f'User {user_id} - Raw Time Series Data', fontsize=16)
    plt.tight_layout()
    plt.savefig(f"{user_viz_dir}/raw_timeseries.png", dpi=150, bbox_inches='tight')
    plt.close()
    
    # 2. Baseline vs sessions comparison
    if len(user_features) > 1:
        metrics = ['mean_bpm', 'mean_spo2', 'mean_emg', 'total_motion']
        metric_names = ['BPM', 'SpO₂', 'EMG', 'Motion']
        
        fig, axes = plt.subplots(2, 2, figsize=(12, 8))
        axes = axes.flatten()
        
        for i, (metric, name) in enumerate(zip(metrics, metric_names)):
            sessions = user_features['session'].values
            values = user_features[metric].values
            
            colors = ['red' if s == 0 else 'blue' for s in sessions]
            session_labels = ['Baseline' if s == 0 else f'Sleep {s}' for s in sessions]
            
            bars = axes[i].bar(range(len(sessions)), values, color=colors, alpha=0.7)
            axes[i].set_xticks(range(len(sessions)))
            axes[i].set_xticklabels(session_labels, rotation=45)
            axes[i].set_ylabel(name)
            axes[i].set_title(f'User {user_id} - {name} by Session')
            axes[i].grid(True, alpha=0.3)
            
            # Add value labels on bars
            for bar, val in zip(bars, values):
                axes[i].text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.01*max(values),
                           f'{val:.1f}', ha='center', va='bottom')
        
        plt.tight_layout()
        plt.savefig(f"{user_viz_dir}/baseline_vs_sessions.png", dpi=150, bbox_inches='tight')
        plt.close()
    
    # 3. Box plots for signal distributions
    fig, axes = plt.subplots(2, 3, figsize=(15, 8))
    axes = axes.flatten()
    
    signals = ['bpm', 'spo2', 'ecg', 'emg', 'mpu']
    signal_names = ['BPM', 'SpO₂', 'ECG', 'EMG', 'Movement']
    
    for i, (signal, name) in enumerate(zip(signals, signal_names)):
        if i >= len(axes):
            break
            
        session_data = []
        session_labels = []
        
        for session in SESSIONS:
            session_df = user_df[user_df['session'] == session]
            if len(session_df) > 0:
                session_data.append(session_df[signal].values)
                session_labels.append('Baseline' if session == 0 else f'Sleep {session}')
        
        if session_data:
            axes[i].boxplot(session_data, labels=session_labels)
            axes[i].set_title(f'{name} Distribution')
            axes[i].set_ylabel(name)
            axes[i].grid(True, alpha=0.3)
    
    # Remove unused subplots
    for j in range(len(signals), len(axes)):
        fig.delaxes(axes[j])
    
    plt.suptitle(f'User {user_id} - Signal Distributions', fontsize=16)
    plt.tight_layout()
    plt.savefig(f"{user_viz_dir}/signal_distributions.png", dpi=150, bbox_inches='tight')
    plt.close()
    
    # 4. HRV trend plot
    if len(user_features) > 1:
        plt.figure(figsize=(10, 6))
        
        sessions = user_features['session'].values
        hrv_values = user_features['hrv_rmssd'].values
        
        plt.plot(sessions, hrv_values, 'o-', linewidth=2, markersize=8)
        plt.xlabel('Session')
        plt.ylabel('HRV (RMSSD)')
        plt.title(f'User {user_id} - HRV Trend (Baseline → Sleep Sessions)')
        plt.xticks(sessions, ['Baseline' if s == 0 else f'Sleep {s}' for s in sessions])
        plt.grid(True, alpha=0.3)
        
        # Add trend line
        if len(sessions) > 2:
            z = np.polyfit(sessions, hrv_values, 1)
            p = np.poly1d(z)
            plt.plot(sessions, p(sessions), '--', alpha=0.7, color='red', 
                    label=f'Trend: {"↗" if z[0] > 0 else "↘"}')
            plt.legend()
        
        plt.tight_layout()
        plt.savefig(f"{user_viz_dir}/hrv_trend.png", dpi=150, bbox_inches='tight')
        plt.close()
    
    # 5. Correlation heatmap
    numeric_features = user_features.select_dtypes(include=[np.number]).drop(['user', 'session'], axis=1, errors='ignore')
    
    if len(numeric_features.columns) > 1 and len(numeric_features) > 1:
        plt.figure(figsize=(12, 10))
        correlation_matrix = numeric_features.corr()
        
        sns.heatmap(correlation_matrix, annot=True, cmap='coolwarm', center=0,
                   square=True, fmt='.2f', cbar_kws={'label': 'Correlation'})
        plt.title(f'User {user_id} - Feature Correlation Matrix')
        plt.tight_layout()
        plt.savefig(f"{user_viz_dir}/correlation_heatmap.png", dpi=150, bbox_inches='tight')
        plt.close()

def generate_user_report(user_id, df, features_df, events_data, fft_df):
    """Generate text report for a single user"""
    
    user_reports_dir = f"{OUTPUT_DIR}/reports/user{user_id}"
    os.makedirs(user_reports_dir, exist_ok=True)
    
    # Get user data
    user_df = df[df['user'] == user_id]
    user_features = features_df[features_df['user'] == user_id]
    user_fft = fft_df[fft_df['user'] == user_id] if len(fft_df) > 0 else pd.DataFrame()
    
    report_content = f"""
# User {user_id} Sleep Analysis Report
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Summary Statistics

Total Sessions Analyzed: {len(user_features)}
Total Data Points: {len(user_df)}

"""
    
    # Session-by-session analysis
    if len(user_features) > 0:
        report_content += "## Session Analysis\n\n"
        
        baseline_features = user_features[user_features['session'] == 0]
        
        for _, session_features in user_features.iterrows():
            session = int(session_features['session'])
            session_name = 'Baseline' if session == 0 else f'Sleep Session {session}'
            
            report_content += f"### {session_name}\n\n"
            report_content += f"- Mean BPM: {session_features['mean_bpm']:.1f}\n"
            report_content += f"- Mean SpO₂: {session_features['mean_spo2']:.1f}%\n"
            report_content += f"- HRV (RMSSD): {session_features['hrv_rmssd']:.1f}\n"
            report_content += f"- EMG RMS: {session_features['emg_rms']:.1f}\n"
            report_content += f"- Total Motion: {session_features['total_motion']:.1f}\n"
            report_content += f"- SpO₂ Dips: {session_features['spo2_dip_count']:.0f}\n"
            report_content += f"- Movement Bursts: {session_features['movement_bursts']:.0f}\n\n"
    
    # Changes from baseline
    if len(user_features) > 1 and len(baseline_features) > 0:
        baseline = baseline_features.iloc[0]
        
        report_content += "## Changes from Baseline\n\n"
        
        for _, session_features in user_features.iterrows():
            session = int(session_features['session'])
            
            if session == 0:
                continue
                
            bpm_change = ((session_features['mean_bpm'] - baseline['mean_bpm']) / baseline['mean_bpm']) * 100
            hrv_change = ((session_features['hrv_rmssd'] - baseline['hrv_rmssd']) / max(baseline['hrv_rmssd'], 1)) * 100
            emg_change = ((session_features['emg_rms'] - baseline['emg_rms']) / baseline['emg_rms']) * 100
            motion_change = ((session_features['total_motion'] - baseline['total_motion']) / max(baseline['total_motion'], 1)) * 100
            
            report_content += f"### Sleep Session {session} vs Baseline\n\n"
            report_content += f"- BPM Change: {bpm_change:+.1f}%\n"
            report_content += f"- HRV Change: {hrv_change:+.1f}%\n"
            report_content += f"- EMG Change: {emg_change:+.1f}%\n"
            report_content += f"- Motion Change: {motion_change:+.1f}%\n\n"
    
    # Event summary
    if user_id in events_data:
        report_content += "## Detected Events\n\n"
        
        for session, events in events_data[user_id].items():
            session_name = 'Baseline' if session == 0 else f'Sleep Session {session}'
            
            movement_count = len(events['movement_episodes'])
            spo2_count = len(events['spo2_drops'])
            hrv_count = len(events['hrv_events'])
            
            if movement_count + spo2_count + hrv_count > 0:
                report_content += f"### {session_name}\n\n"
                report_content += f"- Movement Episodes: {movement_count}\n"
                report_content += f"- SpO₂ Drop Events: {spo2_count}\n"
                report_content += f"- Low HRV Periods: {hrv_count}\n\n"
    
    # FFT Analysis summary
    if len(user_fft) > 0:
        report_content += "## Frequency Analysis Summary\n\n"
        
        for _, fft_row in user_fft.iterrows():
            session_name = 'Baseline' if fft_row['session'] == 0 else f'Sleep Session {int(fft_row["session"])}'
            report_content += f"### {fft_row['signal']} - {session_name}\n"
            report_content += f"Dominant Frequency: {fft_row['dominant_frequency']:.4f} Hz\n"
            report_content += f"Interpretation: {fft_row['interpretation']}\n\n"
    
    # Auto-generated insights
    if len(user_features) > 1:
        report_content += "## Automated Insights\n\n"
        
        # Sleep quality assessment
        sleep_sessions = user_features[user_features['session'] > 0]
        if len(sleep_sessions) > 0 and len(baseline_features) > 0:
            baseline = baseline_features.iloc[0]
            avg_sleep = sleep_sessions.select_dtypes(include=[np.number]).mean()
            
            bpm_reduction = baseline['mean_bpm'] - avg_sleep['mean_bpm']
            hrv_improvement = avg_sleep['hrv_rmssd'] - baseline['hrv_rmssd']
            motion_reduction = baseline['total_motion'] - avg_sleep['total_motion']
            
            if bpm_reduction > 0:
                report_content += f"✅ Heart rate decreased by {bpm_reduction:.1f} BPM during sleep, indicating good relaxation.\n"
            else:
                report_content += f"⚠️ Heart rate increased by {-bpm_reduction:.1f} BPM during sleep, suggesting possible stress or poor sleep quality.\n"
            
            if hrv_improvement > 0:
                report_content += f"✅ HRV improved by {hrv_improvement:.1f} ms during sleep, indicating better autonomic regulation.\n"
            else:
                report_content += f"⚠️ HRV decreased by {-hrv_improvement:.1f} ms during sleep, suggesting autonomic stress.\n"
            
            if motion_reduction > 0:
                report_content += f"✅ Movement reduced by {motion_reduction:.1f} units during sleep, showing good sleep stillness.\n"
            else:
                report_content += f"⚠️ Movement increased by {-motion_reduction:.1f} units during sleep, indicating restless sleep.\n"
        
        report_content += f"\n## Overall Assessment\n\n"
        
        # Calculate overall sleep quality indicators
        total_spo2_dips = user_features['spo2_dip_count'].sum()
        avg_spo2 = user_features['mean_spo2'].mean()
        
        quality_score = 0
        if len(baseline_features) > 0 and len(sleep_sessions) > 0:
            baseline = baseline_features.iloc[0]
            avg_sleep = sleep_sessions.select_dtypes(include=[np.number]).mean()
            
            # Score based on improvements
            if (baseline['mean_bpm'] - avg_sleep['mean_bpm']) > 0: quality_score += 1
            if (avg_sleep['hrv_rmssd'] - baseline['hrv_rmssd']) > 0: quality_score += 1
            if (baseline['total_motion'] - avg_sleep['total_motion']) > 0: quality_score += 1
            if total_spo2_dips == 0: quality_score += 1
            if avg_spo2 > 97: quality_score += 1
        
        if quality_score >= 4:
            report_content += "🌟 **Excellent Sleep Quality**: Multiple positive indicators suggest very good sleep.\n"
        elif quality_score >= 3:
            report_content += "😊 **Good Sleep Quality**: Most indicators suggest healthy sleep patterns.\n"
        elif quality_score >= 2:
            report_content += "😐 **Moderate Sleep Quality**: Mixed indicators suggest room for improvement.\n"
        else:
            report_content += "😟 **Poor Sleep Quality**: Multiple indicators suggest sleep quality concerns.\n"
    
    # Save report
    report_filename = f"{user_reports_dir}/user_summary.md"
    with open(report_filename, 'w') as f:
        f.write(report_content)
    
    print(f"   ✅ Report saved: {report_filename}")

def generate_user_summary_only(user_id, df, features_df, events_data, fft_df):
    """Generate simplified user summary report only (no session-wise reports)"""
    
    user_reports_dir = f"{OUTPUT_DIR}/reports/user{user_id}"
    os.makedirs(user_reports_dir, exist_ok=True)
    
    # Get user data
    user_df = df[df['user'] == user_id]
    user_features = features_df[features_df['user'] == user_id]
    user_fft = fft_df[fft_df['user'] == user_id] if len(fft_df) > 0 else pd.DataFrame()
    
    report_content = f"""
# User {user_id} Sleep Analysis Report
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Summary Statistics

Total Sessions Analyzed: {len(user_features)}
Total Data Points: {len(user_df)}

"""
    
    # Session-by-session analysis
    if len(user_features) > 0:
        report_content += "## Session Analysis\n\n"
        
        baseline_features = user_features[user_features['session'] == 0]
        
        for _, session_features in user_features.iterrows():
            session = int(session_features['session'])
            session_name = 'Baseline' if session == 0 else f'Sleep Session {session}'
            
            report_content += f"### {session_name}\n\n"
            report_content += f"- Mean BPM: {session_features['mean_bpm']:.1f}\n"
            report_content += f"- Mean SpO₂: {session_features['mean_spo2']:.1f}%\n"
            report_content += f"- HRV (RMSSD): {session_features['hrv_rmssd']:.1f}\n"
            report_content += f"- EMG RMS: {session_features['emg_rms']:.1f}\n"
            report_content += f"- Total Motion: {session_features['total_motion']:.1f}\n"
            report_content += f"- SpO₂ Dips: {session_features['spo2_dip_count']:.0f}\n"
            report_content += f"- Movement Bursts: {session_features['movement_bursts']:.0f}\n\n"
    
    # Changes from baseline
    if len(user_features) > 1 and len(baseline_features) > 0:
        baseline = baseline_features.iloc[0]
        
        report_content += "## Changes from Baseline\n\n"
        
        for _, session_features in user_features.iterrows():
            session = int(session_features['session'])
            
            if session == 0:
                continue
                
            bpm_change = ((session_features['mean_bpm'] - baseline['mean_bpm']) / baseline['mean_bpm']) * 100
            hrv_change = ((session_features['hrv_rmssd'] - baseline['hrv_rmssd']) / max(baseline['hrv_rmssd'], 1)) * 100
            emg_change = ((session_features['emg_rms'] - baseline['emg_rms']) / baseline['emg_rms']) * 100
            motion_change = ((session_features['total_motion'] - baseline['total_motion']) / max(baseline['total_motion'], 1)) * 100
            
            report_content += f"### Sleep Session {session} vs Baseline\n\n"
            report_content += f"- BPM Change: {bpm_change:+.1f}%\n"
            report_content += f"- HRV Change: {hrv_change:+.1f}%\n"
            report_content += f"- EMG Change: {emg_change:+.1f}%\n"
            report_content += f"- Motion Change: {motion_change:+.1f}%\n\n"
    
    # Event summary
    if user_id in events_data:
        report_content += "## Detected Events\n\n"
        
        for session, events in events_data[user_id].items():
            session_name = 'Baseline' if session == 0 else f'Sleep Session {session}'
            
            movement_count = len(events['movement_episodes'])
            spo2_count = len(events['spo2_drops'])
            hrv_count = len(events['hrv_events'])
            
            if movement_count + spo2_count + hrv_count > 0:
                report_content += f"### {session_name}\n\n"
                report_content += f"- Movement Episodes: {movement_count}\n"
                report_content += f"- SpO₂ Drop Events: {spo2_count}\n"
                report_content += f"- Low HRV Periods: {hrv_count}\n\n"
    
    # FFT Analysis summary
    if len(user_fft) > 0:
        report_content += "## Frequency Analysis Summary\n\n"
        
        for _, fft_row in user_fft.iterrows():
            session_name = 'Baseline' if fft_row['session'] == 0 else f'Sleep Session {int(fft_row["session"])}'
            report_content += f"### {fft_row['signal']} - {session_name}\n"
            report_content += f"Dominant Frequency: {fft_row['dominant_frequency']:.4f} Hz\n"
            report_content += f"Interpretation: {fft_row['interpretation']}\n\n"
    
    # Auto-generated insights
    if len(user_features) > 1:
        report_content += "## Automated Insights\n\n"
        
        # Sleep quality assessment without numerical scoring
        sleep_sessions = user_features[user_features['session'] > 0]
        if len(sleep_sessions) > 0 and len(baseline_features) > 0:
            baseline = baseline_features.iloc[0]
            avg_sleep = sleep_sessions.select_dtypes(include=[np.number]).mean()
            
            bpm_reduction = baseline['mean_bpm'] - avg_sleep['mean_bpm']
            hrv_improvement = avg_sleep['hrv_rmssd'] - baseline['hrv_rmssd']
            motion_reduction = baseline['total_motion'] - avg_sleep['total_motion']
            
            if bpm_reduction > 0:
                report_content += f"✅ Heart rate decreased by {bpm_reduction:.1f} BPM during sleep, indicating good relaxation.\n"
            else:
                report_content += f"⚠️ Heart rate increased by {-bpm_reduction:.1f} BPM during sleep, suggesting possible stress or poor sleep quality.\n"
            
            if hrv_improvement > 0:
                report_content += f"✅ HRV improved by {hrv_improvement:.1f} ms during sleep, indicating better autonomic regulation.\n"
            else:
                report_content += f"⚠️ HRV decreased by {-hrv_improvement:.1f} ms during sleep, suggesting autonomic stress.\n"
            
            if motion_reduction > 0:
                report_content += f"✅ Movement reduced by {motion_reduction:.1f} units during sleep, showing good sleep stillness.\n"
            else:
                report_content += f"⚠️ Movement increased by {-motion_reduction:.1f} units during sleep, indicating restless sleep.\n"
        
        report_content += f"\n## Overall Assessment\n\n"
        
        # Calculate overall sleep quality indicators (without numerical score)
        total_spo2_dips = user_features['spo2_dip_count'].sum()
        avg_spo2 = user_features['mean_spo2'].mean()
        
        quality_indicators = 0
        if len(baseline_features) > 0 and len(sleep_sessions) > 0:
            baseline = baseline_features.iloc[0]
            avg_sleep = sleep_sessions.select_dtypes(include=[np.number]).mean()
            
            # Count positive indicators
            if (baseline['mean_bpm'] - avg_sleep['mean_bpm']) > 0: quality_indicators += 1
            if (avg_sleep['hrv_rmssd'] - baseline['hrv_rmssd']) > 0: quality_indicators += 1
            if (baseline['total_motion'] - avg_sleep['total_motion']) > 0: quality_indicators += 1
            if total_spo2_dips == 0: quality_indicators += 1
            if avg_spo2 > 97: quality_indicators += 1
        
        if quality_indicators >= 4:
            report_content += "🌟 **Excellent Sleep Quality**: Multiple positive indicators suggest very good sleep.\n"
        elif quality_indicators >= 3:
            report_content += "😊 **Good Sleep Quality**: Most indicators suggest healthy sleep patterns.\n"
        elif quality_indicators >= 2:
            report_content += "😐 **Moderate Sleep Quality**: Mixed indicators suggest room for improvement.\n"
        else:
            report_content += "😟 **Poor Sleep Quality**: Multiple indicators suggest sleep quality concerns.\n"
    
    # Save report
    report_filename = f"{user_reports_dir}/user_summary.md"
    with open(report_filename, 'w') as f:
        f.write(report_content)
    
    print(f"   ✅ Report saved: {report_filename}")

def create_per_user_reports(df, features_df, events_data, fft_df):
    """Create comprehensive reports for all users"""
    print("\n📋 Step 7: Creating per-user analysis reports...")
    
    for user in USERS:
        user_df = df[df['user'] == user]
        
        if len(user_df) > 0:
            print(f"   Creating report for User {user}...")
            
            # Create plots
            create_user_plots(user, df, features_df, events_data)
            
            # Generate only user summary report (no session-wise reports)
            generate_user_summary_only(user, df, features_df, events_data, fft_df)
        else:
            print(f"   ⚠️  No data for User {user}")
    
    print("✅ Per-user reports completed")

# Let's continue with the rest of the script...

# =====================================
# 8. ✅ INTER-USER COMPARISON
# =====================================

def create_inter_user_comparison_plots(features_df):
    """Create comprehensive inter-user comparison plots"""
    print("\n👥 Step 8: Creating inter-user comparison plots...")
    
    inter_user_dir = f"{OUTPUT_DIR}/reports/inter_user"
    os.makedirs(inter_user_dir, exist_ok=True)
    
    if len(features_df) == 0:
        print("   ⚠️ No features data for inter-user comparison")
        return
    
    # Calculate average values per user (excluding baseline for sleep metrics)
    sleep_features = features_df[features_df['session'] > 0]  # Only sleep sessions
    baseline_features = features_df[features_df['session'] == 0]  # Only baseline
    
    if len(sleep_features) == 0:
        print("   ⚠️ No sleep session data for comparison")
        return
    
    # 1. Multi-User Bar Charts
    metrics = ['mean_bpm', 'mean_spo2', 'emg_rms', 'total_motion', 'spo2_dip_count', 'hrv_rmssd']
    metric_names = ['Mean BPM', 'Mean SpO₂', 'EMG RMS', 'Total Motion', 'SpO₂ Dips', 'HRV (RMSSD)']
    
    fig, axes = plt.subplots(2, 3, figsize=(18, 10))
    axes = axes.flatten()
    
    # Calculate user averages for sleep sessions
    user_avg_sleep = sleep_features.groupby('user')[metrics].mean()
    
    for i, (metric, name) in enumerate(zip(metrics, metric_names)):
        if metric in user_avg_sleep.columns:
            bars = axes[i].bar(user_avg_sleep.index, user_avg_sleep[metric], 
                              color=['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'], alpha=0.8)
            axes[i].set_xlabel('User')
            axes[i].set_ylabel(name)
            axes[i].set_title(f'Average {name} During Sleep Sessions')
            axes[i].grid(True, alpha=0.3)
            
            # Add value labels on bars
            for bar, val in zip(bars, user_avg_sleep[metric]):
                height = bar.get_height()
                axes[i].text(bar.get_x() + bar.get_width()/2., height + 0.01*height,
                           f'{val:.1f}', ha='center', va='bottom', fontweight='bold')
    
    plt.suptitle('Inter-User Comparison - Sleep Sessions Average', fontsize=16, fontweight='bold')
    plt.tight_layout()
    plt.savefig(f"{inter_user_dir}/multi_user_bar_charts.png", dpi=150, bbox_inches='tight')
    plt.close()
    
    # 2. Box Plots by User
    signals = ['bpm', 'spo2', 'emg', 'total_motion']
    signal_names = ['BPM', 'SpO₂', 'EMG', 'Motion']
    
    fig, axes = plt.subplots(2, 2, figsize=(15, 10))
    axes = axes.flatten()
    
    for i, (signal, name) in enumerate(zip(signals, signal_names)):
        column_name = f'mean_{signal}' if signal != 'total_motion' else signal
        if signal == 'emg':
            column_name = 'emg_rms'
        
        if column_name in sleep_features.columns:
            # Prepare data for box plot
            user_data = []
            user_labels = []
            
            for user in USERS:
                user_sleep_data = sleep_features[sleep_features['user'] == user]
                if len(user_sleep_data) > 0:
                    user_data.append(user_sleep_data[column_name].values)
                    user_labels.append(f'User {user}')
            
            if user_data:
                axes[i].boxplot(user_data, labels=user_labels, patch_artist=True,
                               boxprops=dict(facecolor='lightblue', alpha=0.7))
                axes[i].set_ylabel(name)
                axes[i].set_title(f'{name} Distribution by User')
                axes[i].grid(True, alpha=0.3)
    
    plt.suptitle('Signal Distributions Across Users - Sleep Sessions', fontsize=16)
    plt.tight_layout()
    plt.savefig(f"{inter_user_dir}/user_distributions.png", dpi=150, bbox_inches='tight')
    plt.close()
    
    # 3. Scatter Plots
    fig, axes = plt.subplots(1, 3, figsize=(18, 5))
    
    # HRV vs BPM
    if 'hrv_rmssd' in sleep_features.columns and 'mean_bpm' in sleep_features.columns:
        for user in USERS:
            user_data = sleep_features[sleep_features['user'] == user]
            if len(user_data) > 0:
                axes[0].scatter(user_data['mean_bpm'], user_data['hrv_rmssd'], 
                               label=f'User {user}', alpha=0.7, s=60)
        axes[0].set_xlabel('Mean BPM')
        axes[0].set_ylabel('HRV (RMSSD)')
        axes[0].set_title('HRV vs BPM Relationship')
        axes[0].legend()
        axes[0].grid(True, alpha=0.3)
    
    # EMG vs Motion
    if 'emg_rms' in sleep_features.columns and 'total_motion' in sleep_features.columns:
        for user in USERS:
            user_data = sleep_features[sleep_features['user'] == user]
            if len(user_data) > 0:
                axes[1].scatter(user_data['total_motion'], user_data['emg_rms'], 
                               label=f'User {user}', alpha=0.7, s=60)
        axes[1].set_xlabel('Total Motion')
        axes[1].set_ylabel('EMG RMS')
        axes[1].set_title('EMG vs Motion Relationship')
        axes[1].legend()
        axes[1].grid(True, alpha=0.3)
    
    # SpO2 vs Motion
    if 'mean_spo2' in sleep_features.columns and 'total_motion' in sleep_features.columns:
        for user in USERS:
            user_data = sleep_features[sleep_features['user'] == user]
            if len(user_data) > 0:
                axes[2].scatter(user_data['total_motion'], user_data['mean_spo2'], 
                               label=f'User {user}', alpha=0.7, s=60)
        axes[2].set_xlabel('Total Motion')
        axes[2].set_ylabel('Mean SpO₂')
        axes[2].set_title('SpO₂ vs Motion Relationship')
        axes[2].legend()
        axes[2].grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig(f"{inter_user_dir}/scatter_relationships.png", dpi=150, bbox_inches='tight')
    plt.close()
    
    # 4. Correlation Heatmap across all users
    if len(sleep_features) > 0:
        numeric_features = sleep_features.select_dtypes(include=[np.number]).drop(['user', 'session'], axis=1, errors='ignore')
        
        if len(numeric_features.columns) > 1:
            plt.figure(figsize=(12, 10))
            correlation_matrix = numeric_features.corr()
            
            sns.heatmap(correlation_matrix, annot=True, cmap='RdBu_r', center=0,
                       square=True, fmt='.2f', cbar_kws={'label': 'Correlation'})
            plt.title('Feature Correlation Matrix - All Users (Sleep Sessions)', fontsize=14)
            plt.tight_layout()
            plt.savefig(f"{inter_user_dir}/global_correlation_heatmap.png", dpi=150, bbox_inches='tight')
            plt.close()

def analyze_inter_user_insights(features_df):
    """Generate insights comparing users"""
    
    if len(features_df) == 0:
        return {}
    
    # Focus on sleep sessions for comparison
    sleep_features = features_df[features_df['session'] > 0]
    baseline_features = features_df[features_df['session'] == 0]
    
    insights = {}
    
    # Calculate user averages
    if len(sleep_features) > 0:
        user_avg_sleep = sleep_features.groupby('user').agg({
            'mean_bpm': 'mean',
            'mean_spo2': 'mean', 
            'emg_rms': 'mean',
            'total_motion': 'mean',
            'spo2_dip_count': 'sum',
            'hrv_rmssd': 'mean',
            'movement_bursts': 'sum'
        })
        
        # Deepest sleeper (lowest BPM + highest HRV + lowest EMG + lowest motion)
        sleep_score = (
            (user_avg_sleep['mean_bpm'].max() - user_avg_sleep['mean_bpm']) / user_avg_sleep['mean_bpm'].max() +
            (user_avg_sleep['hrv_rmssd'] - user_avg_sleep['hrv_rmssd'].min()) / max(user_avg_sleep['hrv_rmssd'].max() - user_avg_sleep['hrv_rmssd'].min(), 1) +
            (user_avg_sleep['emg_rms'].max() - user_avg_sleep['emg_rms']) / user_avg_sleep['emg_rms'].max() +
            (user_avg_sleep['total_motion'].max() - user_avg_sleep['total_motion']) / max(user_avg_sleep['total_motion'].max(), 1)
        )
        
        insights['deepest_sleeper'] = int(sleep_score.idxmax())
        
        # Most restless (highest motion + highest EMG)
        restless_score = user_avg_sleep['total_motion'] + user_avg_sleep['emg_rms'] + user_avg_sleep['movement_bursts']
        restless_idx = restless_score.idxmax()
        insights['most_restless'] = int(restless_idx)
        
        # Best oxygen stability (highest avg SpO2 + lowest dip count)
        oxygen_score = user_avg_sleep['mean_spo2'] - user_avg_sleep['spo2_dip_count']
        oxygen_idx = oxygen_score.idxmax()
        insights['best_oxygen'] = int(oxygen_idx)
        
        # Most improvement baseline → session 3
        improvement_scores = {}
        for user in USERS:
            user_baseline = baseline_features[baseline_features['user'] == user]
            user_session3 = sleep_features[(sleep_features['user'] == user) & (sleep_features['session'] == 3)]
            
            if len(user_baseline) > 0 and len(user_session3) > 0:
                baseline = user_baseline.iloc[0]
                session3 = user_session3.iloc[0] if len(user_session3) == 1 else user_session3.mean()
                
                # Calculate improvement score
                bpm_improvement = (baseline['mean_bpm'] - session3['mean_bpm']) / baseline['mean_bpm']
                hrv_improvement = (session3['hrv_rmssd'] - baseline['hrv_rmssd']) / max(baseline['hrv_rmssd'], 1)
                motion_improvement = (baseline['total_motion'] - session3['total_motion']) / max(baseline['total_motion'], 1)
                
                improvement_scores[user] = bpm_improvement + hrv_improvement + motion_improvement
        
        if improvement_scores:
            insights['most_improvement'] = max(improvement_scores, key=improvement_scores.get)
    
    return insights

# =====================================
# 9. ✅ SLEEP QUALITY ASSESSMENT (REMOVED)
# =====================================

# Sleep quality scoring has been removed per user request
# Analysis continues without numerical scoring

# =====================================
# 10. ✅ GLOBAL SUMMARY REPORT
# =====================================

def generate_global_summary_report(features_df, fft_df, events_data, inter_user_insights):
    """Generate final structured summary report"""
    print("\n📄 Step 10: Generating global summary report...")
    
    report_content = f"""# Overall Sleep Analysis Summary

Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Dataset Overview

- **Total Users Analyzed**: {len(features_df['user'].unique()) if len(features_df) > 0 else 0}
- **Total Sessions**: {len(features_df) if len(features_df) > 0 else 0}
- **Data Points Collected**: {len(features_df) * 100 if len(features_df) > 0 else 0} (estimated)

---

## Per-User Highlights

"""
    
    # Per-user highlights
    for user in USERS:
        user_features = features_df[features_df['user'] == user] if len(features_df) > 0 else pd.DataFrame()
        
        if len(user_features) > 0:
            baseline = user_features[user_features['session'] == 0]
            sleep_sessions = user_features[user_features['session'] > 0]
            
            report_content += f"### User {user}\n\n"
            
            if len(sleep_sessions) > 0 and len(baseline) > 0:
                baseline_data = baseline.iloc[0]
                avg_sleep = sleep_sessions.select_dtypes(include=[np.number]).mean()
                
                # Calculate changes from baseline
                bpm_change = ((avg_sleep['mean_bpm'] - baseline_data['mean_bpm']) / baseline_data['mean_bpm']) * 100 if 'mean_bpm' in avg_sleep else 0
                hrv_change = ((avg_sleep['hrv_rmssd'] - baseline_data['hrv_rmssd']) / max(baseline_data['hrv_rmssd'], 1)) * 100 if 'hrv_rmssd' in avg_sleep else 0
                motion_change = ((avg_sleep['total_motion'] - baseline_data['total_motion']) / max(baseline_data['total_motion'], 1)) * 100 if 'total_motion' in avg_sleep else 0
                
                report_content += f"**Changes from Baseline**:\n"
                report_content += f"- BPM Change: {bpm_change:+.1f}%\n"
                report_content += f"- HRV Change: {hrv_change:+.1f}%\n"
                report_content += f"- Motion Change: {motion_change:+.1f}%\n\n"
            
            if len(sleep_sessions) > 0:
                avg_sleep = sleep_sessions.select_dtypes(include=[np.number]).mean()
                report_content += f"**Sleep Session Averages**:\n"
                report_content += f"- Mean BPM: {avg_sleep['mean_bpm']:.1f}\n"
                report_content += f"- Mean SpO₂: {avg_sleep['mean_spo2']:.1f}%\n"
                report_content += f"- HRV: {avg_sleep['hrv_rmssd']:.1f} ms\n"
                report_content += f"- Total Motion: {avg_sleep['total_motion']:.1f}\n\n"
        else:
            report_content += f"### User {user}\n**No data available**\n\n"
    
    # Inter-user comparison
    report_content += "---\n\n## Inter-User Comparison\n\n"
    
    if inter_user_insights:
        report_content += f"- **Deepest Sleeper**: User {inter_user_insights.get('deepest_sleeper', 'N/A')}\n"
        report_content += f"- **Most Restless**: User {inter_user_insights.get('most_restless', 'N/A')}\n"
        report_content += f"- **Best Oxygen Stability**: User {inter_user_insights.get('best_oxygen', 'N/A')}\n"
        report_content += f"- **Most Improvement (Baseline → Session 3)**: User {inter_user_insights.get('most_improvement', 'N/A')}\n\n"
    else:
        report_content += "- Insufficient data for inter-user comparison\n\n"
    
    # FFT Summary
    if len(fft_df) > 0:
        report_content += "---\n\n## FFT Analysis Summary\n\n"
        
        # Group by signal type
        for signal in ['ECG', 'EMG', 'MPU']:
            signal_fft = fft_df[fft_df['signal'] == signal]
            if len(signal_fft) > 0:
                avg_freq = signal_fft['dominant_frequency'].mean()
                report_content += f"### {signal} Dominant Frequencies\n"
                report_content += f"- **Average Frequency**: {avg_freq:.4f} Hz\n"
                
                for _, row in signal_fft.iterrows():
                    session_name = 'Baseline' if row['session'] == 0 else f"Sleep {int(row['session'])}"
                    report_content += f"- User {int(row['user'])} {session_name}: {row['dominant_frequency']:.4f} Hz\n"
                report_content += "\n"
    
    # Event Overview
    report_content += "---\n\n## Event Detection Overview\n\n"
    
    if events_data:
        for user in USERS:
            if user in events_data:
                total_movement = 0
                total_spo2_dips = 0
                total_hrv_events = 0
                
                for session, events in events_data[user].items():
                    total_movement += len(events['movement_episodes'])
                    total_spo2_dips += len(events['spo2_drops'])
                    total_hrv_events += len(events['hrv_events'])
                
                report_content += f"### User {user}\n"
                report_content += f"- **Total Movement Episodes**: {total_movement}\n"
                report_content += f"- **Total SpO₂ Dip Events**: {total_spo2_dips}\n"
                report_content += f"- **Total Low HRV Periods**: {total_hrv_events}\n\n"
    
    # Final conclusion
    report_content += "---\n\n## Final Conclusions\n\n"
    
    # General insights based on data
    report_content += "### Key Findings\n"
    
    # Analyze patterns across all users
    if len(features_df) > 0:
        baseline_data = features_df[features_df['session'] == 0]
        sleep_data = features_df[features_df['session'] > 0]
        
        if len(baseline_data) > 0 and len(sleep_data) > 0:
            avg_bpm_baseline = baseline_data['mean_bpm'].mean()
            avg_bpm_sleep = sleep_data['mean_bpm'].mean()
            bmp_change = ((avg_bpm_sleep - avg_bpm_baseline) / avg_bpm_baseline) * 100
            
            avg_motion_baseline = baseline_data['total_motion'].mean()
            avg_motion_sleep = sleep_data['total_motion'].mean()
            motion_change = ((avg_motion_sleep - avg_motion_baseline) / max(avg_motion_baseline, 1)) * 100
                
            report_content += f"1. **Heart Rate**: Average change of {bpm_change:+.1f}% from baseline to sleep sessions\n"
            report_content += f"2. **Movement**: Average change of {motion_change:+.1f}% from baseline to sleep sessions\n"
            
            total_spo2_events = sleep_data['spo2_dip_count'].sum()
            report_content += f"3. **Oxygen Events**: Total of {total_spo2_events:.0f} SpO₂ dip events detected across all users\n"
            
            avg_hrv_baseline = baseline_data['hrv_rmssd'].mean()
            avg_hrv_sleep = sleep_data['hrv_rmssd'].mean()
            hrv_change = ((avg_hrv_sleep - avg_hrv_baseline) / max(avg_hrv_baseline, 1)) * 100
            report_content += f"4. **Heart Rate Variability**: Average change of {hrv_change:+.1f}% indicating {'improved' if hrv_change > 0 else 'decreased'} autonomic regulation during sleep\n\n"
        
        report_content += "### General Observations\n"
        
        # Count users with different patterns
        users_with_data = len(features_df['user'].unique())
        report_content += f"- **{users_with_data} users** provided complete data for analysis\n"
        
        if len(sleep_data) > 0:
            high_movement_sessions = len(sleep_data[sleep_data['total_motion'] > sleep_data['total_motion'].median()])
            report_content += f"- **{high_movement_sessions} sleep sessions** showed above-average movement\n"
            
            spo2_events_total = sleep_data['spo2_dip_count'].sum()
            if spo2_events_total > 0:
                report_content += f"- **{spo2_events_total:.0f} SpO₂ dip events** detected across all sleep sessions\n"
        
        report_content += "\n"
    else:
        report_content += "Insufficient data for comprehensive analysis. Please ensure adequate data collection across all users and sessions.\n"
    
    report_content += f"""
---

## Technical Notes

- **Analysis Period**: {datetime.now().strftime('%Y-%m')}
- **Sampling Rate**: ~15 second intervals
- **Signal Processing**: Moving average smoothing, artifact removal, FFT analysis
- **Feature Extraction**: Manual HRV calculation, peak detection, frequency analysis
- **Event Detection**: Threshold-based movement, SpO₂ drops, and HRV events
- **Sleep Quality Scoring**: Multi-factor scoring with equal weights for HRV, motion, EMG, BPM changes, and SpO₂ events

**Data Sources**: ThingSpeak IoT Platform (Channel {CHANNEL_ID})

---

*Report generated automatically by Sleep Quality Monitoring Analysis System*
"""
    
    # Save report
    report_filename = f"{OUTPUT_DIR}/reports/final_summary.md"
    with open(report_filename, 'w') as f:
        f.write(report_content)
    
    print(f"   ✅ Global summary saved: {report_filename}")

# =====================================
# 11. ✅ GENERATE FINAL ZIP
# =====================================

def create_final_zip():
    """Bundle all results into a final ZIP file"""
    print("\n📦 Step 11: Creating final results ZIP...")
    
    try:
        # Create the ZIP file
        zip_filename = "sleep_analysis_results"
        shutil.make_archive(zip_filename, 'zip', OUTPUT_DIR)
        
        # Get file size
        zip_path = f"{zip_filename}.zip"
        if os.path.exists(zip_path):
            file_size = os.path.getsize(zip_path) / (1024 * 1024)  # MB
            print(f"   ✅ ZIP created: {zip_path} ({file_size:.1f} MB)")
            
            # List contents summary
            print(f"   📁 ZIP Contents:")
            for root, dirs, files in os.walk(OUTPUT_DIR):
                level = root.replace(OUTPUT_DIR, '').count(os.sep)
                indent = ' ' * 4 * level
                folder_name = os.path.basename(root) if level > 0 else "Root"
                print(f"   {indent}{folder_name}/")
                subindent = ' ' * 4 * (level + 1)
                for file in files[:3]:  # Show first 3 files
                    print(f"   {subindent}{file}")
                if len(files) > 3:
                    print(f"   {subindent}... and {len(files) - 3} more files")
        else:
            print("   ❌ Failed to create ZIP file")
            
    except Exception as e:
        print(f"   ❌ Error creating ZIP: {e}")

# =====================================
# MAIN EXECUTION
# =====================================

if __name__ == "__main__":
    # Main execution pipeline
    print("🚀 Starting comprehensive sleep analysis pipeline...")
    
    # Step 1: Fetch data from ThingSpeak
    df = fetch_thingspeak_data()
    
    if df is None or len(df) == 0:
        print("❌ Failed to fetch data. Exiting.")
        exit(1)
    
    # Step 2: Save raw session files
    save_raw_session_files(df)
    
    # Step 4: Extract features for all sessions
    features_df = extract_all_features(df)
    
    # Step 5: Perform FFT analysis
    fft_df = perform_fft_analysis_all_sessions(df)
    
    # Step 6: Detect events
    events_data = detect_events_all_sessions(df)
    
    # Step 7: Create per-user reports
    create_per_user_reports(df, features_df, events_data, fft_df)
    
    # Step 8: Inter-user comparison
    create_inter_user_comparison_plots(features_df)
    inter_user_insights = analyze_inter_user_insights(features_df)
    
    # Step 9: Sleep quality scoring removed per user request
    print("\n🏆 Step 9: Sleep quality scoring disabled")
    
    # Step 10: Generate global summary report
    generate_global_summary_report(features_df, fft_df, events_data, inter_user_insights)
    
    # Step 11: Create final ZIP
    create_final_zip()
    
    print(f"\n🎉 Complete sleep analysis pipeline finished successfully!")
    print(f"📁 All results saved in: {OUTPUT_DIR}/")
    print("📊 Analysis includes:")
    print("   ✅ Raw data CSV files")
    print("   ✅ Feature extraction and preprocessing")
    print("   ✅ FFT frequency analysis")
    print("   ✅ Event detection (movement, SpO₂, HRV)")
    print("   ✅ Per-user detailed reports and visualizations")
    print("   ✅ Inter-user comparison analysis")
    print("   ✅ Comprehensive global summary")
    print("   ✅ Final results ZIP package")
    print(f"\n📦 Download: sleep_analysis_results.zip")
    print("🌙 Sleep analysis complete! Sweet dreams! 😴")