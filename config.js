// Hardcoded ThingSpeak Configuration
const THINGSPEAK_CONFIG = {
    channelId: '3188672',
    readApiKey: 'W1N28S1IJEC81SI6',
    numberOfResults: 8000,  // Match Python analysis script
    fields: {
        1: 'BPM',        // Heart Rate (Beats Per Minute)
        2: 'SpO2',       // Blood Oxygen Saturation
        3: 'ECG',        // Electrocardiogram
        4: 'Temp',       // Temperature (ignored, zero values)
        5: 'EMG',        // Electromyography
        6: 'MPU',        // Motion Processing Unit
        7: 'UserID',     // User Identifier (1-4)
        8: 'SessionID'   // Session Identifier (0=baseline, 1-3=sleep sessions)
    }
};

// Legacy compatibility functions
function getConfig() {
    return THINGSPEAK_CONFIG;
}

function loadConfig() {
    // Configuration is now hardcoded, no need to load from localStorage
    console.log('Using hardcoded ThingSpeak configuration');
}

function saveConfig() {
    // Configuration is now hardcoded, no need to save
    showStatus('Configuration is now hardcoded and ready to use!', 'success');
}

function showStatus(message, type) {
    const statusDiv = document.getElementById('configStatus');
    if (statusDiv) {
        statusDiv.className = type;
        statusDiv.textContent = message;
        setTimeout(() => {
            statusDiv.textContent = '';
            statusDiv.className = '';
        }, 5000);
    }
}
