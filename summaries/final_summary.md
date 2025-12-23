# Overall Sleep Analysis Summary

Generated: 2025-12-02 06:11:45

## Dataset Overview

- **Total Users Analyzed**: 4
- **Total Sessions**: 16
- **Data Points Collected**: 1600 (estimated)

---

## Per-User Highlights

### User 1

**Changes from Baseline**:
- BPM Change: -8.3%
- HRV Change: +12.3%
- Motion Change: +21.8%

**Sleep Session Averages**:
- Mean BPM: 64.6
- Mean SpO₂: 96.9%
- HRV: 46.2 ms
- Total Motion: 3109.4

### User 2

**Changes from Baseline**:
- BPM Change: -15.7%
- HRV Change: -89.5%
- Motion Change: -25.6%

**Sleep Session Averages**:
- Mean BPM: 60.2
- Mean SpO₂: 97.0%
- HRV: 4.7 ms
- Total Motion: 2816.9

### User 3

**Changes from Baseline**:
- BPM Change: -16.4%
- HRV Change: +12.4%
- Motion Change: -28.4%

**Sleep Session Averages**:
- Mean BPM: 62.9
- Mean SpO₂: 97.0%
- HRV: 41.9 ms
- Total Motion: 2628.6

### User 4

**Changes from Baseline**:
- BPM Change: -15.7%
- HRV Change: -0.6%
- Motion Change: -51.1%

**Sleep Session Averages**:
- Mean BPM: 63.3
- Mean SpO₂: 96.9%
- HRV: 40.5 ms
- Total Motion: 3348.0

---

## Inter-User Comparison

- **Deepest Sleeper**: User 3
- **Most Restless**: User 4
- **Best Oxygen Stability**: User 3
- **Most Improvement (Baseline → Session 3)**: User 4

---

## FFT Analysis Summary

### ECG Dominant Frequencies
- **Average Frequency**: 0.0035 Hz
- User 1 Baseline: 0.0134 Hz
- User 1 Sleep 1: 0.0001 Hz
- User 1 Sleep 2: 0.0001 Hz
- User 1 Sleep 3: 0.0002 Hz
- User 2 Baseline: 0.0147 Hz
- User 2 Sleep 1: 0.0002 Hz
- User 2 Sleep 2: 0.0001 Hz
- User 2 Sleep 3: 0.0002 Hz
- User 3 Baseline: 0.0250 Hz
- User 3 Sleep 1: 0.0001 Hz
- User 3 Sleep 2: 0.0001 Hz
- User 3 Sleep 3: 0.0002 Hz
- User 4 Baseline: 0.0006 Hz
- User 4 Sleep 1: 0.0002 Hz
- User 4 Sleep 2: 0.0001 Hz
- User 4 Sleep 3: 0.0002 Hz

### EMG Dominant Frequencies
- **Average Frequency**: 0.0014 Hz
- User 1 Baseline: 0.0024 Hz
- User 1 Sleep 1: 0.0001 Hz
- User 1 Sleep 2: 0.0001 Hz
- User 1 Sleep 3: 0.0001 Hz
- User 2 Baseline: 0.0038 Hz
- User 2 Sleep 1: 0.0001 Hz
- User 2 Sleep 2: 0.0001 Hz
- User 2 Sleep 3: 0.0002 Hz
- User 3 Baseline: 0.0068 Hz
- User 3 Sleep 1: 0.0001 Hz
- User 3 Sleep 2: 0.0001 Hz
- User 3 Sleep 3: 0.0002 Hz
- User 4 Baseline: 0.0078 Hz
- User 4 Sleep 1: 0.0001 Hz
- User 4 Sleep 2: 0.0001 Hz
- User 4 Sleep 3: 0.0001 Hz

### MPU Dominant Frequencies
- **Average Frequency**: 0.0056 Hz
- User 1 Baseline: 0.0140 Hz
- User 1 Sleep 1: 0.0001 Hz
- User 1 Sleep 2: 0.0001 Hz
- User 1 Sleep 3: 0.0002 Hz
- User 2 Baseline: 0.0250 Hz
- User 2 Sleep 1: 0.0002 Hz
- User 2 Sleep 2: 0.0001 Hz
- User 2 Sleep 3: 0.0002 Hz
- User 3 Baseline: 0.0229 Hz
- User 3 Sleep 1: 0.0001 Hz
- User 3 Sleep 2: 0.0001 Hz
- User 3 Sleep 3: 0.0002 Hz
- User 4 Baseline: 0.0252 Hz
- User 4 Sleep 1: 0.0002 Hz
- User 4 Sleep 2: 0.0001 Hz
- User 4 Sleep 3: 0.0002 Hz

---

## Event Detection Overview

### User 1
- **Total Movement Episodes**: 193
- **Total SpO₂ Dip Events**: 107
- **Total Low HRV Periods**: 78

### User 2
- **Total Movement Episodes**: 216
- **Total SpO₂ Dip Events**: 88
- **Total Low HRV Periods**: 14

### User 3
- **Total Movement Episodes**: 185
- **Total SpO₂ Dip Events**: 87
- **Total Low HRV Periods**: 38

### User 4
- **Total Movement Episodes**: 321
- **Total SpO₂ Dip Events**: 102
- **Total Low HRV Periods**: 92

---

## Final Conclusions

### Key Findings
1. **Heart Rate**: Average change of -15.7% from baseline to sleep sessions
2. **Movement**: Average change of -29.4% from baseline to sleep sessions
3. **Oxygen Events**: Total of 482 SpO₂ dip events detected across all users
4. **Heart Rate Variability**: Average change of -18.5% indicating decreased autonomic regulation during sleep

### General Observations
- **4 users** provided complete data for analysis
- **6 sleep sessions** showed above-average movement
- **482 SpO₂ dip events** detected across all sleep sessions


---

## Technical Notes

- **Analysis Period**: 2025-12
- **Sampling Rate**: ~15 second intervals
- **Signal Processing**: Moving average smoothing, artifact removal, FFT analysis
- **Feature Extraction**: Manual HRV calculation, peak detection, frequency analysis
- **Event Detection**: Threshold-based movement, SpO₂ drops, and HRV events
- **Sleep Quality Scoring**: Multi-factor scoring with equal weights for HRV, motion, EMG, BPM changes, and SpO₂ events

**Data Sources**: ThingSpeak IoT Platform (Channel 3188672)

---

*Report generated automatically by Sleep Quality Monitoring Analysis System*
