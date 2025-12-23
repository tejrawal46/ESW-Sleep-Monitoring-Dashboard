// Real-time Data Manager for ThingSpeak Integration
class RealTimeDataManager {
    constructor() {
        this.api = new ThingSpeakAPI();
        this.isInitialized = false;
        this.subjects = {};
        this.statusCallbacks = [];
        this.dataCallbacks = [];
        this.errorCallbacks = [];
    }

    async initialize() {
        try {
            console.log('Initializing Real-time Data Manager...');
            this.showStatus('Connecting to ThingSpeak...', 'loading');
            
            // Load historical data
            const allData = await this.api.getAllSubjectsData();
            this.subjects = allData.subjects;
            
            console.log('Loaded data for subjects:', Object.keys(this.subjects));
            
            this.isInitialized = true;
            this.showStatus('Connected - Live Data Active', 'ready');
            
            // Start real-time updates (disabled by default - only enable if expecting live data)
            // Uncomment the line below to enable automatic updates every 60 seconds
            // this.api.startRealTimeUpdates(60); // Update every 60 seconds
            
            // Listen for data update events
            document.addEventListener('thingspeakDataUpdate', (event) => {
                this.handleDataUpdate(event.detail);
            });
            
            // Trigger initial data display
            this.notifyDataCallbacks();
            
            return true;
        } catch (error) {
            console.error('Failed to initialize data manager:', error);
            this.showStatus('Connection Failed - Check Network', 'error');
            this.notifyErrorCallbacks(error);
            return false;
        }
    }

    async handleDataUpdate(detail) {
        try {
            console.log('Handling data update at:', detail.timestamp);
            
            // Refresh all subjects data
            const allData = await this.api.getAllSubjectsData();
            
            // Check for actual changes
            let hasChanges = false;
            for (let subjectId = 1; subjectId <= 4; subjectId++) {
                const oldData = this.subjects[subjectId];
                const newData = allData.subjects[subjectId];
                
                if (this.hasDataChanged(oldData, newData)) {
                    hasChanges = true;
                    console.log(`Subject ${subjectId} data updated`);
                }
            }
            
            if (hasChanges) {
                this.subjects = allData.subjects;
                this.notifyDataCallbacks();
                this.showStatus('Data Updated', 'ready');
                
                // Show temporary update notification
                this.showUpdateNotification();
            } else {
                console.log('No new data detected');
            }
            
        } catch (error) {
            console.error('Error handling data update:', error);
            this.showStatus('Update Failed', 'error');
        }
    }

    hasDataChanged(oldData, newData) {
        // If we don't have old data yet, this is initial load - don't show notification
        if (!oldData) return false;
        
        // If no new data, no change
        if (!newData) return false;
        
        // Compare raw data array lengths
        const oldLength = oldData.rawData ? oldData.rawData.length : 0;
        const newLength = newData.rawData ? newData.rawData.length : 0;
        
        if (oldLength !== newLength) {
            return true; // Data length changed
        }
        
        // Compare latest entry IDs if both have data
        if (oldLength > 0 && newLength > 0) {
            const oldLatest = oldData.rawData[oldData.rawData.length - 1];
            const newLatest = newData.rawData[newData.rawData.length - 1];
            
            return oldLatest.entry_id !== newLatest.entry_id;
        }
        
        return false; // No change detected
    }

    showUpdateNotification() {
        // Create a temporary notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--secondary);
            color: white;
            padding: 1rem;
            border-radius: 0.5rem;
            box-shadow: var(--shadow-lg);
            z-index: 1000;
            animation: slideInRight 0.3s ease;
        `;
        notification.textContent = 'New data received';
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    getSubjectData(subjectId) {
        return this.subjects[subjectId] || null;
    }

    getLatestBiometrics(subjectId) {
        const subjectData = this.getSubjectData(subjectId);
        if (!subjectData || !subjectData.rawData || subjectData.rawData.length === 0) {
            return null;
        }
        
        // Get the most recent entry
        const latest = subjectData.rawData[subjectData.rawData.length - 1];
        return {
            bpm: this.api.parseNumericValue(latest.field1),
            spo2: this.api.parseNumericValue(latest.field2),
            ecg: this.api.parseNumericValue(latest.field3),
            temp: this.api.parseNumericValue(latest.field4),
            emg: this.api.parseNumericValue(latest.field5),
            mpu: this.api.parseNumericValue(latest.field6),
            timestamp: latest.created_at,
            entryId: latest.entry_id
        };
    }

    // Event subscription methods
    onStatusChange(callback) {
        this.statusCallbacks.push(callback);
    }

    onDataUpdate(callback) {
        this.dataCallbacks.push(callback);
    }

    onError(callback) {
        this.errorCallbacks.push(callback);
    }

    // Internal notification methods
    showStatus(message, type) {
        this.statusCallbacks.forEach(callback => {
            try {
                callback(message, type);
            } catch (error) {
                console.error('Error in status callback:', error);
            }
        });
    }

    notifyDataCallbacks() {
        this.dataCallbacks.forEach(callback => {
            try {
                callback(this.subjects);
            } catch (error) {
                console.error('Error in data callback:', error);
            }
        });
    }

    notifyErrorCallbacks(error) {
        this.errorCallbacks.forEach(callback => {
            try {
                callback(error);
            } catch (error) {
                console.error('Error in error callback:', error);
            }
        });
    }

    // Manual refresh method
    async refresh() {
        if (!this.isInitialized) {
            return await this.initialize();
        }
        
        try {
            this.showStatus('Refreshing data...', 'loading');
            const allData = await this.api.getAllSubjectsData();
            this.subjects = allData.subjects;
            this.notifyDataCallbacks();
            this.showStatus('Data refreshed', 'ready');
            return true;
        } catch (error) {
            console.error('Error refreshing data:', error);
            this.showStatus('Refresh failed', 'error');
            this.notifyErrorCallbacks(error);
            return false;
        }
    }

    // Cleanup method
    destroy() {
        if (this.api) {
            this.api.stopRealTimeUpdates();
        }
        this.statusCallbacks = [];
        this.dataCallbacks = [];
        this.errorCallbacks = [];
        console.log('Data manager destroyed');
    }
}

// Global data manager instance
window.dataManager = new RealTimeDataManager();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM loaded, initializing data manager...');
    
    // Add loading styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        
        .data-loading {
            background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
            background-size: 200% 100%;
            animation: loading 1.5s infinite;
        }
        
        @keyframes loading {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }
    `;
    document.head.appendChild(style);
    
    // Initialize after a short delay to ensure all scripts are loaded
    setTimeout(async () => {
        try {
            await window.dataManager.initialize();
            console.log('Data manager initialized successfully');
        } catch (error) {
            console.error('Failed to initialize data manager:', error);
        }
    }, 1000);
});

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    if (window.dataManager) {
        window.dataManager.destroy();
    }
});

// Export for use in other scripts
window.RealTimeDataManager = RealTimeDataManager;