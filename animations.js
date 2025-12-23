// Dynamic Website Animations and Effects
document.addEventListener('DOMContentLoaded', function() {
    initializeAnimations();
    initializeInteractiveElements();
    initializeDataVisualization();
});

function initializeAnimations() {
    // Smooth scroll for navigation links
    document.querySelectorAll('nav a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Intersection Observer for fade-in animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);

    // Observe all sections for animation
    document.querySelectorAll('section').forEach(section => {
        section.classList.add('fade-in');
        observer.observe(section);
    });

    // Staggered animation for cards
    document.querySelectorAll('.subject-cards, .project-cards, .achievement-cards').forEach(container => {
        const cards = container.querySelectorAll('.subject-card, .project-card, .achievement-card');
        cards.forEach((card, index) => {
            card.style.animationDelay = `${index * 0.1}s`;
            card.classList.add('card-entrance');
        });
    });
}

function initializeInteractiveElements() {
    // Enhanced hover effects for buttons
    document.querySelectorAll('.btn').forEach(button => {
        button.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-3px) scale(1.02)';
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });

    // Progress bar animations
    animateProgressBars();

    // Data counter animations
    animateCounters();

    // Interactive status indicators
    document.querySelectorAll('.status-indicator').forEach(indicator => {
        indicator.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.1)';
            this.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        });
        
        indicator.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
            this.style.boxShadow = 'none';
        });
    });

    // Add ripple effect to cards
    document.querySelectorAll('.subject-card, .project-card, .achievement-card').forEach(card => {
        card.addEventListener('click', createRippleEffect);
    });
}

function animateProgressBars() {
    const progressBars = document.querySelectorAll('.progress-fill');
    
    const progressObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const progressBar = entry.target;
                const targetWidth = progressBar.style.width || '0%';
                progressBar.style.width = '0%';
                
                setTimeout(() => {
                    progressBar.style.transition = 'width 1.5s ease-out';
                    progressBar.style.width = targetWidth;
                }, 200);
                
                progressObserver.unobserve(progressBar);
            }
        });
    }, { threshold: 0.5 });

    progressBars.forEach(bar => {
        progressObserver.observe(bar);
    });
}

function animateCounters() {
    function animateCounter(element, target, duration = 2000) {
        const start = 0;
        const increment = target / (duration / 16);
        let current = start;
        
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            element.textContent = Math.floor(current);
        }, 16);
    }

    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const element = entry.target;
                const text = element.textContent.trim();
                const number = parseInt(text.replace(/[^\d]/g, ''));
                
                if (!isNaN(number) && number > 0) {
                    animateCounter(element, number);
                    counterObserver.unobserve(element);
                }
            }
        });
    }, { threshold: 0.5 });

    document.querySelectorAll('.metric-value').forEach(metric => {
        counterObserver.observe(metric);
    });
}

function createRippleEffect(e) {
    const card = e.currentTarget;
    const ripple = document.createElement('div');
    const rect = card.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.classList.add('ripple-effect');

    card.style.position = 'relative';
    card.style.overflow = 'hidden';
    card.appendChild(ripple);

    setTimeout(() => {
        ripple.remove();
    }, 600);
}

function initializeDataVisualization() {
    // Real-time clock for ThingSpeak data
    updateDataTimestamps();
    setInterval(updateDataTimestamps, 1000);

    // Dynamic data status indicators
    updateSystemStatus();
    setInterval(updateSystemStatus, 5000);

    // Add floating animation to headings (without emojis)
    document.querySelectorAll('h2, h3').forEach(heading => {
        heading.classList.add('floating-heading');
    });
}

function updateDataTimestamps() {
    document.querySelectorAll('[id$="Time"]').forEach(timeElement => {
        if (!timeElement.textContent || timeElement.textContent === '--') {
            timeElement.textContent = 'Connecting...';
            timeElement.style.color = 'var(--accent)';
        }
    });
}

function updateSystemStatus() {
    // Simulate system status updates
    const statusElements = document.querySelectorAll('.status-ready');
    statusElements.forEach(element => {
        if (element.textContent.includes('Ready')) {
            element.style.animation = 'pulse 2s ease-in-out infinite';
        }
    });
}

// CSS animations added dynamically
const style = document.createElement('style');
style.textContent = `
    .fade-in {
        opacity: 0;
        transform: translateY(30px);
        transition: all 0.6s ease-out;
    }

    .fade-in.animate-in {
        opacity: 1;
        transform: translateY(0);
    }

    .card-entrance {
        opacity: 0;
        transform: translateY(20px);
        animation: cardEntrance 0.6s ease-out forwards;
    }

    @keyframes cardEntrance {
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .ripple-effect {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.6);
        transform: scale(0);
        animation: ripple 0.6s linear;
        pointer-events: none;
    }

    @keyframes ripple {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }

    .floating-heading {
        display: inline-block;
        animation: subtleFloat 4s ease-in-out infinite;
    }

    @keyframes subtleFloat {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-2px); }
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
    }

    .btn {
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .section-hover:hover {
        background: linear-gradient(135deg, var(--neutral-50) 0%, white 100%);
    }

    /* Enhanced loading animations */
    .loading-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--primary);
        margin: 0 2px;
        animation: loadingDots 1.4s ease-in-out infinite both;
    }

    .loading-dot:nth-child(1) { animation-delay: -0.32s; }
    .loading-dot:nth-child(2) { animation-delay: -0.16s; }

    @keyframes loadingDots {
        0%, 80%, 100% {
            transform: scale(0);
            opacity: 0.5;
        }
        40% {
            transform: scale(1);
            opacity: 1;
        }
    }

    /* Enhance data visualization */
    .data-item {
        transition: all 0.3s ease;
    }

    .data-item:hover {
        transform: translateY(-2px) scale(1.02);
        box-shadow: var(--shadow-lg);
    }

    .metric-value {
        transition: all 0.3s ease;
    }

    .metric-value:hover {
        transform: scale(1.1);
        color: var(--primary-light);
    }
`;

document.head.appendChild(style);

// Keyboard navigation enhancement
document.addEventListener('keydown', function(e) {
    if (e.key === 'Tab') {
        document.body.classList.add('keyboard-navigation');
    }
});

document.addEventListener('mousedown', function() {
    document.body.classList.remove('keyboard-navigation');
});

// Performance monitoring
if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
            if (entry.entryType === 'navigation') {
                console.log(`Page load time: ${entry.loadEventEnd - entry.loadEventStart}ms`);
            }
        }
    });
    observer.observe({entryTypes: ['navigation']});
}