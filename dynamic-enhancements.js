// Dynamic Enhancements for Sleep Quality Dashboard
// Adds smooth interactions, animations, and modern UI effects

document.addEventListener('DOMContentLoaded', function() {
    console.log('🎨 Initializing dynamic enhancements...');
    
    // Initialize all enhancements
    initScrollAnimations();
    initParallaxEffect();
    initCounterAnimations();
    initCardInteractions();
    initSmoothTransitions();
    initLoadingProgress();
    addGradientText();
    initTooltips();
    
    console.log('✨ Dynamic enhancements loaded!');
});

// ============================================
// SCROLL ANIMATIONS
// ============================================
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }, index * 100);
            }
        });
    }, observerOptions);
    
    // Observe all sections
    document.querySelectorAll('section').forEach(section => {
        section.style.opacity = '0';
        section.style.transform = 'translateY(30px)';
        section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(section);
    });
    
    console.log('✅ Scroll animations initialized');
}

// ============================================
// PARALLAX EFFECT
// ============================================
function initParallaxEffect() {
    const header = document.querySelector('header');
    if (!header) return;
    
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        if (header) {
            header.style.transform = `translateY(${scrolled * 0.5}px)`;
        }
    });
    
    console.log('✅ Parallax effect initialized');
}

// ============================================
// COUNTER ANIMATIONS
// ============================================
function initCounterAnimations() {
    const counters = document.querySelectorAll('.stat-value, .data-value');
    
    const animateCounter = (element) => {
        const text = element.textContent;
        const number = parseFloat(text.replace(/[^0-9.]/g, ''));
        
        if (isNaN(number)) return;
        
        const suffix = text.replace(/[0-9.]/g, '');
        const duration = 1000;
        const steps = 60;
        const increment = number / steps;
        let current = 0;
        
        const timer = setInterval(() => {
            current += increment;
            if (current >= number) {
                current = number;
                clearInterval(timer);
            }
            element.textContent = current.toFixed(number % 1 === 0 ? 0 : 1) + suffix;
        }, duration / steps);
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.dataset.animated) {
                animateCounter(entry.target);
                entry.target.dataset.animated = 'true';
            }
        });
    });
    
    counters.forEach(counter => observer.observe(counter));
    
    console.log(`✅ Counter animations initialized (${counters.length} counters)`);
}

// ============================================
// CARD INTERACTIONS
// ============================================
function initCardInteractions() {
    const cards = document.querySelectorAll('.subject-card, .project-card, .stat-card');
    
    cards.forEach(card => {
        // Add 3D tilt effect on mouse move
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const rotateX = (y - centerY) / 10;
            const rotateY = (centerX - x) / 10;
            
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-10px) scale(1.03)`;
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0) scale(1)';
        });
        
        // Add ripple effect on click
        card.addEventListener('click', function(e) {
            const ripple = document.createElement('div');
            ripple.className = 'ripple-effect';
            
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            ripple.style.cssText = `
                position: absolute;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.5);
                width: 10px;
                height: 10px;
                left: ${x}px;
                top: ${y}px;
                transform: translate(-50%, -50%) scale(0);
                animation: ripple 0.6s ease-out;
                pointer-events: none;
            `;
            
            this.style.position = 'relative';
            this.style.overflow = 'hidden';
            this.appendChild(ripple);
            
            setTimeout(() => ripple.remove(), 600);
        });
    });
    
    console.log(`✅ Card interactions initialized (${cards.length} cards)`);
}

// ============================================
// SMOOTH TRANSITIONS
// ============================================
function initSmoothTransitions() {
    // Smooth navigation scrolling
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
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
    
    console.log('✅ Smooth transitions initialized');
}

// ============================================
// LOADING PROGRESS BAR
// ============================================
function initLoadingProgress() {
    // Create progress bar
    const progressBar = document.createElement('div');
    progressBar.className = 'loading-progress-bar';
    progressBar.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 0%;
        height: 3px;
        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
        z-index: 9999;
        transition: width 0.3s ease;
    `;
    document.body.appendChild(progressBar);
    
    // Simulate loading
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 10;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            setTimeout(() => {
                progressBar.style.opacity = '0';
                setTimeout(() => progressBar.remove(), 300);
            }, 500);
        }
        progressBar.style.width = `${progress}%`;
    }, 100);
    
    console.log('✅ Loading progress initialized');
}

// ============================================
// GRADIENT TEXT
// ============================================
function addGradientText() {
    // Add gradient to specific headings
    document.querySelectorAll('h1, h2').forEach(heading => {
        heading.classList.add('gradient-text');
    });
    
    console.log('✅ Gradient text applied');
}

// ============================================
// TOOLTIPS
// ============================================
function initTooltips() {
    // Add tooltips to metric items
    document.querySelectorAll('.metric-item').forEach(item => {
        const label = item.querySelector('strong');
        if (label) {
            item.setAttribute('data-tooltip', `Click for details`);
            item.classList.add('tooltip');
        }
    });
    
    console.log('✅ Tooltips initialized');
}

// ============================================
// RIPPLE ANIMATION CSS
// ============================================
const style = document.createElement('style');
style.textContent = `
    @keyframes ripple {
        to {
            transform: translate(-50%, -50%) scale(40);
            opacity: 0;
        }
    }
    
    .loading-progress-bar {
        box-shadow: 0 0 10px rgba(102, 126, 234, 0.5);
    }
    
    .gradient-text {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        display: inline-block;
    }
`;
document.head.appendChild(style);

// ============================================
// PAGE VISIBILITY CHANGE
// ============================================
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        console.log('👋 User left the page');
    } else {
        console.log('👀 User returned to the page');
        // Refresh animations
        document.querySelectorAll('.stat-value, .data-value').forEach(el => {
            el.dataset.animated = '';
        });
        initCounterAnimations();
    }
});

console.log('🎨 Dynamic enhancements module loaded successfully!');
