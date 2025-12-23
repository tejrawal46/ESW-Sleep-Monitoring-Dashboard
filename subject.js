// Subject page controller - Real-time data integration
let currentSubjectId = null;

function initializeSubject(subjectId) {
    currentSubjectId = subjectId;
    
    console.log(`Initializing Subject ${subjectId} page...`);
    
    // Load data directly instead of waiting for data manager
    loadSubjectDataDirect();
}

async function loadSubjectDataDirect() {
    const loadingMsg = document.getElementById('loadingMessage');
    const errorMsg = document.getElementById('errorMessage');
    
    try {
        console.log('Loading subject data directly from API...');
        console.log('Current URL:', window.location.href);
        console.log('Hostname:', window.location.hostname);
        
        // Skip localhost API check for GitHub Pages users
        const isLocalhost = window.location.hostname === 'localhost' || 
                          window.location.hostname === '127.0.0.1';
        
        console.log('Is localhost?', isLocalhost);
        
        // Try Python API only if on localhost
        if (isLocalhost) {
            try {
                const response = await fetch(`http://localhost:5000/api/subject/${currentSubjectId}`);
                if (response.ok) {
                    const data = await response.json();
                    console.log('✅ Loaded from Python API:', data);
                    displaySubjectDataDirect(data);
                    hideLoading();
                    hideError();
                    return;
                }
            } catch (apiError) {
                console.warn('Python API not available:', apiError);
            }
        }
        
        console.log('Attempting to load from ThingSpeak...');
        
        // Fallback to ThingSpeak
        const api = new ThingSpeakAPI();
        console.log('ThingSpeakAPI instance created');
        
        const allData = await api.getAllSubjectsData();
        console.log('All data received:', allData);
        console.log('Current subject ID:', currentSubjectId, 'Type:', typeof currentSubjectId);
        console.log('Available subjects:', Object.keys(allData.subjects || {}));
        
        const subjectData = allData.subjects[currentSubjectId];
        console.log('Subject data for ID', currentSubjectId, ':', subjectData);
        
        if (subjectData && (subjectData.baseline || subjectData.nap1 || subjectData.nap2 || subjectData.nap3)) {
            console.log('✅ Loaded from ThingSpeak - has data:', subjectData);
            displaySubjectDataDirect(subjectData);
            hideLoading();
            hideError();
        } else {
            console.error('❌ No valid data for subject', currentSubjectId);
            console.error('Subject data:', subjectData);
            throw new Error(`No data available for Subject ${currentSubjectId}. Available: ${Object.keys(allData.subjects || {}).join(', ')}`);
        }
    } catch (error) {
        console.error('Error loading subject data:', error);
        
        const isLocalhost = window.location.hostname === 'localhost' || 
                          window.location.hostname === '127.0.0.1';
        
        if (isLocalhost) {
            // On localhost, show the actual error so you can debug
            showError(`Error: ${error.message}`);
            hideLoading();
        } else {
            // For deployed site, silently hide the error and show empty data (dashes)
            hideLoading();
            hideError();
            
            // Display empty data structure so page shows dashes instead of being blank
            displaySubjectDataDirect({
                baseline: {},
                nap1: {},
                nap2: {},
                nap3: {}
            });
        }
    }
}

function displaySubjectDataDirect(data) {
    console.log('Displaying subject data:', data);
    
    // Show visualization sections
    const overviewSection = document.getElementById('overviewSection');
    const fftSection = document.getElementById('fftSection');
    
    if (overviewSection) overviewSection.style.display = 'block';
    if (fftSection) fftSection.style.display = 'block';
    
    // Create session metrics cards in the container
    const metricsContainer = document.getElementById('sessionMetricsContainer');
    if (metricsContainer) {
        metricsContainer.innerHTML = ''; // Clear previous content
        
        const sessions = [
            { key: 'baseline', title: '📋 Baseline Measurement', icon: '🏁' },
            { key: 'nap1', title: '😴 Nap Session 1', icon: '1️⃣' },
            { key: 'nap2', title: '😴 Nap Session 2', icon: '2️⃣' },
            { key: 'nap3', title: '😴 Nap Session 3', icon: '3️⃣' }
        ];
        
        sessions.forEach(session => {
            const sessionData = data[session.key];
            if (sessionData) {
                const card = createSessionMetricsCard(session.title, sessionData);
                metricsContainer.appendChild(card);
            }
        });
    }
    
    // Display each session (legacy support)
    const sessions = ['baseline', 'nap1', 'nap2', 'nap3'];
    
    sessions.forEach((session, index) => {
        const sessionData = data[session];
        
        if (sessionData) {
            const sessionName = session === 'baseline' ? 'baseline' : `nap${session.charAt(3)}`;
            const scoreId = `${sessionName}Score`;
            const timeId = `${sessionName}Time`;
            
            const scoreElement = document.getElementById(scoreId);
            const timeElement = document.getElementById(timeId);
            
            if (scoreElement) {
                const score = sessionData.mean_bpm ? sessionData.mean_bpm.toFixed(1) : '--';
                scoreElement.textContent = `${score} BPM`;
            }
            
            if (timeElement) {
                const timestamp = sessionData.latest_timestamp || sessionData.end_timestamp;
                if (timestamp) {
                    timeElement.textContent = new Date(timestamp).toLocaleString();
                } else {
                    timeElement.textContent = '--';
                }
            }
        }
    });
}

