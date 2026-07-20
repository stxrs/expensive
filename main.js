document.addEventListener('DOMContentLoaded', () => {
    // Modal Management
    const modal = document.getElementById('transactionModal');
    const openBtn = document.getElementById('openTransactionModal');
    const closeBtn = document.getElementById('closeTransactionModal');

    openBtn.addEventListener('click', () => modal.showModal());
    closeBtn.addEventListener('click', () => modal.close());

    // Close modal when clicking outside the glass panel
    modal.addEventListener('click', (e) => {
        const dialogDimensions = modal.getBoundingClientRect()
        if (
            e.clientX < dialogDimensions.left ||
            e.clientX > dialogDimensions.right ||
            e.clientY < dialogDimensions.top ||
            e.clientY > dialogDimensions.bottom
        ) {
            modal.close();
        }
    });

    // Form Submission Logging
    const form = document.getElementById('transactionForm');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const formData = {
            type: document.querySelector('input[name="txType"]:checked').value,
            amount: parseFloat(document.getElementById('txAmount').value),
            category: document.getElementById('txCategory').value,
            date: document.getElementById('txDate').value,
            description: document.getElementById('txDescription').value,
            tags: document.getElementById('txTags').value.split(',').map(t => t.trim()).filter(t => t)
        };

        console.log('Transaction ready for PocketBase upload:', formData);
        
        // Reset and close
        form.reset();
        modal.close();
    });

    // Premium Chart.js Configuration
    const ctx = document.getElementById('spendingChart').getContext('2d');
    
    // Create a subtle gradient for the line fill
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(212, 163, 115, 0.3)'); // Bronze fade top
    gradient.addColorStop(1, 'rgba(212, 163, 115, 0.0)'); // Transparent bottom

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Spending',
                data: [120, 190, 140, 280, 220, 310, 250],
                borderColor: '#d4a373', // Bronze line
                backgroundColor: gradient,
                borderWidth: 2,
                pointBackgroundColor: '#09090b',
                pointBorderColor: '#d4a373',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                tension: 0.4, // Smooth elegant curves
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(24, 24, 27, 0.9)',
                    titleColor: '#a1a1aa',
                    bodyColor: '#f4f4f5',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return '$' + context.parsed.y;
                        }
                    }
                }
            },
            scales: {
                y: { 
                    beginAtZero: true, 
                    grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
                    ticks: { color: '#a1a1aa', font: { family: 'Inter' } }
                },
                x: { 
                    grid: { display: false, drawBorder: false },
                    ticks: { color: '#a1a1aa', font: { family: 'Inter' } }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index',
            },
        }
    });
});