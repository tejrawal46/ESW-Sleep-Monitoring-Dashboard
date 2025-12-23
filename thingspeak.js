// ThingSpeak API Integration
class ThingSpeakAPI {
    constructor() {
        this.config = this.getConfig();
        this.baseUrl = 'https://api.thingspeak.com/channels';
        this.apiServerUrl = 'http://localhost:5000/api';  // Python API server
        // Detect if we're on GitHub Pages (or any non-localhost)
        this.useLocalAPI = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        this.cache = new Map();
        this.lastUpdate = null;
        this.updateInterval = null;
        
        if (!this.useLocalAPI) {
            console.log('Running on GitHub Pages - using ThingSpeak direct access only');
        }
    }
    
    getConfig() {
        // Use hardcoded configuration from config.js
        if (typeof THINGSPEAK_CONFIG !== 'undefined') {
            return THINGSPEAK_CONFIG;
        }
        
        // Fallback configuration if config.js didn't load
        console.warn('THINGSPEAK_CONFIG not found, using fallback');
        return {
            channelId: '3188672',
            readApiKey: 'W1N28S1IJEC81SI6',
            numberOfResults: 8000,
            fields: {
                1: 'BPM',
                2: 'SpO2',
                3: 'ECG',
                4: 'Temp',
                5: 'EMG',
                6: 'MPU',
                7: 'UserID',
                8: 'SessionID'
            }
        };
    }