function createSessionMetricsCard(title, sessionData) {
    const card = document.createElement('div');
    card.className = 'session-metrics-card';
    
    const metrics = [
        { label: '❤️ Heart Rate', value: sessionData.mean_bpm?.toFixed(1), unit: 'BPM' },
        { label: '💓 HRV (RMSSD)', value: sessionData.hrv_rmssd?.toFixed(1), unit: 'ms' },
        { label: '🩸 Blood Oxygen', value: sessionData.mean_spo2?.toFixed(1), unit: '%' },
        { label: '📉 Min SpO2', value: sessionData.min_spo2?.toFixed(1), unit: '%' },
        { label: '⚠️ SpO2 Dips', value: sessionData.spo2_dip_count || 0, unit: 'events' },
        { label: '💪 EMG (RMS)', value: sessionData.emg_rms?.toFixed(1), unit: '' },
        { label: '🏃 Total Motion', value: sessionData.total_motion?.toFixed(1), unit: '' },
        { label: '📊 Data Points', value: sessionData.data_points || 0, unit: 'samples' }
    ];
    
    const metricsHTML = metrics.map(m => `
        <div class="metric-item">
            <strong>${m.label}</strong>
            <div class="value">${m.value || '--'} <span style="font-size: 0.8rem; color: var(--neutral-500);">${m.unit}</span></div>
        </div>
    `).join('');
    
    card.innerHTML = `
        <h3>${title}</h3>
        <div class="metrics-grid">
            ${metricsHTML}
        </div>
    `;
    
    return card;
}

