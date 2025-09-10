// Newsletter Scraper Platform - Frontend JavaScript
// Separated from HTML to work with CSP policies

// Load system health on page load
document.addEventListener('DOMContentLoaded', async function() {
    await loadSystemHealth();
    setupEventListeners();
});

function setupEventListeners() {
    // Add event listeners to all test buttons
    const testButtons = document.querySelectorAll('.test-button');
    testButtons.forEach(button => {
        const endpoint = button.getAttribute('data-endpoint');
        const method = button.getAttribute('data-method') || 'GET';
        const action = button.getAttribute('data-action');
        
        button.addEventListener('click', function() {
            if (action === 'webhook') {
                testWebhook();
            } else if (action === 'export') {
                const format = button.getAttribute('data-format');
                testExport(format);
            } else if (action === 'oauth') {
                window.open(endpoint, '_blank');
            } else {
                testEndpoint(endpoint, method);
            }
        });
    });
}

async function loadSystemHealth() {
    try {
        const response = await fetch('/health');
        const health = await response.json();
        const statusElement = document.getElementById('health-status');
        if (statusElement) {
            statusElement.innerHTML = `
                <strong>✅ System Health:</strong> ${health.status}<br>
                <strong>🕒 Timestamp:</strong> ${new Date(health.timestamp).toLocaleString()}<br>
                <strong>📋 Version:</strong> ${health.version}
            `;
        }
    } catch (error) {
        const statusElement = document.getElementById('health-status');
        if (statusElement) {
            statusElement.innerHTML = `
                <strong>❌ Health Check Failed:</strong> ${error.message}
            `;
        }
    }
}

async function testEndpoint(endpoint, method = 'GET') {
    try {
        const response = await fetch(endpoint, { method });
        const data = await response.json();
        alert(`${method} ${endpoint}\n\nResponse (${response.status}):\n${JSON.stringify(data, null, 2)}`);
    } catch (error) {
        alert(`Error testing ${endpoint}:\n${error.message}`);
    }
}

async function testWebhook() {
    try {
        const response = await fetch('/api/webhooks/email/sendgrid', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Signature': 'test-signature',
                'X-Timestamp': Date.now().toString()
            },
            body: JSON.stringify({
                envelope: { to: ['test@newsletters.app'] },
                email: 'Test email content for demo'
            })
        });
        const data = await response.json();
        alert(`Webhook Test Response (${response.status}):\n${JSON.stringify(data, null, 2)}`);
    } catch (error) {
        alert(`Webhook test error:\n${error.message}`);
    }
}

async function testExport(format) {
    try {
        const response = await fetch(`/api/exports/${format}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                filters: {}, 
                options: { include_content: true } 
            })
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `newsletter-export.${format}`;
            a.click();
            window.URL.revokeObjectURL(url);
            alert(`${format.toUpperCase()} export started! Check your downloads.`);
        } else {
            const error = await response.json();
            alert(`Export failed: ${error.message}`);
        }
    } catch (error) {
        alert(`Export error: ${error.message}`);
    }
}

// Make functions available globally
window.testEndpoint = testEndpoint;
window.testWebhook = testWebhook;
window.testExport = testExport;