    async fetchData(results = null) {
        // Try local API first for processed data with analysis
        if (this.useLocalAPI) {
            try {
                const response = await fetch(`${this.apiServerUrl}/subjects`);
                if (response.ok) {
                    const data = await response.json();
                    console.log('Successfully fetched data from local API:', data);
                    this.cache.set('allData', data);
                    this.lastUpdate = new Date();
                    return data;
                }
            } catch (error) {
                console.warn('Local API not available, falling back to ThingSpeak:', error);
                this.useLocalAPI = false;
            }
        }
        
        // Fallback to ThingSpeak direct
        if (!this.config) {
            throw new Error('ThingSpeak configuration not found. Please check config.js.');
        }
        
        const numResults = results || this.config.numberOfResults || 100;
        const url = `${this.baseUrl}/${this.config.channelId}/feeds.json?api_key=${this.config.readApiKey}&results=${numResults}`;
        
        try {
            console.log('Fetching data from ThingSpeak:', url);
            const response = await fetch(url, {
                method: 'GET',
                // Remove custom headers that trigger CORS preflight
                // cache: 'no-store' is enough
                cache: 'no-store'
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            // Cache the data
            this.cache.set('allData', data);
            this.lastUpdate = new Date();
            
            console.log('Successfully fetched data:', {
                channel: data.channel?.name || 'Sleep Quality Channel',
                feeds: data.feeds?.length || 0,
                latestEntry: data.feeds?.[data.feeds.length - 1]?.created_at
            });
            
            return data;
        } catch (error) {
            console.error('Error fetching ThingSpeak data:', error);
            
            // Return cached data if available
            if (this.cache.has('allData')) {
                console.log('Returning cached data due to fetch error');
                return this.cache.get('allData');
            }
            
            throw error;
        }
    }

    async getAllSubjectsData() {
        // Use local API for processed data
        if (this.useLocalAPI) {
            try {
                console.log('Attempting to fetch from Python API...');
                const response = await fetch(`${this.apiServerUrl}/subjects`, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    console.log('✅ Successfully fetched from Python API:', data);
                    
                    // Transform to expected format
                    const result = {
                        subjects: {},
                        lastUpdate: data.lastUpdate,
                        totalFeeds: data.totalFeeds,
                        channel: data.channel
                    };
                    
                    // Map subjects - JSON converts integer keys to strings, so handle both
                    for (let userId = 1; userId <= 4; userId++) {
                        // Try both string and integer keys
                        const subjectData = data.subjects[userId] || data.subjects[userId.toString()];
                        
                        if (subjectData) {
                            result.subjects[userId] = subjectData;
                        } else {
                            result.subjects[userId] = {
                                baseline: null,
                                nap1: null,
                                nap2: null,
                                nap3: null,
                                rawData: [],
                                lastUpdated: new Date().toISOString()
                            };
                        }
                    }
                    
                    console.log('Transformed data for website:', result);
                    return result;
                } else {
                    console.warn('Python API responded with error:', response.status);
                    throw new Error(`API responded with status ${response.status}`);
                }
            } catch (error) {
                console.warn('⚠️ Python API failed, falling back to ThingSpeak direct:', error.message);
                this.useLocalAPI = false;
                // Fall through to ThingSpeak fallback below
            }
        }
        
        // Fallback to original implementation (ThingSpeak direct)
        console.log('Using ThingSpeak direct connection...');
        try {
            const allData = await this.fetchData();
            const subjects = {};
            
            // Parse data for subjects 1-4
            for (let subjectId = 1; subjectId <= 4; subjectId++) {
                subjects[subjectId] = this.parseSubjectData(allData, subjectId);
            }
            
            return {
                subjects,
                lastUpdate: new Date().toISOString(),
                totalFeeds: allData.feeds?.length || 0,
                channel: allData.channel
            };
        } catch (error) {
            console.error('Error getting all subjects data:', error);
            throw error;
        }
    }

    async fetchLatestData(since = null) {
        // Fetch only new data since last update
        if (!this.config) {
            throw new Error('ThingSpeak configuration not found.');
        }
        
        let url = `${this.baseUrl}/${this.config.channelId}/feeds.json?api_key=${this.config.readApiKey}&results=10`;
        
        if (since) {
            // Add timestamp filter if provided
            const sinceDate = new Date(since);
            url += `&start=${sinceDate.toISOString()}`;
        }
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            // Update cache with new data
            if (this.cache.has('allData')) {
                const cachedData = this.cache.get('allData');
                if (data.feeds && data.feeds.length > 0) {
                    // Merge new feeds with cached data
                    const existingFeeds = cachedData.feeds || [];
                    const newFeeds = data.feeds.filter(feed => 
                        !existingFeeds.some(existing => existing.created_at === feed.created_at)
                    );
                    
                    if (newFeeds.length > 0) {
                        cachedData.feeds = [...existingFeeds, ...newFeeds];
                        this.cache.set('allData', cachedData);
                        console.log(`Added ${newFeeds.length} new data points`);
                    }
                }
            }
            
            return data;
        } catch (error) {
            console.error('Error fetching latest data:', error);
            throw error;
        }
    }

    startRealTimeUpdates(intervalSeconds = 30) {
        // Start polling for new data
        console.log(`Starting real-time updates every ${intervalSeconds} seconds`);
        
        this.updateInterval = setInterval(async () => {
            try {
                const since = this.lastUpdate || new Date(Date.now() - 5 * 60 * 1000); // Last 5 minutes
                await this.fetchLatestData(since);
                this.lastUpdate = new Date();
                
                // Trigger data update event
                document.dispatchEvent(new CustomEvent('thingspeakDataUpdate', {
                    detail: { timestamp: this.lastUpdate }
                }));
                
            } catch (error) {
                console.error('Real-time update failed:', error);
            }
        }, intervalSeconds * 1000);
    }

    stopRealTimeUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
            console.log('Stopped real-time updates');
        }
    }    async fetchFieldData(fieldNumber, results = null) {
        if (!this.config) {
            throw new Error('ThingSpeak configuration not found.');
        }
        
        const numResults = results || this.config.numberOfResults || 100;
        const url = `${this.baseUrl}/${this.config.channelId}/fields/${fieldNumber}.json?api_key=${this.config.readApiKey}&results=${numResults}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching field data:', error);
            throw error;
        }
    }
    
    // Parse data for specific subject using UserID field to filter
    parseSubjectData(allData, subjectId) {
        const feeds = allData.feeds || [];
        
        if (feeds.length === 0) {
            console.log('No feeds data available');
            return null;
        }
        
        // Filter feeds by UserID (assuming UserID field maps to subject)
        const subjectFeeds = feeds.filter(feed => {
            const userIdValue = feed.field7; // UserID is field 7
            return userIdValue && parseInt(userIdValue) === subjectId;
        });
        
        console.log(`Found ${subjectFeeds.length} entries for subject ${subjectId}`);
        
        if (subjectFeeds.length === 0) {
            console.log(`No data found for subject ${subjectId}`);
            // Return structure with null values but proper format
            return {
                baseline: null,
                nap1: null,
                nap2: null,
                nap3: null,
                rawData: []
            };
        }
        
        // Group by SessionID to separate baseline and nap sessions
        const sessions = this.groupBySession(subjectFeeds);
        
        // Calculate sleep quality scores from biometric data
        const subjectData = {
            baseline: this.calculateSleepScore(sessions.baseline || [], 'baseline'),
            nap1: this.calculateSleepScore(sessions.nap1 || [], 'nap1'),
            nap2: this.calculateSleepScore(sessions.nap2 || [], 'nap2'),
            nap3: this.calculateSleepScore(sessions.nap3 || [], 'nap3'),
            rawData: subjectFeeds,
            lastUpdated: new Date().toISOString()
        };
        
        console.log(`Processed data for subject ${subjectId}:`, {
            baseline: subjectData.baseline?.value || 'No data',
            nap1: subjectData.nap1?.value || 'No data',
            nap2: subjectData.nap2?.value || 'No data',
            nap3: subjectData.nap3?.value || 'No data',
            totalEntries: subjectFeeds.length
        });
        
        return subjectData;
    }
    
    groupBySession(feeds) {
        const sessions = {
            baseline: [],
            nap1: [],
            nap2: [],
            nap3: []
        };
        
        feeds.forEach(feed => {
            const sessionId = feed.field8; // SessionID is field 8
            if (sessionId) {
                const sessionType = this.mapSessionId(sessionId);
                if (sessions[sessionType]) {
                    sessions[sessionType].push(feed);
                }
            } else {
                // If no session ID, try to infer from timestamp or default to baseline
                sessions.baseline.push(feed);
            }
        });
        
        // Sort each session by timestamp
        Object.keys(sessions).forEach(key => {
            sessions[key].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        });
        
        return sessions;
    }
    
    mapSessionId(sessionId) {
        // Map SessionID to session type - flexible mapping
        const id = sessionId.toString().toLowerCase();
        
        if (id === '0' || id === 'baseline' || id === 'base') {
            return 'baseline';
        } else if (id === '1' || id === 'nap1') {
            return 'nap1';
        } else if (id === '2' || id === 'nap2') {
            return 'nap2';
        } else if (id === '3' || id === 'nap3') {
            return 'nap3';
        } else {
            // Default to baseline for unknown session IDs
            return 'baseline';
        }
    }
    
    calculateSleepScore(sessionFeeds, sessionType) {
        if (!sessionFeeds || sessionFeeds.length === 0) {
            // Return empty structure instead of null so display functions work
            return {
                mean_bpm: null,
                latest_bpm: null,
                mean_spo2: null,
                latest_spo2: null,
                min_spo2: null,
                latest_ecg: null,
                latest_emg: null,
                emg_rms: null,
                latest_mpu: null,
                total_motion: null,
                data_points: 0,
                latest_timestamp: null,
                start_timestamp: null,
                end_timestamp: null,
                hrv_rmssd: null,
                hrv_sdnn: null,
                spo2_dip_count: 0,
                sleep_quality_score: null
            };
        }
        
        // Get the most recent reading from this session
        const latestFeed = sessionFeeds[sessionFeeds.length - 1];
        
        // Extract biometric values with validation
        const bpm = this.parseNumericValue(latestFeed.field1);      // Heart Rate
        const spo2 = this.parseNumericValue(latestFeed.field2);     // Blood Oxygen
        const ecg = this.parseNumericValue(latestFeed.field3);      // ECG
        const temp = this.parseNumericValue(latestFeed.field4);     // Temperature
        const emg = this.parseNumericValue(latestFeed.field5);      // Muscle activity
        const mpu = this.parseNumericValue(latestFeed.field6);      // Motion data
        
        console.log(`Calculating sleep score for ${sessionType}:`, {
            bpm, spo2, ecg, temp, emg, mpu,
            timestamp: latestFeed.created_at
        });
        
        // Calculate a composite sleep quality score (0-100)
        let score = 100;
        let validReadings = 0;
        
        // Heart rate contribution (ideal sleeping HR: 40-80 bpm)
        if (bpm !== null && bpm > 0) {
            validReadings++;
            if (bpm < 40 || bpm > 80) {
                score -= Math.abs(bpm - 60) * 0.5;
            }
        }
        
        // SpO2 contribution (ideal: >95%)
        if (spo2 !== null && spo2 > 0) {
            validReadings++;
            if (spo2 < 95) {
                score -= (95 - spo2) * 2;
            }
        }
        
        // Temperature contribution (ideal: 96-100°F)
        if (temp !== null && temp > 0) {
            validReadings++;
            if (temp < 96 || temp > 100) {
                score -= Math.abs(temp - 98) * 1.5;
            }
        }
        
        // Motion contribution (less motion = better sleep)
        if (mpu !== null) {
            validReadings++;
            score -= Math.abs(mpu) * 0.1;
        }
        
        // EMG contribution (less muscle activity = better sleep)
        if (emg !== null) {
            validReadings++;
            score -= Math.abs(emg) * 0.05;
        }
        
        // Ensure score is between 0 and 100
        score = Math.max(0, Math.min(100, score));
        
        // If we don't have enough valid readings, lower the confidence
        if (validReadings < 3) {
            score *= (validReadings / 3); // Reduce score based on missing data
        }
        
        // Return data in Python API format for compatibility with displaySubjectDataDirect()
        return {
            mean_bpm: bpm,
            latest_bpm: bpm,
            mean_spo2: spo2,
            latest_spo2: spo2,
            min_spo2: spo2,  // approximation
            latest_ecg: ecg,
            latest_emg: emg,
            emg_rms: emg,
            latest_mpu: mpu,
            total_motion: mpu,
            data_points: sessionFeeds.length,
            latest_timestamp: latestFeed.created_at,
            start_timestamp: sessionFeeds[0]?.created_at,
            end_timestamp: latestFeed.created_at,
            hrv_rmssd: null,  // not calculated from single readings
            hrv_sdnn: null,
            spo2_dip_count: 0,  // would need multiple readings to calculate
            sleep_quality_score: Math.round(score * 100) / 100
        };
    }
    
    parseNumericValue(value) {
        if (value === null || value === undefined || value === '') {
            return null;
        }
        const num = parseFloat(value);
        return isNaN(num) ? null : num;
    }

    async getAllSubjectsData() {
        try {
            const allData = await this.fetchData();
            
            const subjects = {};
            for (let subjectId = 1; subjectId <= 4; subjectId++) {
                subjects[subjectId] = this.parseSubjectData(allData, subjectId);
            }
            
            return {
                subjects,
                lastUpdate: new Date().toISOString(),
                totalFeeds: allData.feeds?.length || 0,
                channel: allData.channel
            };
        } catch (error) {
            console.error('Error getting all subjects data:', error);
            throw error;
        }
    }
    
    extractLatestValue(feeds, fieldName) {
        // Get the latest non-null value for a field
        for (let i = feeds.length - 1; i >= 0; i--) {
            const value = feeds[i][fieldName];
            if (value !== null && value !== undefined && value !== '') {
                return {
                    value: parseFloat(value),
                    timestamp: feeds[i].created_at
                };
            }
        }
        return null;
    }
}

// Note: FormDataManager and SleepAnalyzer classes are defined in subject.js