function createSessionDetailDisplay(sessionKey, sessionData) {
    const sessionName = sessionKey === 'baseline' ? 'Baseline' : 
                       `Nap Session ${sessionKey.charAt(3)}`;
    const sectionId = sessionKey === 'baseline' ? 'baselineSection' : `${sessionKey}Section`;
    const section = document.getElementById(sectionId);
    
    if (!section) return;
    
    // Find or create data display
    let dataDisplay = section.querySelector('.session-metrics');
    if (!dataDisplay) {
        dataDisplay = document.createElement('div');
        dataDisplay.className = 'session-metrics';
        dataDisplay.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin: 1rem 0;
            padding: 1rem;
            background: #f9fafb;
            border-radius: 0.5rem;
        `;
        
        const formSection = section.querySelector('.form-section');
        if (formSection) {
            section.insertBefore(dataDisplay, formSection);
        } else {
            section.appendChild(dataDisplay);
        }
    }
    
    dataDisplay.innerHTML = `
        <div class="metric">
            <strong>❤️ Heart Rate:</strong><br>
            ${sessionData.mean_bpm?.toFixed(1) || '--'} BPM
        </div>
        <div class="metric">
            <strong>💓 HRV (RMSSD):</strong><br>
            ${sessionData.hrv_rmssd?.toFixed(1) || '--'} ms
        </div>
        <div class="metric">
            <strong>🩸 Blood Oxygen:</strong><br>
            ${sessionData.mean_spo2?.toFixed(1) || '--'}%
        </div>
        <div class="metric">
            <strong>📉 Min SpO2:</strong><br>
            ${sessionData.min_spo2?.toFixed(1) || '--'}%
        </div>
        <div class="metric">
            <strong>⚠️ SpO2 Dips:</strong><br>
            ${sessionData.spo2_dip_count || 0} events
        </div>
        <div class="metric">
            <strong>💪 EMG (RMS):</strong><br>
            ${sessionData.emg_rms?.toFixed(1) || '--'}
        </div>
        <div class="metric">
            <strong>🏃 Total Motion:</strong><br>
            ${sessionData.total_motion?.toFixed(1) || '--'}
        </div>
        <div class="metric">
            <strong>📊 Data Points:</strong><br>
            ${sessionData.data_points || 0}
        </div>
    `;
}

function waitForDataManager() {
    const maxAttempts = 20; // 10 seconds maximum wait
    let attempts = 0;
    
    const checkDataManager = () => {
        attempts++;
        
        if (window.dataManager && window.dataManager.isInitialized) {
            console.log('Data manager ready, loading subject data...');
            loadSubjectData();
            setupDataUpdateListener();
        } else if (attempts < maxAttempts) {
            setTimeout(checkDataManager, 500);
        } else {
            console.error('Data manager initialization timeout');
            showError('Unable to connect to data source. Please refresh the page.');
        }
    };
    
    checkDataManager();
}

function setupDataUpdateListener() {
    if (window.dataManager) {
        window.dataManager.onDataUpdate((subjects) => {
            console.log(`Updating Subject ${currentSubjectId} with new data`);
            loadSubjectData();
        });
        
        window.dataManager.onStatusChange((message, type) => {
            updateConnectionStatus(message, type);
        });
        
        window.dataManager.onError((error) => {
            console.error('Data manager error:', error);
            showError('Connection error: ' + error.message);
        });
    }
}

function setupStatusDisplay() {
    // Add connection status display if it doesn't exist
    if (!document.getElementById('connectionStatus')) {
        const statusDiv = document.createElement('div');
        statusDiv.id = 'connectionStatus';
        statusDiv.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 0.5rem 1rem;
            border-radius: 0.25rem;
            font-size: 0.875rem;
            font-weight: bold;
            z-index: 1000;
            transition: all 0.3s ease;
        `;
        document.body.appendChild(statusDiv);
    }
}

function updateConnectionStatus(message, type) {
    const statusDiv = document.getElementById('connectionStatus');
    if (!statusDiv) return;
    
    statusDiv.textContent = message;
    
    // Reset classes
    statusDiv.className = '';
    
    switch (type) {
        case 'loading':
            statusDiv.style.background = 'var(--warning)';
            statusDiv.style.color = 'white';
            break;
        case 'ready':
            statusDiv.style.background = 'var(--success)';
            statusDiv.style.color = 'white';
            setTimeout(() => {
                statusDiv.style.opacity = '0';
                setTimeout(() => {
                    statusDiv.style.display = 'none';
                }, 300);
            }, 2000);
            break;
        case 'error':
            statusDiv.style.background = 'var(--danger)';
            statusDiv.style.color = 'white';
            break;
    }
    
    statusDiv.style.display = 'block';
    statusDiv.style.opacity = '1';
}

function loadSubjectData() {
    const loadingMsg = document.getElementById('loadingMessage');
    const errorMsg = document.getElementById('errorMessage');
    
    if (!window.dataManager) {
        showError('Data manager not available');
        return;
    }
    
    try {
        const subjectData = window.dataManager.getSubjectData(currentSubjectId);
        
        if (subjectData) {
            displaySubjectData(subjectData);
            hideLoading();
            hideError();
            console.log(`Subject ${currentSubjectId} data loaded:`, subjectData);
        } else {
            showError(`No data available for Subject ${currentSubjectId}. Check if sensors are sending data.`);
        }
    } catch (error) {
        console.error('Error loading subject data:', error);
        showError(`Error: ${error.message}`);
    }
}

function displaySubjectData(data) {
    console.log('Displaying subject data:', data);
    
    // Get latest biometric readings
    const latest = window.dataManager.getLatestBiometrics(currentSubjectId);
    
    if (latest) {
        console.log('Latest biometrics:', latest);
        
        // Display real-time data in a summary section
        updateRealtimeDisplay(latest);
    }
    
    // Create data visualization charts
    createDataCharts(data);
    
    // Display session data
    if (data.sessions && data.sessions.length > 0) {
        displaySessionData(data.sessions);
    }
    
    // Display sleep score if available
    if (data.sleepScore !== undefined) {
        updateSleepScore(data.sleepScore);
    }
    
    // Display last update time
    updateLastUpdateTime(data.lastUpdated);
}

