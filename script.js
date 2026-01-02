// Smooth Scroll for Navigation Links
const navLinks = document.querySelectorAll('.nav-link');

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href');
        const targetSection = document.querySelector(targetId);
        
        if (targetSection) {
            const header = document.querySelector('.header');
            const headerHeight = header ? header.offsetHeight : 80;
            const targetPosition = targetSection.offsetTop - headerHeight - 20;
            
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        }
    });
});

// Active Navigation Link on Scroll
const sections = document.querySelectorAll('section[id]');

window.addEventListener('scroll', () => {
    const scrollPosition = window.pageYOffset + 150;
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.offsetHeight;
        const sectionId = section.getAttribute('id');
        const correspondingLink = document.querySelector(`.nav-link[href="#${sectionId}"]`);
        
        if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
            navLinks.forEach(link => link.classList.remove('active'));
            if (correspondingLink) {
                correspondingLink.classList.add('active');
            }
        }
    });
});

// Animate Elements on Scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe all project cards
document.addEventListener('DOMContentLoaded', () => {
    const animatedElements = document.querySelectorAll('.project-card, .skill-category');
    
    animatedElements.forEach(element => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(30px)';
        element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(element);
    });
});

// Prevent default action for placeholder links
document.addEventListener('DOMContentLoaded', () => {
    const placeholderLinks = document.querySelectorAll('a[href="#"]');
    placeholderLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            if (link.getAttribute('href') === '#') {
                e.preventDefault();
            }
        });
    });
});

// Console message for developers
console.log('%c👋 Merhaba!', 'font-size: 20px; font-weight: bold; color: #C778DD;');
console.log('%cBu siteyi incelediğiniz için teşekkürler!', 'font-size: 14px; color: #ABB2BF;');
console.log('%cGitHub: https://github.com/melihkaratay', 'font-size: 12px; color: #C778DD;');

// ===== Visitor Information Tracking =====
(function() {
    // Get browser information
    function getBrowserInfo() {
        const ua = navigator.userAgent;
        let browserName = 'Unknown';
        
        if (ua.indexOf('Firefox') > -1) {
            browserName = 'Firefox';
        } else if (ua.indexOf('Opera') > -1 || ua.indexOf('OPR') > -1) {
            browserName = 'Opera';
        } else if (ua.indexOf('Trident') > -1) {
            browserName = 'Internet Explorer';
        } else if (ua.indexOf('Edge') > -1 || ua.indexOf('Edg') > -1) {
            browserName = 'Edge';
        } else if (ua.indexOf('Chrome') > -1) {
            browserName = 'Chrome';
        } else if (ua.indexOf('Safari') > -1) {
            browserName = 'Safari';
        }
        
        return browserName;
    }
    
    // Get device type
    function getDeviceType() {
        const ua = navigator.userAgent;
        if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
            return 'Tablet';
        }
        if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
            return 'Mobile';
        }
        return 'Desktop';
    }
    
    // Get operating system
    function getOS() {
        const ua = navigator.userAgent;
        let os = 'Unknown';
        
        if (ua.indexOf('Win') > -1) os = 'Windows';
        else if (ua.indexOf('Mac') > -1) os = 'MacOS';
        else if (ua.indexOf('X11') > -1) os = 'UNIX';
        else if (ua.indexOf('Linux') > -1) os = 'Linux';
        else if (/Android/.test(ua)) os = 'Android';
        else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
        
        return os;
    }
    
    // Get screen resolution
    function getScreenResolution() {
        return `${window.screen.width} × ${window.screen.height}`;
    }
    
    // Visit tracking with localStorage
    function trackVisit() {
        const visitKey = 'visitor_data';
        let visitData = localStorage.getItem(visitKey);
        
        if (!visitData) {
            // First visit
            visitData = {
                count: 1,
                firstVisit: new Date().toLocaleDateString('tr-TR')
            };
        } else {
            // Returning visitor
            visitData = JSON.parse(visitData);
            visitData.count += 1;
        }
        
        localStorage.setItem(visitKey, JSON.stringify(visitData));
        return visitData;
    }
    
    // Get IP and location information
    async function getIPInfo() {
        try {
            const response = await fetch('https://ipapi.co/json/');
            const data = await response.json();
            return {
                ip: data.ip || 'Bilinmiyor',
                city: data.city || '',
                region: data.region || '',
                country: data.country_name || 'Bilinmiyor'
            };
        } catch (error) {
            console.error('IP bilgisi alınamadı:', error);
            return {
                ip: 'Alınamadı',
                city: '',
                region: '',
                country: 'Alınamadı'
            };
        }
    }
    
    // Update visitor information on page
    async function updateVisitorInfo() {
        // Get local information immediately
        const browser = getBrowserInfo();
        const device = getDeviceType();
        const os = getOS();
        const screen = getScreenResolution();
        const visitData = trackVisit();
        
        // Update elements that don't require API
        document.getElementById('visitor-browser').textContent = browser;
        document.getElementById('visitor-device').textContent = device;
        document.getElementById('visitor-os').textContent = os;
        document.getElementById('visitor-screen').textContent = screen;
        document.getElementById('visitor-count').textContent = visitData.count;
        document.getElementById('visitor-first').textContent = visitData.firstVisit;
        
        // Get IP and location info from API
        const ipInfo = await getIPInfo();
        
        // Update IP
        document.getElementById('visitor-ip').textContent = ipInfo.ip;
        
        // Update location
        let locationText = '';
        if (ipInfo.city && ipInfo.region) {
            locationText = `${ipInfo.city}, ${ipInfo.region}, ${ipInfo.country}`;
        } else if (ipInfo.city) {
            locationText = `${ipInfo.city}, ${ipInfo.country}`;
        } else {
            locationText = ipInfo.country;
        }
        document.getElementById('visitor-location').textContent = locationText;
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateVisitorInfo);
    } else {
        updateVisitorInfo();
    }
})();
