// Data Visualization Enhancement
class DataVisualizer {
    constructor() {
        this.charts = new Map();
        this.colors = {
            primary: '#4f46e5',
            secondary: '#10b981',
            accent: '#f59e0b',
            neutral: '#6b7280'
        };
    }

    createSleepQualityChart(containerId, data) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Create canvas element
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 200;
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        this.drawLineChart(ctx, data, canvas.width, canvas.height);
    }

    drawLineChart(ctx, data, width, height) {
        const padding = 40;
        const chartWidth = width - 2 * padding;
        const chartHeight = height - 2 * padding;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Set styles
        ctx.strokeStyle = this.colors.primary;
        ctx.fillStyle = this.colors.primary;
        ctx.lineWidth = 3;

        // Draw axes
        ctx.beginPath();
        ctx.strokeStyle = this.colors.neutral;
        ctx.lineWidth = 1;
        
        // X-axis
        ctx.moveTo(padding, height - padding);
        ctx.lineTo(width - padding, height - padding);
        
        // Y-axis
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, height - padding);
        ctx.stroke();

        if (!data || data.length === 0) return;

        // Find min/max for scaling
        const values = data.map(d => d.value || 0);
        const minValue = Math.min(...values, 0);
        const maxValue = Math.max(...values, 100);

        // Draw data line
        ctx.beginPath();
        ctx.strokeStyle = this.colors.primary;
        ctx.lineWidth = 3;

        data.forEach((point, index) => {
            const x = padding + (chartWidth / (data.length - 1)) * index;
            const y = height - padding - ((point.value - minValue) / (maxValue - minValue)) * chartHeight;
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();

        // Draw data points
        data.forEach((point, index) => {
            const x = padding + (chartWidth / (data.length - 1)) * index;
            const y = height - padding - ((point.value - minValue) / (maxValue - minValue)) * chartHeight;
            
            ctx.beginPath();
            ctx.fillStyle = this.colors.primary;
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fill();
        });

        // Add labels
        ctx.fillStyle = this.colors.neutral;
        ctx.font = '12px Inter, sans-serif';
        ctx.textAlign = 'center';

        // X-axis labels
        data.forEach((point, index) => {
            const x = padding + (chartWidth / (data.length - 1)) * index;
            ctx.fillText(point.label || `Session ${index + 1}`, x, height - 10);
        });

        // Y-axis labels
        ctx.textAlign = 'right';
        for (let i = 0; i <= 4; i++) {
            const value = minValue + (maxValue - minValue) * (i / 4);
            const y = height - padding - (chartHeight * i / 4);
            ctx.fillText(Math.round(value), padding - 10, y + 4);
        }
    }

    createProgressRing(containerId, percentage, label) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '120');
        svg.setAttribute('height', '120');
        svg.setAttribute('viewBox', '0 0 120 120');

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '60');
        circle.setAttribute('cy', '60');
        circle.setAttribute('r', '50');
        circle.setAttribute('fill', 'none');
        circle.setAttribute('stroke', '#e5e7eb');
        circle.setAttribute('stroke-width', '8');

        const progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        progressCircle.setAttribute('cx', '60');
        progressCircle.setAttribute('cy', '60');
        progressCircle.setAttribute('r', '50');
        progressCircle.setAttribute('fill', 'none');
        progressCircle.setAttribute('stroke', this.colors.primary);
        progressCircle.setAttribute('stroke-width', '8');
        progressCircle.setAttribute('stroke-linecap', 'round');
        
        const circumference = 2 * Math.PI * 50;
        progressCircle.setAttribute('stroke-dasharray', circumference);
        progressCircle.setAttribute('stroke-dashoffset', circumference - (percentage / 100) * circumference);
        progressCircle.style.transform = 'rotate(-90deg)';
        progressCircle.style.transformOrigin = '60px 60px';

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '60');
        text.setAttribute('y', '60');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('font-family', 'Inter, sans-serif');
        text.setAttribute('font-weight', '600');
        text.setAttribute('font-size', '16');
        text.setAttribute('fill', this.colors.primary);
        text.textContent = `${percentage}%`;

        svg.appendChild(circle);
        svg.appendChild(progressCircle);
        svg.appendChild(text);
        
        const wrapper = document.createElement('div');
        wrapper.style.textAlign = 'center';
        wrapper.appendChild(svg);
        
        if (label) {
            const labelEl = document.createElement('div');
            labelEl.textContent = label;
            labelEl.style.marginTop = '0.5rem';
            labelEl.style.fontSize = '0.875rem';
            labelEl.style.color = this.colors.neutral;
            wrapper.appendChild(labelEl);
        }

        container.appendChild(wrapper);
    }

    createBiometricGauge(containerId, value, max, label, unit) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const percentage = (value / max) * 100;
        const isHealthy = percentage >= 70 && percentage <= 100;
        const color = isHealthy ? this.colors.secondary : this.colors.accent;

        const wrapper = document.createElement('div');
        wrapper.className = 'biometric-gauge';
        wrapper.style.cssText = `
            text-align: center;
            padding: 1rem;
            background: white;
            border-radius: 0.75rem;
            border: 1px solid #e5e7eb;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
        `;

        wrapper.innerHTML = `
            <div style="font-size: 2rem; font-weight: 700; color: ${color}; margin-bottom: 0.5rem;">
                ${value}${unit}
            </div>
            <div style="font-size: 0.875rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">
                ${label}
            </div>
            <div style="width: 100%; background: #e5e7eb; height: 4px; border-radius: 2px; margin-top: 0.75rem; overflow: hidden;">
                <div style="width: ${Math.min(percentage, 100)}%; height: 100%; background: ${color}; transition: width 1s ease;"></div>
            </div>
        `;

        // Add hover effect
        wrapper.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px)';
            this.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
        });

        wrapper.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
        });

        container.appendChild(wrapper);
    }

    enhanceDataDisplay() {
        // Enhance existing data displays with visual improvements
        document.querySelectorAll('.data-item').forEach(item => {
            const value = item.querySelector('span');
            const label = item.querySelector('strong');
            
            if (value && label && !isNaN(parseFloat(value.textContent))) {
                const numValue = parseFloat(value.textContent);
                
                // Add visual indicator based on value
                if (label.textContent.includes('Sleep Score')) {
                    item.style.borderLeft = numValue >= 80 ? '4px solid #10b981' : 
                                           numValue >= 60 ? '4px solid #f59e0b' : '4px solid #ef4444';
                }
                
                // Add animated number counter
                this.animateValue(value, 0, numValue, 1000);
            }
        });
    }

    animateValue(element, start, end, duration) {
        const startTime = performance.now();
        const startValue = start;
        const endValue = end;
        
        function updateValue(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentValue = startValue + (endValue - startValue) * easeOut;
            
            element.textContent = Math.round(currentValue * 100) / 100;
            
            if (progress < 1) {
                requestAnimationFrame(updateValue);
            }
        }
        
        requestAnimationFrame(updateValue);
    }
}

// Initialize data visualization when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const visualizer = new DataVisualizer();
    
    // Example usage for sleep quality charts
    setTimeout(() => {
        // Sample data for demonstration
        const sampleData = [
            { label: 'Baseline', value: 65 },
            { label: 'Nap 1', value: 78 },
            { label: 'Nap 2', value: 82 },
            { label: 'Nap 3', value: 75 }
        ];

        // Create charts for each subject if containers exist
        ['subject1Chart', 'subject2Chart', 'subject3Chart'].forEach(id => {
            visualizer.createSleepQualityChart(id, sampleData);
        });

        // Create progress rings for system metrics
        if (document.getElementById('systemAccuracy')) {
            visualizer.createProgressRing('systemAccuracy', 87, 'System Accuracy');
        }
        
        if (document.getElementById('dataReliability')) {
            visualizer.createProgressRing('dataReliability', 94, 'Data Reliability');
        }

        // Enhance existing data displays
        visualizer.enhanceDataDisplay();

    }, 500); // Delay to ensure page is fully loaded
});

// Export for use in other scripts
window.DataVisualizer = DataVisualizer;