function updateRealtimeDisplay(biometrics) {
    // Add or update real-time data display
    let realtimeSection = document.getElementById('realtimeData');
    
    if (!realtimeSection) {
        // Create real-time data section
        realtimeSection = document.createElement('section');
        realtimeSection.id = 'realtimeData';
        realtimeSection.className = 'realtime-data';
        realtimeSection.innerHTML = `
            <h3>Current Biometric Readings</h3>
            <div class="biometric-grid">
                <div class="biometric-item">
                    <span class="label">Heart Rate:</span>
                    <span class="value" id="currentBPM">--</span>
                    <span class="unit">BPM</span>
                </div>
                <div class="biometric-item">
                    <span class="label">SpO2:</span>
                    <span class="value" id="currentSpO2">--</span>
                    <span class="unit">%</span>
                </div>
                <div class="biometric-item">
                    <span class="label">Temperature:</span>
                    <span class="value" id="currentTemp">--</span>
                    <span class="unit">°C</span>
                </div>
                <div class="biometric-item">
                    <span class="label">ECG:</span>
                    <span class="value" id="currentECG">--</span>
                    <span class="unit">mV</span>
                </div>
                <div class="biometric-item">
                    <span class="label">EMG:</span>
                    <span class="value" id="currentEMG">--</span>
                    <span class="unit">µV</span>
                </div>
                <div class="biometric-item">
                    <span class="label">Motion:</span>
                    <span class="value" id="currentMPU">--</span>
                    <span class="unit">g</span>
                </div>
            </div>
            <div class="last-update">
                Last updated: <span id="biometricTimestamp">--</span>
            </div>
        `;
        
        // Insert after the overview section
        const main = document.querySelector('main');
        const firstSection = main.querySelector('section');
        if (firstSection && firstSection.nextSibling) {
            main.insertBefore(realtimeSection, firstSection.nextSibling);
        } else {
            main.appendChild(realtimeSection);
        }
    }
    
    // Update values
    document.getElementById('currentBPM').textContent = biometrics.bpm || '--';
    document.getElementById('currentSpO2').textContent = biometrics.spo2 || '--';
    document.getElementById('currentTemp').textContent = biometrics.temp || '--';
    document.getElementById('currentECG').textContent = biometrics.ecg || '--';
    document.getElementById('currentEMG').textContent = biometrics.emg || '--';
    document.getElementById('currentMPU').textContent = biometrics.mpu || '--';
    document.getElementById('biometricTimestamp').textContent = formatTimestamp(biometrics.timestamp);
}

function createDataCharts(subjectData) {
    console.log('Creating data charts for subject:', currentSubjectId);
    
    // Get all raw data for this subject
    let rawData = subjectData.rawData || [];
    
    // If no real data, create sample data for demonstration
    if (rawData.length === 0) {
        console.log('No real data available, generating sample data for visualization demo');
        rawData = generateSampleData();
    }
    
    // Create charts section if it doesn't exist
    let chartsSection = document.getElementById('dataCharts');
    if (!chartsSection) {
        chartsSection = document.createElement('section');
        chartsSection.id = 'dataCharts';
        chartsSection.className = 'data-charts';
        chartsSection.innerHTML = `
            <h3>Historical Data Trends</h3>
            <div class="data-status" id="dataStatus">
                ${rawData.length === 0 ? '<p style="color: #f39c12;">⚠ No sensor data available. Showing sample visualization.</p>' : '<p style="color: #10b981;">✓ Showing real sensor data from ThingSpeak.</p>'}
            </div>
            <div class="charts-grid">
                <div class="chart-container">
                    <h4>Heart Rate (BPM)</h4>
                    <canvas id="bpmChart" width="400" height="200"></canvas>
                </div>
                <div class="chart-container">
                    <h4>Blood Oxygen (SpO2)</h4>
                    <canvas id="spo2Chart" width="400" height="200"></canvas>
                </div>
                <div class="chart-container">
                    <h4>Body Temperature (°C)</h4>
                    <canvas id="tempChart" width="400" height="200"></canvas>
                </div>
                <div class="chart-container">
                    <h4>ECG Activity (mV)</h4>
                    <canvas id="ecgChart" width="400" height="200"></canvas>
                </div>
                <div class="chart-container">
                    <h4>EMG Activity (µV)</h4>
                    <canvas id="emgChart" width="400" height="200"></canvas>
                </div>
                <div class="chart-container">
                    <h4>Motion Activity (g)</h4>
                    <canvas id="mpuChart" width="400" height="200"></canvas>
                </div>
            </div>
        `;
        
        // Insert after real-time section
        const realtimeSection = document.getElementById('realtimeData');
        if (realtimeSection && realtimeSection.nextSibling) {
            realtimeSection.parentNode.insertBefore(chartsSection, realtimeSection.nextSibling);
        } else {
            document.querySelector('main').appendChild(chartsSection);
        }
    }
    
    // Prepare data for charts
    const chartData = prepareChartData(rawData);
    
    // Create individual charts
    drawTimeSeriesChart('bpmChart', chartData.bpm, 'Heart Rate', '#e74c3c');
    drawTimeSeriesChart('spo2Chart', chartData.spo2, 'SpO2', '#3498db');
    drawTimeSeriesChart('tempChart', chartData.temp, 'Temperature', '#f39c12');
    drawTimeSeriesChart('ecgChart', chartData.ecg, 'ECG', '#9b59b6');
    drawTimeSeriesChart('emgChart', chartData.emg, 'EMG', '#2ecc71');
    drawTimeSeriesChart('mpuChart', chartData.mpu, 'Motion', '#34495e');
}

