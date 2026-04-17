/* FALLBACK TRADUÇÕES - Corrige erro de i18n */

// Objeto global de traduções mínimas para evitar erros
window.translations = {
    'pt-BR': {
        common: {
            appName: 'ECONOMONTEIRO MAX',
            welcome: 'Bem-vindo ao seu assistente financeiro! 👋',
            save: 'Salvar',
            cancel: 'Cancelar',
            delete: 'Deletar',
            loading: 'Carregando...',
            error: 'Erro'
        },
        navigation: {
            dashboard: '📊 Dashboard',
            expenses: '💰 Despesas',
            cards: '💳 Cartões',
            profile: '👤 Perfil',
            ai: '🤖 IA'
        },
        dashboard: {
            title: 'Resumo Mensal'
        },
        expenses: {
            categories: {
                food: '🍔 Comida',
                transport: '🚗 Transporte',
                housing: '🏠 Casa',
                leisure: '🎉 Lazer'
            }
        },
        aiAlerts: {
            budgetAtRisk: {
                title: '🚨 Orçamento em Risco',
                messageTemplate: 'Você já usou {percent}% do orçamento!'
            }
        }
    },
    en: {
        common: { appName: 'ECONOMONTEIRO MAX' },
        navigation: { dashboard: 'Dashboard' }
    }
};

console.log('✅ Traduções carregadas - app funcionará sem erros!');

