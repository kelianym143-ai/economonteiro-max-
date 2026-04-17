// ==================== CHARTS MODULE ====================
// Gerencia todos os gráficos do app usando Chart.js - Production Ready

const chartsModule = {
    charts: {},

    getScreenSize() {
        const width = window.innerWidth;
        if (width < 640) return 'mobile';
        if (width < 1024) return 'tablet';
        return 'desktop';
    },

    getResponsiveConfig() {
        const screenSize = this.getScreenSize();
        return {
            mobile: {
                legendPosition: 'bottom',
                legendFontSize: 10,
                pointRadius: 3,
                pointHoverRadius: 5,
                borderWidth: 2,
                padding: 10
            },
            tablet: {
                legendPosition: 'bottom',
                legendFontSize: 11,
                pointRadius: 4,
                pointHoverRadius: 6,
                borderWidth: 2.5,
                padding: 12
            },
            desktop: {
                legendPosition: 'bottom',
                legendFontSize: 12,
                pointRadius: 5,
                pointHoverRadius: 7,
                borderWidth: 3,
                padding: 15
            }
        }[screenSize];
    },

    autoInitCharts() {
        const canvases = {
            pie: document.getElementById('categoryPieChart'),
            line: document.getElementById('trendsLineChart'),
            comparison: document.getElementById('comparisonChart')
        };
        
        Object.entries(canvases).forEach(([type, canvas]) => {
            if (canvas) {
                this[`init${type.charAt(0).toUpperCase() + type.slice(1)}Chart`]();
            }
        });
    },

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.autoInitCharts();
                this.setupResizeListener();
            });
        } else {
            this.autoInitCharts();
            this.setupResizeListener();
        }
    },

    initPieChart() {
        setTimeout(() => {
            const canvas = document.getElementById('categoryPieChart');
            if (!canvas) return;
            
            const summary = app.getExpenseSummary(
                new Date().getMonth() + 1,
                new Date().getFullYear()
            );
            
            const labels = Object.keys(summary.byCategory).map(cat => 
                app.t(`expenses.categories.${cat}`)
            );
            const data = Object.values(summary.byCategory).map(cat => cat.total);
            
            const colors = [
                '#EF4444', '#22C55E', '#2563EB', '#F59E0B', '#0EA5E9',
                '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#06B6D4'
            ];
            
            const responsiveConfig = this.getResponsiveConfig();
            
            if (this.charts.pie) {
                this.charts.pie.destroy();
            }
            
            this.charts.pie = new Chart(canvas, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: colors.slice(0, labels.length),
                        borderColor: '#fff',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    animation: { duration: 500 },
                    plugins: {
                        legend: {
                            position: responsiveConfig.legendPosition,
                            labels: {
                                padding: responsiveConfig.padding,
                                font: {
                                    size: responsiveConfig.legendFontSize,
                                    weight: 500
                                },
                                usePointStyle: true,
                                pointStyle: 'circle'
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            padding: 12,
                            titleFont: { size: 14, weight: 'bold' },
                            bodyFont: { size: 13 },
                            borderColor: '#2563EB',
                            borderWidth: 1
                        }
                    }
                }
            });
        }, 100);
    },

    initLineChart() {
        setTimeout(() => {
            const canvas = document.getElementById('trendsLineChart');
            if (!canvas) return;
            
            const months = this.getLast6Months();
            const monthlyData = [];
            
            months.forEach(({ month, year }) => {
                const summary = app.getExpenseSummary(month, year);
                monthlyData.push(summary.totalAmount);
            });
            
            const responsiveConfig = this.getResponsiveConfig();
            
            if (this.charts.line) {
                this.charts.line.destroy();
            }
            
            this.charts.line = new Chart(canvas, {
                type: 'line',
                data: {
                    labels: months.map(m => this.formatMonthLabel(m.month, m.year)),
                    datasets: [{
                        label: app.t('dashboard.totalSpent'),
                        data: monthlyData,
                        borderColor: '#2563EB',
                        backgroundColor: 'rgba(37, 99, 235, 0.1)',
                        borderWidth: responsiveConfig.borderWidth,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#2563EB',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: responsiveConfig.pointRadius,
                        pointHoverRadius: responsiveConfig.pointHoverRadius
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    animation: { duration: 500 },
                    plugins: {
                        legend: {
                            display: true,
                            labels: {
                                padding: responsiveConfig.padding,
                                font: {
                                    size: responsiveConfig.legendFontSize,
                                    weight: 500
                                }
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            padding: 12,
                            titleFont: { size: 14, weight: 'bold' },
                            bodyFont: { size: 13 },
                            borderColor: '#2563EB',
                            borderWidth: 1,
                            callbacks: {
                                label: function(context) {
                                    return app.formatCurrency(context.parsed.y);
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return app.formatCurrency(value);
                                }
                            },
                            grid: { color: 'rgba(0, 0, 0, 0.05)' }
                        },
                        x: { grid: { display: false } }
                    }
                }
            });
        }, 100);
    },

    initComparisonChart() {
        setTimeout(() => {
            const canvas = document.getElementById('comparisonChart');
            if (!canvas) return;
            
            const thisWeek = this.getWeekExpenses(0);
            const lastWeek = this.getWeekExpenses(1);
            
            const responsiveConfig = this.getResponsiveConfig();
            
            if (this.charts.comparison) {
                this.charts.comparison.destroy();
            }
            
            this.charts.comparison = new Chart(canvas, {
                type: 'bar',
                data: {
                    labels: this.getScreenSize() === 'mobile' 
                        ? ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom']
                        : ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'],
                    datasets: [
                        {
                            label: app.t('dashboard.thisWeek') || 'Esta Semana',
                            data: thisWeek,
                            backgroundColor: '#22C55E',
                            borderRadius: 4,
                            borderSkipped: false
                        },
                        {
                            label: app.t('dashboard.lastWeek') || 'Semana Passada',
                            data: lastWeek,
                            backgroundColor: '#EF4444',
                            borderRadius: 4,
                            borderSkipped: false
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    animation: { duration: 500 },
                    plugins: {
                        legend: {
                            labels: {
                                padding: responsiveConfig.padding,
                                font: { size: responsiveConfig.legendFontSize }
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            padding: 12,
                            titleFont: { size: 14, weight: 'bold' },
                            bodyFont: { size: 13 },
                            borderColor: '#2563EB',
                            borderWidth: 1,
                            callbacks: {
                                label: function(context) {
                                    return context.dataset.label + ': ' + app.formatCurrency(context.parsed.y);
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return app.formatCurrency(value);
                                }
                            },
                            grid: { color: 'rgba(0, 0, 0, 0.05)' }
                        },
                        x: { grid: { display: false } }
                    }
                }
            });
        }, 100);
    },

    getLast6Months() {
        const months = [];
        const now = new Date();
        
        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push({
                month: date.getMonth() + 1,
                year: date.getFullYear()
            });
        }
        
        return months;
    },

    formatMonthLabel(month, year) {
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 
                       'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return `${months[month - 1]} ${year}`;
    },

    getWeekExpenses(weekOffset) {
        const expenses = app.getUserExpenses();
        const dayData = [0, 0, 0, 0, 0, 0, 0];
        const today = new Date();
        const startOfThisWeek = new Date(today.setDate(today.getDate() - today.getDay() + (7 * weekOffset)));
        
        expenses.forEach(exp => {
            const expDate = new Date(exp.createdAt);
            if (expDate >= startOfThisWeek && expDate <= new Date(startOfThisWeek.getTime() + 7 * 24 * 60 * 60 * 1000)) {
                const dayOfWeek = expDate.getDay();
                dayData[dayOfWeek === 0 ? 6 : dayOfWeek - 1] += parseFloat(exp.amount);
            }
        });
        
        return dayData;
    },

    refreshAllCharts() {
        this.initPieChart();
        this.initLineChart();
        this.initComparisonChart();
    },

    setupResizeListener() {
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                this.refreshAllCharts();
            }, 250);
        });
    }
};

window.chartsModule = chartsModule;
chartsModule.init();