function generateSampleData() {
    // Generate 20 sample data points for demonstration
    const sampleData = [];
    const now = new Date();
    
    for (let i = 0; i < 20; i++) {
        const timestamp = new Date(now.getTime() - (19 - i) * 30000); // 30 seconds apart
        
        sampleData.push({
            created_at: timestamp.toISOString(),
            field1: (70 + Math.sin(i * 0.3) * 10 + Math.random() * 5).toFixed(1), // BPM: 65-85
            field2: (97 + Math.sin(i * 0.2) * 2 + Math.random() * 1).toFixed(1), // SpO2: 96-99
            field3: (0.5 + Math.sin(i * 0.4) * 0.3 + Math.random() * 0.1).toFixed(2), // ECG: 0.2-0.8
            field4: (36.5 + Math.sin(i * 0.1) * 0.8 + Math.random() * 0.2).toFixed(1), // Temp: 36-37.5
            field5: (50 + Math.sin(i * 0.6) * 20 + Math.random() * 10).toFixed(1), // EMG: 30-80
            field6: (1.0 + Math.sin(i * 0.5) * 0.5 + Math.random() * 0.2).toFixed(2), // MPU: 0.5-1.7
            field7: currentSubjectId, // UserID
            field8: Math.floor(i / 5) + 1, // SessionID
            entry_id: i + 1
        });
    }
    
    return sampleData;
}

function prepareChartData(rawData) {
    const chartData = {
        bpm: [],
        spo2: [],
        temp: [],
        ecg: [],
        emg: [],
        mpu: []
    };
    
    // Take last 20 data points for cleaner visualization
    const recentData = rawData.slice(-20);
    
    recentData.forEach((entry, index) => {
        const timestamp = new Date(entry.created_at);
        const label = timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        chartData.bpm.push({
            x: index,
            y: parseFloat(entry.field1) || 0,
            label: label,
            timestamp: timestamp
        });
        
        chartData.spo2.push({
            x: index,
            y: parseFloat(entry.field2) || 0,
            label: label,
            timestamp: timestamp
        });
        
        chartData.temp.push({
            x: index,
            y: parseFloat(entry.field4) || 0,
            label: label,
            timestamp: timestamp
        });
        
        chartData.ecg.push({
            x: index,
            y: parseFloat(entry.field3) || 0,
            label: label,
            timestamp: timestamp
        });
        
        chartData.emg.push({
            x: index,
            y: parseFloat(entry.field5) || 0,
            label: label,
            timestamp: timestamp
        });
        
        chartData.mpu.push({
            x: index,
            y: parseFloat(entry.field6) || 0,
            label: label,
            timestamp: timestamp
        });
    });
    
    return chartData;
}

