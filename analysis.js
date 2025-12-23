// Overall analysis page controller
let apiClient = null;
let formManager = null;
let analyzer = null;
let allSubjectsData = null;

document.addEventListener('DOMContentLoaded', function() {
    apiClient = new ThingSpeakAPI();
    formManager = new FormDataManager();
    analyzer = new SleepAnalyzer();
    
    loadAllData();
});

async function loadAllData() {
    const loadingMsg = document.getElementById('loadingMessage');
    const errorMsg = document.getElementById('errorMessage');
    
    try {
        const data = await apiClient.fetchData();
        allSubjectsData = {
            subject1: apiClient.parseSubjectData(data, 1),
            subject2: apiClient.parseSubjectData(data, 2),
            subject3: apiClient.parseSubjectData(data, 3)
        };
        
        loadingMsg.style.display = 'none';
        document.getElementById('summaryTable').style.display = 'block';
        
        displaySummaryTable();
        displayComparativeAnalysis();
        displayOverallConclusions();
    } catch (error) {
        console.error('Error loading data:', error);
        loadingMsg.style.display = 'none';
        errorMsg.style.display = 'block';
        errorMsg.textContent = `Error: ${error.message}. Please check your ThingSpeak configuration.`;
    }
    
    // Always display response summary, even if ThingSpeak data is unavailable
    displayResponseSummary();
}

function displaySummaryTable() {
    const tbody = document.getElementById('summaryTableBody');
    tbody.innerHTML = '';
    
    for (let i = 1; i <= 3; i++) {
        const subjectData = allSubjectsData[`subject${i}`];
        if (!subjectData) continue;
        
        const row = document.createElement('tr');
        
        // Subject name
        const subjectCell = document.createElement('td');
        subjectCell.textContent = `Subject ${i}`;
        row.appendChild(subjectCell);
        
        // Baseline
        const baselineCell = document.createElement('td');
        baselineCell.textContent = subjectData.baseline ? subjectData.baseline.value.toFixed(2) : '--';
        row.appendChild(baselineCell);
        
        // Nap sessions and calculate average
        let total = 0;
        let count = 0;
        
        for (let j = 1; j <= 3; j++) {
            const napCell = document.createElement('td');
            const napData = subjectData[`nap${j}`];
            if (napData) {
                napCell.textContent = napData.value.toFixed(2);
                total += napData.value;
                count++;
            } else {
                napCell.textContent = '--';
            }
            row.appendChild(napCell);
        }
        
        // Average
        const avgCell = document.createElement('td');
        if (count > 0) {
            avgCell.textContent = (total / count).toFixed(2);
            avgCell.style.fontWeight = 'bold';
        } else {
            avgCell.textContent = '--';
        }
        row.appendChild(avgCell);
        
        tbody.appendChild(row);
    }
}

function displayComparativeAnalysis() {
    const comparisonDiv = document.getElementById('comparisonAnalysis');
    let analysis = '';
    
    // Find best and worst performers
    let bestSubject = null;
    let worstSubject = null;
    let bestAvg = -Infinity;
    let worstAvg = Infinity;
    
    for (let i = 1; i <= 3; i++) {
        const subjectData = allSubjectsData[`subject${i}`];
        if (!subjectData) continue;
        
        let total = 0;
        let count = 0;
        
        for (let j = 1; j <= 3; j++) {
            const napData = subjectData[`nap${j}`];
            if (napData) {
                total += napData.value;
                count++;
            }
        }
        
        if (count > 0) {
            const avg = total / count;
            if (avg > bestAvg) {
                bestAvg = avg;
                bestSubject = i;
            }
            if (avg < worstAvg) {
                worstAvg = avg;
                worstSubject = i;
            }
        }
    }
    
    analysis += '<div class="conclusion">';
    
    if (bestSubject) {
        analysis += `<p><strong>Best Performance:</strong> Subject ${bestSubject} with an average sleep score of ${bestAvg.toFixed(2)}.</p>`;
    }
    
    if (worstSubject) {
        analysis += `<p><strong>Needs Improvement:</strong> Subject ${worstSubject} with an average sleep score of ${worstAvg.toFixed(2)}.</p>`;
    }
    
    // Baseline comparisons
    analysis += '<p><strong>Baseline Comparisons:</strong></p><ul>';
    for (let i = 1; i <= 3; i++) {
        const subjectData = allSubjectsData[`subject${i}`];
        if (!subjectData || !subjectData.baseline) continue;
        
        let napTotal = 0;
        let napCount = 0;
        
        for (let j = 1; j <= 3; j++) {
            const napData = subjectData[`nap${j}`];
            if (napData) {
                napTotal += napData.value;
                napCount++;
            }
        }
        
        if (napCount > 0) {
            const napAvg = napTotal / napCount;
            const baselineValue = subjectData.baseline.value;
            const difference = napAvg - baselineValue;
            const percentChange = ((difference / baselineValue) * 100).toFixed(1);
            
            let trend = '';
            if (difference > 0) {
                trend = `improved by ${Math.abs(percentChange)}%`;
            } else if (difference < 0) {
                trend = `decreased by ${Math.abs(percentChange)}%`;
            } else {
                trend = 'remained stable';
            }
            
            analysis += `<li>Subject ${i}: Sleep quality ${trend} compared to baseline (${baselineValue.toFixed(2)} → ${napAvg.toFixed(2)})</li>`;
        }
    }
    analysis += '</ul>';
    
    analysis += '</div>';
    
    comparisonDiv.innerHTML = analysis;
}

