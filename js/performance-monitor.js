// Performance Monitor - Tracks memory usage and performance metrics
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            memoryUsage: [],
            renderTimes: [],
            queryTimes: []
        };
        this.isMonitoring = false;
        this.monitoringInterval = null;
    }

    startMonitoring() {
        if (this.isMonitoring) return;
        this.isMonitoring = true;
        
        // Monitor memory every 5 seconds
        this.monitoringInterval = setInterval(() => {
            this.collectMetrics();
        }, 5000);
        
        console.log('Performance monitoring started');
    }

    stopMonitoring() {
        this.isMonitoring = false;
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
    }

    collectMetrics() {
        // Collect memory usage
        if (performance.memory) {
            const memory = performance.memory;
            this.metrics.memoryUsage.push({
                timestamp: Date.now(),
                used: memory.usedJSHeapSize / 1048576, // MB
                total: memory.totalJSHeapSize / 1048576,
                limit: memory.jsHeapSizeLimit / 1048576
            });
            
            // Keep only last 20 measurements
            if (this.metrics.memoryUsage.length > 20) {
                this.metrics.memoryUsage.shift();
            }
        }

        // Log if memory is getting high
        if (this.metrics.memoryUsage.length > 0) {
            const latest = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];
            if (latest.used > 200) { // Warning if > 200MB
                console.warn(`High memory usage: ${latest.used.toFixed(2)} MB`);
            }
        }
    }

    measureRenderTime(name, fn) {
        const start = performance.now();
        const result = fn();
        const end = performance.now();
        const duration = end - start;
        
        this.metrics.renderTimes.push({
            name,
            duration,
            timestamp: Date.now()
        });
        
        // Keep only last 50 measurements
        if (this.metrics.renderTimes.length > 50) {
            this.metrics.renderTimes.shift();
        }
        
        if (duration > 100) { // Log slow renders
            console.warn(`Slow render detected: ${name} took ${duration.toFixed(2)}ms`);
        }
        
        return result;
    }

    measureQueryTime(name, fn) {
        const start = performance.now();
        const result = fn();
        const end = performance.now();
        const duration = end - start;
        
        this.metrics.queryTimes.push({
            name,
            duration,
            timestamp: Date.now()
        });
        
        // Keep only last 50 measurements
        if (this.metrics.queryTimes.length > 50) {
            this.metrics.queryTimes.shift();
        }
        
        return result;
    }

    getReport() {
        const avgMemory = this.metrics.memoryUsage.length > 0
            ? this.metrics.memoryUsage.reduce((a, b) => a + b.used, 0) / this.metrics.memoryUsage.length
            : 0;
            
        const avgRenderTime = this.metrics.renderTimes.length > 0
            ? this.metrics.renderTimes.reduce((a, b) => a + b.duration, 0) / this.metrics.renderTimes.length
            : 0;
            
        const avgQueryTime = this.metrics.queryTimes.length > 0
            ? this.metrics.queryTimes.reduce((a, b) => a + b.duration, 0) / this.metrics.queryTimes.length
            : 0;

        return {
            avgMemory: avgMemory.toFixed(2) + ' MB',
            avgRenderTime: avgRenderTime.toFixed(2) + ' ms',
            avgQueryTime: avgQueryTime.toFixed(2) + ' ms',
            totalRenders: this.metrics.renderTimes.length,
            totalQueries: this.metrics.queryTimes.length,
            recentMemory: this.metrics.memoryUsage.slice(-5),
            slowRenders: this.metrics.renderTimes.filter(r => r.duration > 100)
        };
    }

    // Force garbage collection hint (not guaranteed in all browsers)
    suggestGC() {
        if (window.gc) {
            window.gc();
            console.log('Garbage collection requested');
        } else {
            // Alternative: clear caches and free references
            console.log('Clearing caches to free memory...');
            if (window.dbManager && window.dbManager.cache) {
                window.dbManager.cache.clear();
            }
        }
    }
}

// Create global instance
window.perfMonitor = new PerformanceMonitor();

// Start monitoring after page load
window.addEventListener('load', () => {
    // Delay start to allow initial load to complete
    setTimeout(() => {
        window.perfMonitor.startMonitoring();
    }, 2000);
});

// Keyboard shortcut to view performance report (Ctrl+Shift+P)
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        console.table(window.perfMonitor.getReport());
        alert('Performance report logged to console');
    }
});