function drawTimeSeriesChart(canvasId, data, title, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !data || data.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Set font
    ctx.font = '12px Times New Roman';
    
    // Find min/max values
    const values = data.map(d => d.y).filter(v => v !== null && !isNaN(v));
    if (values.length === 0) return;
    
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue || 1; // Prevent division by zero
    
    // Draw background grid
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    
    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
        const y = padding + (height - 2 * padding) * i / 5;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
    }
    
    // Vertical grid lines
    const dataLength = data.length || 1;
    for (let i = 0; i <= 5; i++) {
        const x = padding + (width - 2 * padding) * i / 5;
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, height - padding);
        ctx.stroke();
    }
    
    // Draw axes
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    // Y-axis
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    
    // X-axis
    ctx.moveTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();
    
    // Draw data line
    if (values.length > 1) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        let firstPoint = true;
        data.forEach((point, index) => {
            if (point.y !== null && !isNaN(point.y)) {
                const x = padding + ((width - 2 * padding) / (dataLength - 1)) * index;
                const y = height - padding - ((point.y - minValue) / range) * (height - 2 * padding);
                
                if (firstPoint) {
                    ctx.moveTo(x, y);
                    firstPoint = false;
                } else {
                    ctx.lineTo(x, y);
                }
            }
        });
        ctx.stroke();
        
        // Draw data points
        ctx.fillStyle = color;
        data.forEach((point, index) => {
            if (point.y !== null && !isNaN(point.y)) {
                const x = padding + ((width - 2 * padding) / (dataLength - 1)) * index;
                const y = height - padding - ((point.y - minValue) / range) * (height - 2 * padding);
                
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, 2 * Math.PI);
                ctx.fill();
            }
        });
    }
    
    // Add labels
    ctx.fillStyle = '#666';
    ctx.textAlign = 'center';
    
    // Y-axis labels
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
        const value = minValue + (range * (5 - i) / 5);
        const y = padding + (height - 2 * padding) * i / 5;
        ctx.fillText(value.toFixed(1), padding - 5, y + 4);
    }
    
    // X-axis labels (show every 5th point)
    ctx.textAlign = 'center';
    const labelStep = Math.max(1, Math.floor(dataLength / 5));
    for (let i = 0; i < dataLength; i += labelStep) {
        if (data[i] && data[i].label) {
            const x = padding + ((width - 2 * padding) / (dataLength - 1)) * i;
            ctx.fillText(data[i].label, x, height - 10);
        }
    }
}

function displaySessionData(sessions) {
    // For now, we'll use the session data to update the nap scores
    // This can be expanded based on how the session data is structured
    console.log('Session data:', sessions);
    
    // Update nap session displays if we have session-specific data
    sessions.forEach((session, index) => {
        const napNumber = index + 1;
        if (napNumber <= 3) {
            updateNapSession(napNumber, session);
        }
    });
}

function updateNapSession(napNumber, sessionData) {
    const scoreElement = document.getElementById(`nap${napNumber}Score`);
    const timeElement = document.getElementById(`nap${napNumber}Time`);
    
    if (scoreElement && sessionData.score !== undefined) {
        scoreElement.textContent = sessionData.score.toFixed(2);
    }
    
    if (timeElement && sessionData.timestamp) {
        timeElement.textContent = formatTimestamp(sessionData.timestamp);
    }
}

function updateSleepScore(score) {
    // Update all session scores if we have a general sleep score
    for (let i = 1; i <= 3; i++) {
        const scoreElement = document.getElementById(`nap${i}Score`);
        if (scoreElement && scoreElement.textContent === '--') {
            scoreElement.textContent = score.toFixed(2);
        }
    }
    
    // Update baseline score
    const baselineScoreElement = document.getElementById('baselineScore');
    if (baselineScoreElement && baselineScoreElement.textContent === '--') {
        baselineScoreElement.textContent = score.toFixed(2);
    }
}

function updateLastUpdateTime(timestamp) {
    if (!timestamp) return;
    
    const timeElements = document.querySelectorAll('[id$="Time"]');
    timeElements.forEach(element => {
        if (element.textContent === '--') {
            element.textContent = formatTimestamp(timestamp);
        }
    });
}

function hideLoading() {
    const loadingMsg = document.getElementById('loadingMessage');
    if (loadingMsg) {
        loadingMsg.style.display = 'none';
    }
}

function showError(message) {
    hideLoading();
    const errorMsg = document.getElementById('errorMessage');
    if (errorMsg) {
        errorMsg.style.display = 'block';
        errorMsg.textContent = message;
    }
}

function hideError() {
    const errorMsg = document.getElementById('errorMessage');
    if (errorMsg) {
        errorMsg.style.display = 'none';
    }
}

function formatTimestamp(timestamp) {
    if (!timestamp) return '--';
    const date = new Date(timestamp);
    return date.toLocaleString();
}