function displayResponseSummary() {
    const allFormData = formManager.getAllData();
    
    for (let i = 1; i <= 3; i++) {
        const subjectResponses = allFormData[i];
        const responseDiv = document.getElementById(`subject${i}Responses`);
        
        if (!subjectResponses || Object.keys(subjectResponses).length === 0) {
            responseDiv.innerHTML = '<p>No response data available yet.</p>';
            continue;
        }
        
        let html = '';
        
        for (let j = 1; j <= 3; j++) {
            const napResponse = subjectResponses[`nap${j}`];
            if (napResponse) {
                html += `<div class="nap-session">`;
                html += `<h4>Nap ${j}</h4>`;
                html += `<p><strong>Duration:</strong> ${napResponse.sleepDuration || 'N/A'} hours</p>`;
                html += `<p><strong>Self-rated Quality:</strong> ${napResponse.sleepQuality || 'N/A'}/10</p>`;
                if (napResponse.disturbances) {
                    html += `<p><strong>Disturbances:</strong> ${napResponse.disturbances}</p>`;
                }
                if (napResponse.notes) {
                    html += `<p><strong>Notes:</strong> ${napResponse.notes}</p>`;
                }
                html += `<p><em>Submitted: ${new Date(napResponse.timestamp).toLocaleString()}</em></p>`;
                html += `</div>`;
            }
        }
        
        responseDiv.innerHTML = html || '<p>No response data available yet.</p>';
    }
}

function displayOverallConclusions() {
    const conclusionsDiv = document.getElementById('overallConclusions');
    const allFormData = formManager.getAllData();
    
    let conclusions = '<div class="conclusion">';
    conclusions += '<h4>Key Findings:</h4>';
    conclusions += '<ul>';
    
    // Count total responses
    let totalResponses = 0;
    for (let i = 1; i <= 3; i++) {
        const subjectData = allFormData[i];
        if (subjectData) {
            totalResponses += Object.keys(subjectData).length;
        }
    }
    
    conclusions += `<li>Total response forms completed: ${totalResponses} out of 9 possible</li>`;
    
    // Analyze sleep scores across all subjects
    let allScores = [];
    for (let i = 1; i <= 3; i++) {
        const subjectData = allSubjectsData[`subject${i}`];
        if (subjectData) {
            for (let j = 1; j <= 3; j++) {
                const napData = subjectData[`nap${j}`];
                if (napData) {
                    allScores.push(napData.value);
                }
            }
        }
    }
    
    if (allScores.length > 0) {
        const avgScore = allScores.reduce((a, b) => a + b, 0) / allScores.length;
        const maxScore = Math.max(...allScores);
        const minScore = Math.min(...allScores);
        
        conclusions += `<li>Overall average sleep score: ${avgScore.toFixed(2)}</li>`;
        conclusions += `<li>Highest sleep score recorded: ${maxScore.toFixed(2)}</li>`;
        conclusions += `<li>Lowest sleep score recorded: ${minScore.toFixed(2)}</li>`;
        conclusions += `<li>Score variance: ${(maxScore - minScore).toFixed(2)} points</li>`;
    }
    
    conclusions += '</ul>';
    
    conclusions += '<h4>Recommendations:</h4>';
    conclusions += '<ul>';
    conclusions += '<li>Continue monitoring sleep patterns to identify trends over time</li>';
    conclusions += '<li>Correlate form responses with sleep scores to identify factors affecting sleep quality</li>';
    conclusions += '<li>Consider environmental and behavioral factors noted in response forms</li>';
    conclusions += '<li>Subjects with declining scores may benefit from sleep hygiene interventions</li>';
    conclusions += '</ul>';
    
    conclusions += '</div>';
    
    conclusionsDiv.innerHTML = conclusions;
}
