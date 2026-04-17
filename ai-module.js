// ==================== AI MODULE ====================
// Assistente Universal de IA - Responde qualquer pergunta

const aiModule = {

    chatHistory: [],
    maxHistoryMessages: 12,

    getCurrentLanguage() {
        return app.currentLanguage || 'pt-BR';
    },

    translateByLanguage(map) {
        const lang = this.getCurrentLanguage();
        return map[lang] || map['pt-BR'];
    },

    // ==================== ALERTAS FINANCEIROS ====================
    generateAlerts() {
        const alerts = [];
        const summary = app.getExpenseSummary(
            new Date().getMonth() + 1,
            new Date().getFullYear()
        );

        if (app.currentUser.monthlyBudget > 0) {
            const percentUsed = (summary.totalAmount / app.currentUser.monthlyBudget) * 100;
            if (percentUsed >= 80) {
                alerts.push({
                    type: 'danger',
                    title: app.t('aiAlerts.budgetAtRisk.title'),
                    message: this.interpolateTemplate(app.t('aiAlerts.budgetAtRisk.messageTemplate'), { percent: Math.round(percentUsed) }),
                    color: 'red'
                });
            } else if (percentUsed >= 60) {
                alerts.push({
                    type: 'warning',
                    title: app.t('aiAlerts.budgetWarning.title'),
                    message: this.interpolateTemplate(app.t('aiAlerts.budgetWarning.messageTemplate'), { percent: Math.round(percentUsed) }),
                    color: 'yellow'
                });
            }
        }

        const dominantCategory = this.getDominantCategory(summary.byCategory);
        if (dominantCategory && summary.totalAmount > 0) {
            const percentage = (dominantCategory.total / summary.totalAmount) * 100;
            if (percentage > 40) {
                const categoryName = app.t(`expenses.categories.${dominantCategory.category}`);
                alerts.push({
                    type: 'info',
                    title: app.t('aiAlerts.dominantCategory.title'),
                    message: this.interpolateTemplate(app.t('aiAlerts.dominantCategory.messageTemplate'), { category: categoryName, percent: percentage.toFixed(1) }),
                    color: 'blue'
                });
            }
        }

        const userExpenses = app.getUserExpenses();
        const todayExpenses = userExpenses.filter(e => {
            const d = new Date(e.createdAt);
            return d.toDateString() === new Date().toDateString();
        });
        const todayTotal = todayExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
        const dailyAverage = summary.totalAmount / Math.max(new Date().getDate(), 1);
        if (todayTotal > dailyAverage * 1.5 && dailyAverage > 0) {
            alerts.push({
                type: 'warning',
                title: app.t('aiAlerts.highDailySpent.title'),
                message: this.interpolateTemplate(app.t('aiAlerts.highDailySpent.messageTemplate'), {
                    amount: app.formatCurrency(todayTotal),
                    multiple: (todayTotal / dailyAverage).toFixed(1)
                }),
                color: 'orange'
            });
        }

        if (userExpenses.length === 0) {
            alerts.push({ type: 'success', title: app.t('aiAlerts.startRecording.title'), message: app.t('aiAlerts.startRecording.message'), color: 'green' });
        }

        return alerts;
    },

    getDominantCategory(byCategory) {
        let dominant = null;
        let maxTotal = 0;
        for (const [category, data] of Object.entries(byCategory)) {
            if (data.total > maxTotal) {
                maxTotal = data.total;
                dominant = { category, total: data.total };
            }
        }
        return dominant;
    },

    generateRecommendations() {
        const recommendations = [];
        const summary = app.getExpenseSummary(new Date().getMonth() + 1, new Date().getFullYear());
        if (app.currentUser.monthlyBudget > 0 && summary.totalAmount < app.currentUser.monthlyBudget * 0.5) {
            recommendations.push({ title: app.t('ai.excellentControl'), text: app.t('ai.excellentControlDesc'), emoji: '🎉' });
        }
        const avgExpense = summary.expenseCount > 0 ? summary.totalAmount / summary.expenseCount : 0;
        if (avgExpense < 50 && avgExpense > 0) {
            recommendations.push({ title: app.t('ai.healthyHabits'), text: app.t('ai.healthyHabitsDesc'), emoji: '🌟' });
        }
        recommendations.push({ title: app.t('ai.dailyTipTitle'), text: this.getDailyTip(), emoji: '📝' });
        return recommendations;
    },

    getDailyTip() {
        const tips = app.t('ai.dailyTips');
        return tips[Math.floor(Math.random() * tips.length)];
    },

    compareWithPreviousPeriod() {
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        let previousMonth = currentMonth - 1;
        let previousYear = currentYear;
        if (previousMonth === 0) { previousMonth = 12; previousYear--; }
        const currentSummary = app.getExpenseSummary(currentMonth, currentYear);
        const previousSummary = app.getExpenseSummary(previousMonth, previousYear);
        const difference = currentSummary.totalAmount - previousSummary.totalAmount;
        const percentChange = previousSummary.totalAmount > 0 ? (difference / previousSummary.totalAmount) * 100 : 0;
        return { currentMonth: currentSummary.totalAmount, previousMonth: previousSummary.totalAmount, difference, percentChange, trend: difference > 0 ? 'up' : difference < 0 ? 'down' : 'stable' };
    },

    translateOrFallback(key, fallback) {
        const translated = app.t(key);
        return (!translated || translated === key) ? fallback : translated;
    },

    interpolateTemplate(template, values) {
        let result = template;
        for (const [key, val] of Object.entries(values)) {
            result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
        }
        return result;
    },

    // ==================== MOTOR PRINCIPAL DO CHAT ====================
    async getChatResponse(userMessage) {
        const cleanedMessage = (userMessage || '').trim();
        if (!cleanedMessage) {
            return {
                type: 'error',
                response: this.translateByLanguage({
                    'pt-BR': 'Não recebi nenhuma mensagem. Pode tentar novamente?',
                    en: 'I did not receive any message. Can you try again?',
                    es: 'No recibí ningún mensaje. ¿Puedes intentarlo de nuevo?',
                    fr: 'Je n’ai reçu aucun message. Pouvez-vous réessayer ?'
                })
            };
        }

        this.pushToHistory('user', cleanedMessage);

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 20000);

            const response = await fetch('/.netlify/functions/chat-with-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: cleanedMessage,
                    language: this.getNormalizedLanguage(),
                    financialContext: this.buildFinancialContext(),
                    conversationHistory: this.getConversationForApi()
                }),
                signal: controller.signal
            });

            clearTimeout(timeout);

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.response) {
                    this.pushToHistory('assistant', data.response);
                    return { type: 'openai', response: data.response, model: data.model || '' };
                }
            }
        } catch (e) {
            if (e?.name === 'AbortError') {
                const fallback = {
                    type: 'warning',
                    response: this.translateByLanguage({
                        'pt-BR': 'A resposta da IA demorou muito e foi interrompida. Vou te ajudar no modo offline agora.',
                        en: 'The AI response took too long and was interrupted. I will help you in offline mode now.',
                        es: 'La respuesta de IA tardó demasiado y se interrumpió. Te ayudaré en modo sin conexión ahora.',
                        fr: 'La réponse de l’IA a pris trop de temps et a été interrompue. Je vais vous aider en mode hors ligne maintenant.'
                    })
                };
                this.pushToHistory('assistant', fallback.response);
                return fallback;
            }
        }

        const offline = this.analyzeUserQuery(cleanedMessage);
        this.pushToHistory('assistant', offline.response || 'Desculpe, não consegui responder agora.');
        return offline;
    },

    pushToHistory(role, content) {
        if (!content) return;
        this.chatHistory.push({ role, content: String(content).slice(0, 4000) });
        if (this.chatHistory.length > this.maxHistoryMessages) {
            this.chatHistory = this.chatHistory.slice(-this.maxHistoryMessages);
        }
    },

    getConversationForApi() {
        return this.chatHistory
            .filter(item => item && (item.role === 'user' || item.role === 'assistant') && item.content)
            .slice(-this.maxHistoryMessages);
    },

    clearHistory() {
        this.chatHistory = [];
    },

    getNormalizedLanguage() {
        const lang = app.currentLanguage || 'pt-BR';
        if (lang === 'pt' || lang === 'pt-BR') return 'pt-BR';
        if (lang === 'en') return 'en';
        if (lang === 'es') return 'es';
        if (lang === 'fr') return 'fr';
        return 'pt-BR';
    },

    buildFinancialContext() {
        try {
            const summary = app.getExpenseSummary(new Date().getMonth() + 1, new Date().getFullYear());
            const userName = app.currentUser?.name || app.st('userDefaultName');
            const budget = app.currentUser?.monthlyBudget || 0;
            const remaining = budget > 0 ? budget - summary.totalAmount : null;

            const topCategories = Object.entries(summary.byCategory || {})
                .sort((a, b) => (b[1]?.total || 0) - (a[1]?.total || 0))
                .slice(0, 3)
                .map(([category, data]) => `${app.t(`expenses.categories.${category}`)}: ${app.formatCurrency(data.total || 0)}`)
                .join(' | ');

            const recentExpenses = (app.getUserExpenses() || [])
                .slice()
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 5)
                .map(exp => `${exp.description}: ${app.formatCurrency(parseFloat(exp.amount || 0))} (${app.t(`expenses.categories.${exp.category}`)})`)
                .join(' | ');

            return [
                `${app.t('profile.name')}: ${userName}`,
                `${app.t('ai.totalSpent')}: ${app.formatCurrency(summary.totalAmount)}`,
                budget > 0
                    ? `${app.t('dashboard.monthlyBudget')}: ${app.formatCurrency(budget)} | ${app.t('dashboard.remaining')}: ${app.formatCurrency(remaining)}`
                    : this.translateByLanguage({
                        'pt-BR': 'Orçamento não definido',
                        en: 'Budget not defined',
                        es: 'Presupuesto no definido',
                        fr: 'Budget non défini'
                    }),
                `${app.t('ai.totalTransactions')}: ${summary.expenseCount}`,
                topCategories
                    ? this.translateByLanguage({ 'pt-BR': `Top categorias: ${topCategories}`, en: `Top categories: ${topCategories}`, es: `Categorías principales: ${topCategories}`, fr: `Catégories principales : ${topCategories}` })
                    : this.translateByLanguage({ 'pt-BR': 'Top categorias: sem dados', en: 'Top categories: no data', es: 'Categorías principales: sin datos', fr: 'Catégories principales : aucune donnée' }),
                recentExpenses
                    ? this.translateByLanguage({ 'pt-BR': `Últimas despesas: ${recentExpenses}`, en: `Recent expenses: ${recentExpenses}`, es: `Gastos recientes: ${recentExpenses}`, fr: `Dépenses récentes : ${recentExpenses}` })
                    : this.translateByLanguage({ 'pt-BR': 'Últimas despesas: sem dados', en: 'Recent expenses: no data', es: 'Gastos recientes: sin datos', fr: 'Dépenses récentes : aucune donnée' })
            ].join('. ');
        } catch (e) {
            return '';
        }
    },

    // ==================== MOTOR OFFLINE INTELIGENTE ====================
    analyzeUserQuery(message) {
        const msg = message.toLowerCase().trim();

        // ---- Dados financeiros do usuário ----
        const summary = app.getExpenseSummary(new Date().getMonth() + 1, new Date().getFullYear());
        const userName = app.currentUser?.name || app.st('userDefaultName');

        if ((msg.includes('quanto') || msg.includes('total')) && (msg.includes('gast') || msg.includes('mes') || msg.includes('mês'))) {
            return {
                type: 'query',
                response: this.translateByLanguage({
                    'pt-BR': `💰 ${userName}, você gastou **${app.formatCurrency(summary.totalAmount)}** este mês em **${summary.expenseCount} transações**.\n\n${app.currentUser?.monthlyBudget > 0 ? `Seu orçamento é ${app.formatCurrency(app.currentUser.monthlyBudget)} — restam **${app.formatCurrency(app.currentUser.monthlyBudget - summary.totalAmount)}**.` : 'Defina um orçamento no seu Perfil para acompanhar melhor!'}`,
                    en: `💰 ${userName}, you spent **${app.formatCurrency(summary.totalAmount)}** this month in **${summary.expenseCount} transactions**.\n\n${app.currentUser?.monthlyBudget > 0 ? `Your budget is ${app.formatCurrency(app.currentUser.monthlyBudget)} — you still have **${app.formatCurrency(app.currentUser.monthlyBudget - summary.totalAmount)}** left.` : 'Set a monthly budget in your Profile to track better!'}`,
                    es: `💰 ${userName}, gastaste **${app.formatCurrency(summary.totalAmount)}** este mes en **${summary.expenseCount} transacciones**.\n\n${app.currentUser?.monthlyBudget > 0 ? `Tu presupuesto es ${app.formatCurrency(app.currentUser.monthlyBudget)} — te quedan **${app.formatCurrency(app.currentUser.monthlyBudget - summary.totalAmount)}**.` : 'Define un presupuesto mensual en tu Perfil para controlar mejor.'}`,
                    fr: `💰 ${userName}, vous avez dépensé **${app.formatCurrency(summary.totalAmount)}** ce mois-ci en **${summary.expenseCount} transactions**.\n\n${app.currentUser?.monthlyBudget > 0 ? `Votre budget est de ${app.formatCurrency(app.currentUser.monthlyBudget)} — il vous reste **${app.formatCurrency(app.currentUser.monthlyBudget - summary.totalAmount)}**.` : 'Définissez un budget mensuel dans votre Profil pour mieux suivre.'}`
                })
            };
        }

        if (msg.includes('onde') && (msg.includes('gast') || msg.includes('mais'))) {
            const dominant = this.getDominantCategory(summary.byCategory);
            if (dominant) {
                const cat = app.t(`expenses.categories.${dominant.category}`);
                return {
                    type: 'query',
                    response: this.translateByLanguage({
                        'pt-BR': `🎯 Sua maior categoria de gastos é **${cat}**, com ${app.formatCurrency(dominant.total)} este mês.`,
                        en: `🎯 Your biggest spending category is **${cat}**, with ${app.formatCurrency(dominant.total)} this month.`,
                        es: `🎯 Tu categoría con más gasto es **${cat}**, con ${app.formatCurrency(dominant.total)} este mes.`,
                        fr: `🎯 Votre plus grande catégorie de dépenses est **${cat}**, avec ${app.formatCurrency(dominant.total)} ce mois-ci.`
                    })
                };
            }
        }

        if (msg.includes('orçamento') || msg.includes('budget') || msg.includes('orcamento')) {
            if (app.currentUser?.monthlyBudget > 0) {
                const remaining = app.currentUser.monthlyBudget - summary.totalAmount;
                const percent = (summary.totalAmount / app.currentUser.monthlyBudget) * 100;
                return {
                    type: 'query',
                    response: this.translateByLanguage({
                        'pt-BR': `📊 Você usou **${percent.toFixed(1)}%** do orçamento.\n\n- Orçamento: ${app.formatCurrency(app.currentUser.monthlyBudget)}\n- Gasto: ${app.formatCurrency(summary.totalAmount)}\n- Restante: **${app.formatCurrency(remaining)}**`,
                        en: `📊 You used **${percent.toFixed(1)}%** of your budget.\n\n- Budget: ${app.formatCurrency(app.currentUser.monthlyBudget)}\n- Spent: ${app.formatCurrency(summary.totalAmount)}\n- Remaining: **${app.formatCurrency(remaining)}**`,
                        es: `📊 Has usado **${percent.toFixed(1)}%** del presupuesto.\n\n- Presupuesto: ${app.formatCurrency(app.currentUser.monthlyBudget)}\n- Gasto: ${app.formatCurrency(summary.totalAmount)}\n- Restante: **${app.formatCurrency(remaining)}**`,
                        fr: `📊 Vous avez utilisé **${percent.toFixed(1)}%** du budget.\n\n- Budget: ${app.formatCurrency(app.currentUser.monthlyBudget)}\n- Dépensé: ${app.formatCurrency(summary.totalAmount)}\n- Restant: **${app.formatCurrency(remaining)}**`
                    })
                };
            }
            return {
                type: 'info',
                response: this.translateByLanguage({
                    'pt-BR': 'Você ainda não definiu um orçamento mensal. Vá em **Perfil** e configure um limite para acompanhar melhor!',
                    en: 'You have not set a monthly budget yet. Go to **Profile** and configure a limit to track better!',
                    es: 'Aún no definiste un presupuesto mensual. Ve a **Perfil** y configura un límite para controlar mejor.',
                    fr: 'Vous n\'avez pas encore défini de budget mensuel. Allez dans **Profil** et configurez une limite pour mieux suivre.'
                })
            };
        }

        // ---- Respostas gerais inteligentes ----
        return { type: 'general', response: this.generateOfflineResponse(message) };
    },

    generateOfflineResponse(message) {
        if (this.getNormalizedLanguage() !== 'pt-BR') {
            return this.translateByLanguage({
                en: 'I am in offline mode right now. I can still help, but with a shorter response. Please try asking again in a moment for full AI answers.',
                es: 'Ahora estoy en modo sin conexión. Aún puedo ayudarte, pero con respuestas más cortas. Intenta preguntar de nuevo en un momento para respuestas completas de IA.',
                fr: 'Je suis actuellement en mode hors ligne. Je peux encore vous aider, mais avec une réponse plus courte. Réessayez dans un instant pour des réponses IA complètes.',
                'pt-BR': 'Estou em modo offline agora. Ainda posso ajudar, mas com respostas mais curtas. Tente novamente em instantes para respostas completas de IA.'
            });
        }

        const msg = message.toLowerCase().trim();

        // Cumprimentos
        if (/^(oi|olá|ola|hey|hello|hi|e aí|eai|opa|bom dia|boa tarde|boa noite|tudo bem|tudo bom)/.test(msg)) {
            const hora = new Date().getHours();
            const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
            return `${saudacao}! 👋 Eu sou o **MONO**, seu assistente de IA do EconoMonteiro MAX!\n\nSou como o ChatGPT — posso responder sobre **qualquer assunto**:\n\n💰 **Finanças** — investimentos, economia, poupança\n📚 **Estudos** — dicas, técnicas, matérias\n🌍 **Mundo** — ciência, história, cultura, esportes\n💻 **Tecnologia** — programação, gadgets, apps\n🎭 **Entretenimento** — filmes, músicas, jogos\n💬 **Conversa** — pode me contar qualquer coisa!\n\nO que você quer saber? 😊`;
        }

        if (/obrigad|valeu|thanks|muito bom|incrível|ótimo|perfeito/.test(msg)) {
            return `De nada! 😊 Fico feliz em ajudar!\n\nPode perguntar qualquer coisa a qualquer hora. Estou aqui pra isso! 🚀`;
        }

        // Identidade
        if (/quem (é você|é vc|és você)|o que (você é|vc é)|você (é|sabe) (uma|um) ia|você é (uma|um) (robô|bot|ia|inteligência)|como você funciona/.test(msg)) {
            return `Sou o **MONO** 🤖 — assistente de IA do **EconoMonteiro MAX**!\n\nFui desenvolvido para ser como o ChatGPT, mas integrado ao seu app financeiro. Posso:\n\n- ✅ Responder **qualquer pergunta** (como ChatGPT)\n- ✅ Analisar suas **finanças pessoais**\n- ✅ Dar dicas de **economia e investimento**\n- ✅ Ajudar com **estudos e aprendizado**\n- ✅ Contar **curiosidades e fatos**\n- ✅ **Conversar** sobre qualquer tema\n\nFaça qualquer pergunta! 💬`;
        }

        // ---- FINANÇAS E ECONOMIA ----
        if (/o que é (economia|pib|inflação|juros|cdi|selic|tesouro direto|ações|bolsa|dividendo|fundo de investimento)/.test(msg) || /me (explica|fala sobre) (economia|pib|inflação|juros|cdi|selic)/.test(msg)) {
            if (msg.includes('pib')) return `📊 **PIB — Produto Interno Bruto**\n\nO PIB é a soma de todos os bens e serviços produzidos por um país em um período (geralmente um ano). É o principal indicador do tamanho e da saúde de uma economia.\n\n**Como é calculado:**\nPIB = Consumo + Investimento + Gastos do Governo + (Exportações − Importações)\n\n**O que significa:**\n- PIB crescendo → economia aquecida, mais empregos\n- PIB caindo → recessão, desemprego sobe\n- PIB per capita → divide o total pelo número de habitantes\n\n**Brasil em 2024:** ~R$ 11 trilhões (top 10 mundial)\n\nEm termos simples: se um padeiro faz pão, um motorista transporta, e você compra — tudo isso conta no PIB! 🍞🚗`;
            if (msg.includes('inflação') || msg.includes('inflacao')) return `📈 **Inflação**\n\nInflação é o aumento generalizado e contínuo dos preços de bens e serviços. Quando a inflação sobe, o poder de compra do seu dinheiro cai.\n\n**Exemplo prático:**\nSe um pão custava R$1,00 e agora custa R$1,10 → inflação de 10%\n\n**Por que acontece:**\n- Muita demanda, pouca oferta\n- Aumento de custos de produção\n- Emissão excessiva de dinheiro pelo governo\n\n**Como o governo combate:**\n- Sobe a taxa SELIC (juros básicos)\n- Juros altos = crédito caro = menos consumo = menos pressão nos preços\n\n**Proteção pessoal:**\n💡 Invista em ativos que acompanham a inflação (IPCA+)\n💡 Tesouro IPCA+ é uma boa opção!`;
            if (msg.includes('selic') || msg.includes('juros')) return `🏦 **Taxa SELIC**\n\nA SELIC é a taxa básica de juros da economia brasileira, definida pelo Banco Central a cada 45 dias.\n\n**Por que ela importa:**\n- É a referência para todos os outros juros\n- Juros do cartão, financiamento, empréstimo — tudo segue a SELIC\n- Investimentos como Tesouro Selic, CDB e poupança se baseiam nela\n\n**Como funciona:**\n- SELIC alta → crédito caro → menos consumo → menos inflação\n- SELIC baixa → crédito barato → mais consumo → mais crescimento\n\n**Hoje (2025):** SELIC ~14,75% ao ano\n\n**Para você:**\n💰 SELIC alta = bom momento para renda fixa (CDB, Tesouro)\n📈 SELIC baixa = bom momento para ações e renda variável`;
            if (msg.includes('cdi')) return `📊 **CDI — Certificado de Depósito Interbancário**\n\nO CDI é a taxa que os bancos usam para emprestar dinheiro entre si. Ele fica quase sempre igual à SELIC.\n\n**Importância:**\n- É o referencial para CDBs, LCIs, LCAs\n- Quando um CDB rende "100% do CDI", ele acompanha essa taxa\n\n**Comparação:**\n- Poupança: ~70% da SELIC (menos rentável)\n- CDB 100% CDI: ~100% da SELIC (boa opção)\n- CDB 110% CDI: acima da SELIC (ótimo!)\n\n💡 **Dica:** Sempre compare investimentos pelo % do CDI!`;
            if (msg.includes('tesouro')) return `🏛️ **Tesouro Direto**\n\nO Tesouro Direto é um programa do governo federal para vender títulos públicos para pessoas físicas pela internet.\n\n**Tipos:**\n1. **Tesouro Selic** — acompanha a taxa Selic. Indicado para reserva de emergência.\n2. **Tesouro IPCA+** — rende a inflação + juros fixos. Ideal para longo prazo.\n3. **Tesouro Prefixado** — taxa fixa definida no momento da compra.\n\n**Vantagens:**\n✅ Segurança (garantido pelo governo)\n✅ A partir de R$30\n✅ Fácil de comprar (bancos, corretoras)\n✅ Rentabilidade acima da poupança\n\n**Como começar:**\nAcesse tesourodireto.gov.br ou sua corretora favorita!`;
        }

        if (/como (economiz|poupar|guardar dinheiro|fazer reserva|sair das dívidas|quitar|investir|começar a investir)/.test(msg) || /(dica|dicas) (de |para )?(economiz|poupan|financ|dinheiro|investimento)/.test(msg)) {
            if (msg.includes('dívida') || msg.includes('divida') || msg.includes('quitar')) {
                return `💳 **Como Sair das Dívidas**\n\n**Passo 1 — Liste tudo:**\nAnote todas as dívidas: valor, taxa de juros, parcelas.\n\n**Passo 2 — Priorize:**\nPague primeiro as dívidas com **maiores juros** (cartão de crédito, cheque especial).\n\n**Estratégias:**\n🎯 **Método Avalanche** — Paga a de maior juros primeiro (economiza mais no total)\n⛄ **Método Bola de Neve** — Paga a menor primeiro (mais motivação)\n\n**Dicas práticas:**\n- Negocie com o credor (bancos frequentemente dão desconto)\n- Consolide dívidas (troque dívida cara por empréstimo mais barato)\n- Corte gastos supérfluos temporariamente\n- Use 20-30% da renda extra só para quitar dívidas\n\n**Evite:**\n❌ Pagar só o mínimo do cartão (juros de 15-20% ao MÊS!)\n❌ Fazer novas dívidas enquanto quita antigas\n❌ Ignorar o problema (só piora)\n\n💪 Uma dívida por vez. Você consegue!`;
            }
            return `💡 **10 Dicas Poderosas para Economizar**\n\n**1. Regra 50/30/20** 📊\n- 50% para necessidades (aluguel, comida, contas)\n- 30% para desejos (lazer, restaurante, roupas)\n- 20% para poupança e investimentos\n\n**2. Anote todos os gastos** ✏️\nUse o EconoMonteiro! Consciência dos gastos reduz em 15-20%.\n\n**3. Regra das 24h** ⏰\nQuer comprar algo? Espere 24h. Elimina 70% das compras por impulso.\n\n**4. Automatize poupança** 🤖\nTransfira 10% logo que receber. Antes de gastar.\n\n**5. Cozinhe em casa** 🍳\nComer fora custa 3-5x mais. Economiza R$300-600/mês.\n\n**6. Cancele assinaturas que não usa** 📱\nFaça uma "limpeza" de assinaturas. Pode poupar R$100-300/mês.\n\n**7. Compre genéricos** 🛒\n30-50% mais barato. Qualidade geralmente igual.\n\n**8. Use transporte público ou bike** 🚌\nCarro custa combustível + seguro + manutenção + estacionamento.\n\n**9. Renegocie contratos** 📞\nLigue para internet, telefone, seguro. Ameace cancelar e peça desconto.\n\n**10. Invista o que economizou** 📈\nNão deixe o dinheiro parado na conta. Pelo menos Tesouro Selic!\n\n**Meta:** comece com 3 dessas hoje! 🎯`;
        }

        if (/como (começar a investir|investir)|o que (é|são) (ações|fundos|etf|renda fixa|renda variável|dividendos|criptomoeda|bitcoin)|onde investir/.test(msg)) {
            if (msg.includes('bitcoin') || msg.includes('cripto') || msg.includes('criptomoeda')) {
                return `₿ **Criptomoedas**\n\nCriptomoedas são moedas digitais que usam criptografia e blockchain para funcionar sem banco central.\n\n**Principais:**\n- **Bitcoin (BTC)** — a mais famosa, "ouro digital"\n- **Ethereum (ETH)** — plataforma de contratos inteligentes\n- **Solana, BNB, XRP** — outras populares\n\n**Vantagens:**\n✅ Alto potencial de valorização\n✅ Sem fronteiras (transferência global rápida)\n✅ Descentralizada (não depende de governo)\n\n**Desvantagens:**\n❌ Altíssima volatilidade (pode cair 70% em meses)\n❌ Sem proteção do FGC\n❌ Regulamentação incerta\n❌ Golpes e fraudes frequentes\n\n**Para iniciantes:**\n💡 Nunca invista mais do que pode perder\n💡 Máximo 5-10% da carteira em cripto\n💡 Use exchanges confiáveis (Binance, Mercado Bitcoin)\n💡 Guarde sua chave privada com segurança\n\nRisco alto = potencial alto, mas cuidado! ⚠️`;
            }
            return `📈 **Guia de Investimentos para Iniciantes**\n\n**Por que investir?**\nDinheiro parado perde valor com a inflação. Investindo, você faz o dinheiro trabalhar por você!\n\n**Começe por aqui (em ordem):**\n\n**1. Reserva de Emergência** 🛡️\nTenha 3-6 meses de gastos num investimento seguro e líquido.\n→ **Tesouro Selic** ou **CDB com liquidez diária**\n\n**2. Renda Fixa** 🏦\nInvestimentos com rentabilidade previsível:\n- Tesouro Direto (a partir de R$30)\n- CDB, LCI, LCA (bancos e corretoras)\n- Rendimento: ~11-14% ao ano\n- Risco: Muito baixo\n\n**3. Fundos de Investimento** 📦\nUm gestor profissional cuida do dinheiro por você.\n- Fácil e diversificado\n- Taxa de administração: 0,5-2%/ano\n- Vários perfis de risco\n\n**4. ETFs e Ações** 📊\nComprar partes de empresas:\n- ETF BOVA11 = todas as empresas do Ibovespa\n- Potencial maior, risco maior\n- Ideal para longo prazo (5+ anos)\n\n**Onde abrir conta:** XP, Rico, Nu Invest, Inter (todas gratuitas)\n\n**Regra de ouro:** Quanto mais cedo, melhor. Juros compostos são mágica! ✨`;
        }

        // ---- TECNOLOGIA ----
        if (/o que é (programação|código|python|javascript|java|html|css|banco de dados|api|inteligência artificial|machine learning|ia|gpt)/.test(msg) || /como (aprender a programar|começar em programação|virar programador)/.test(msg)) {
            if (msg.includes('python')) return `🐍 **Python**\n\nPython é uma das linguagens de programação mais populares do mundo, famosa pela sua simplicidade e versatilidade.\n\n**Onde é usado:**\n- 🤖 Inteligência Artificial e Machine Learning\n- 📊 Análise de dados e ciência de dados\n- 🌐 Desenvolvimento web (Django, Flask)\n- 🔧 Automação e scripts\n- 🎮 Jogos (Pygame)\n\n**Por que aprender:**\n✅ Sintaxe simples (ideal para iniciantes)\n✅ Alta demanda no mercado\n✅ Salários atrativos (R$5k-20k+/mês)\n✅ Comunidade enorme\n\n**Como começar:**\n1. python.org (download gratuito)\n2. Cursos: Python para Todos (Coursera), CS50 (Harvard)\n3. Pratique no Repl.it (online, sem instalar nada)\n4. Faça projetos: calculadora, jogo simples, bot\n\n**Primeiro código:**\n\`\`\`python\nprint("Olá, Mundo!")\nname = input("Qual seu nome? ")\nprint(f"Olá, {name}!")\n\`\`\`\n\nÉ uma das melhores escolhas para quem quer entrar em tecnologia! 💻`;
            if (msg.includes('javascript') || msg.includes('js')) return `⚡ **JavaScript**\n\nJavaScript é a linguagem da web — roda em todo navegador e cria interatividade nos sites.\n\n**Onde é usado:**\n- 🌐 Frontend de sites (React, Vue, Angular)\n- 🖥️ Backend (Node.js)\n- 📱 Apps mobile (React Native)\n- 🎮 Jogos web\n- Este app (EconoMonteiro) é feito em JS!\n\n**Vantagens:**\n✅ Roda no navegador (sem instalar nada)\n✅ Linguagem mais usada do mundo\n✅ Full-stack com Node.js\n✅ Salário médio: R$6k-25k/mês\n\n**Para aprender:**\n1. javascript.info (melhor tutorial gratuito)\n2. freeCodeCamp.org\n3. Rocketseat, Alura\n4. Pratique no console do navegador (F12)\n\nDominar JS = abrir portas em todo o mundo tech! 🚪`;
            if (msg.includes('ia') || msg.includes('inteligência artificial') || msg.includes('machine learning') || msg.includes('gpt')) return `🤖 **Inteligência Artificial**\n\nIA é a capacidade de máquinas realizarem tarefas que normalmente exigiriam inteligência humana.\n\n**Tipos:**\n- **IA Narrow** — faz uma coisa bem (reconhecimento facial, ChatGPT)\n- **IA Geral** — pensa como humano (ainda não existe)\n- **Machine Learning** — aprende com dados\n- **Deep Learning** — redes neurais artificiais\n\n**Exemplos no dia a dia:**\n- ChatGPT (geração de texto)\n- DALL-E (geração de imagens)\n- Netflix (recomendação de filmes)\n- Filtro de spam no email\n- GPS (rotas otimizadas)\n- Reconhecimento facial do celular\n\n**Como funciona o ChatGPT:**\nFoi treinado em bilhões de textos da internet e aprendeu padrões da linguagem humana. Ele prevê qual palavra vem a seguir com base no contexto.\n\n**Futuro:** A IA vai transformar todas as profissões. O melhor a fazer é aprender a trabalhar *com* ela, não contra ela! 🚀`;
            return `💻 **Como Aprender Programação do Zero**\n\n**Por onde começar:**\n1. Escolha uma linguagem (Python ou JavaScript são ideais)\n2. Aprenda o básico: variáveis, loops, condições, funções\n3. Faça projetos simples\n4. Pratique todos os dias (30min constantes > 4h por semana)\n\n**Recursos gratuitos:**\n- CS50 da Harvard (YouTube/edX) — melhor curso de programação\n- freeCodeCamp.org — JavaScript e web\n- Python para Todos (python.org)\n- The Odin Project — desenvolvimento web\n\n**Caminho típico:**\n📅 Mês 1-2: Lógica e sintaxe básica\n📅 Mês 3-4: Projetos simples\n📅 Mês 5-6: Frameworks (React, Django)\n📅 Mês 7-12: Portfólio e mercado\n\n**Dica mais importante:** Programe todo dia, mesmo que 20 minutos. Consistência > intensidade! 💪`;
        }

        // ---- CIÊNCIA E NATUREZA ----
        if (/como funciona|o que causa|por que (o|a|os|as)?|como (é feito|se forma|acontece)|explica (o|a)?/.test(msg)) {
            if (msg.includes('buraco negro')) return `🌑 **Buraco Negro**\n\nUm buraco negro é uma região do espaço onde a gravidade é tão intensa que nada — nem mesmo a luz — consegue escapar.\n\n**Como se forma:**\nQuando uma estrela gigante (8-20x o Sol) morre em uma supernova, o núcleo pode colapsar sobre si mesmo, criando um buraco negro.\n\n**Partes:**\n- **Singularidade** — o ponto central, densidade infinita\n- **Horizonte de eventos** — o "ponto sem retorno" (se cruzar, não volta)\n- **Ergosfera** — região em torno do horizonte\n\n**Curiosidades:**\n- O mais próximo está a ~1.000 anos-luz\n- O da Via Láctea (Sgr A*) tem 4 milhões de sóis de massa\n- O tempo passa mais lento perto de buracos negros\n- Hawking descobriu que eles "evaporam" lentamente\n\n**Foi fotografado em 2019!** 📸 O buraco negro M87 ficou famoso (foi a primeira foto real)\n\nSão as estruturas mais extremas do universo! ✨`;
            if (msg.includes('sonho') || msg.includes('pesadelo')) return `🌙 **Por que Sonhamos?**\n\nOs sonhos ainda são um dos maiores mistérios da neurociência, mas já sabemos bastante!\n\n**Quando sonhamos:**\nPrincipalmente na fase **REM** (Rapid Eye Movement) do sono — olhos se movem, cérebro muito ativo, corpo paralisado (para não agirmos os sonhos).\n\n**Teorias:**\n1. **Consolidação de memórias** — cérebro "grava" o dia\n2. **Processamento emocional** — processa sentimentos\n3. **Simulação de ameaças** — prepara para perigos\n4. **Atividade aleatória** — subconsciente criando histórias\n\n**Por que esquecemos:**\nA norepinefrina (relacionada à memória) fica baixa no REM. Quem acorda no REM lembra mais!\n\n**Pesadelos:**\nFrequentes em estresse, ansiedade, traumas ou certos alimentos antes de dormir (queijo, álcool).\n\n**Dica:** Anote seus sonhos ao acordar — ajuda a lembrá-los! 📒`;
        }

        // ---- SAÚDE E BEM-ESTAR ----
        if (/(emagrecer|perder peso|dieta|fazer academia|exercício|musculação|ansiedade|depressão|estresse|dormir melhor|qualidade de sono)/.test(msg)) {
            if (msg.includes('ansiedade') || msg.includes('estresse')) return `🧘 **Lidando com Ansiedade e Estresse**\n\n**O que é ansiedade:**\nÉ a resposta do corpo a situações percebidas como ameaças. Em excesso, prejudica a vida.\n\n**Técnicas comprovadas:**\n\n**1. Respiração 4-7-8** (imediata)\n- Inspire 4 segundos\n- Segure 7 segundos\n- Expire 8 segundos\n- Repita 4x. Ativa o sistema nervoso parassimpático.\n\n**2. Grounding 5-4-3-2-1**\n- 5 coisas que vê\n- 4 que pode tocar\n- 3 que ouve\n- 2 que cheira\n- 1 que saboreia\n\n**3. Exercício físico** 🏃\n30 minutos de caminhada = ansiolítico natural. Libera serotonina e endorfina.\n\n**4. Sono regular** 😴\nPrivação de sono x2 a ansiedade.\n\n**5. Diário de preocupações** ✏️\nEscreva o que preocupa + um plano de ação. Tira da cabeça.\n\n**Quando procurar ajuda:**\nSe a ansiedade interfere no trabalho, relacionamentos ou sono frequentemente → busque um psicólogo. Terapia TCC é muito eficaz! 💪\n\nVocê não está sozinho. Cuidar da saúde mental é tão importante quanto a física! ❤️`;
            if (msg.includes('emagrecer') || msg.includes('perder peso') || msg.includes('dieta')) return `🥗 **Como Perder Peso de Forma Saudável**\n\n**Princípio básico:**\nPerder peso = gastar mais calorias do que consome. Simples na teoria, difícil na prática.\n\n**O que funciona (ciência):**\n\n**1. Déficit calórico moderado** 🍽️\n- 300-500 calorias abaixo do necessário\n- Resultado: 0,5-1kg/semana (sustentável)\n- Muito acima = perde músculo e desacelera metabolismo\n\n**2. Proteína alta** 🥩\n- 1,6-2g por kg de peso corporal\n- Aumenta saciedade\n- Preserva músculo\n- Ovos, frango, peixe, leguminosas\n\n**3. Exercício de força** 💪\n- Musculação > só cardio para perda de gordura\n- Aumenta metabolismo basal\n- 3x/semana já ajuda muito\n\n**4. Sono** 😴\n- Dormir mal → mais fome (+grelina) e menos saciedade (−leptina)\n- Meta: 7-9h por noite\n\n**5. Hidratação** 💧\n- Beba 2-3L de água/dia\n- Às vezes confundimos fome com sede\n\n**O que NÃO funciona:**\n❌ Dietas radicais (efeito sanfona)\n❌ Cortar todos carboidratos\n❌ Suplementos milagrosos\n❌ Jejum extremo sem orientação\n\nConsistência bate perfeição. Pequenas mudanças > grandes restrições! 🌱`;
        }

        // ---- HISTÓRIA E CULTURA ----
        if (/(história|segunda guerra|primeira guerra|revolução|napoleon|hitler|segunda guerra|roma|egito|maias|aztecas|brasil colonial|idade média|renascimento)/.test(msg)) {
            if (msg.includes('segunda guerra')) return `⚔️ **Segunda Guerra Mundial (1939-1945)**\n\n**Causas:**\n- Crise econômica pós-1929 (Grande Depressão)\n- Humilhação da Alemanha no Tratado de Versalhes\n- Ascensão do nazismo com Hitler\n- Invasão da Polônia em setembro de 1939\n\n**Principais países:**\n- **Aliados:** EUA, URSS, Reino Unido, França\n- **Eixo:** Alemanha, Itália, Japão\n\n**Momentos decisivos:**\n- Batalha de Stalingrado (1942-43) — virada no leste\n- Dia D (6/6/1944) — invasão da Normandia\n- Bombas em Hiroshima e Nagasaki (agosto 1945)\n\n**Resultado:**\n- 70-85 milhões de mortos (maior conflito da história)\n- Fim do colonialismo europeu\n- Início da Guerra Fria (EUA x URSS)\n- Criação da ONU (1945)\n- O Holocausto: 6 milhões de judeus assassinados\n\n**Lição:** Nunca subestimar o poder do discurso de ódio. 🕊️`;
        }

        // ---- ENTRETENIMENTO ----
        if (/(filme|série|música|jogo|game|livro recomend|indicação)/.test(msg)) {
            if (msg.includes('filme') || msg.includes('series') || msg.includes('série')) return `🎬 **Recomendações de Filmes e Séries**\n\n**Filmes imperdíveis:**\n🏆 **Shawshank Redemption** — Motivação, esperança (IMDb 9.3)\n🌑 **Interestelar** — Ficção científica épica de Nolan\n🧠 **The Social Network** — Como o Facebook foi criado\n💰 **The Big Short** — Crise financeira de 2008 (ótimo para quem quer entender economia)\n🤖 **Her** — IA e solidão (muito relevante hoje)\n🎭 **Parasita** — Desigualdade social (Oscar de Melhor Filme)\n\n**Séries top:**\n📺 **Breaking Bad** — Considerada a melhor série de todos os tempos\n🧪 **Chernobyl** (HBO) — Baseada em fatos reais, perturbadora\n💵 **Billions** — Mercado financeiro e poder\n🏛️ **Succession** — Poder, família e dinheiro\n👨‍💻 **Mr. Robot** — Hacking, tecnologia, realidade\n🌺 **Dark** — Ficção científica brasileira/alemã incrível\n\n**Para quem gosta de finanças:**\n- The Wolf of Wall Street (filme)\n- Billions (série)\n- The Big Short (filme)\n- Money Heist — La Casa de Papel (série) 😄`;
            if (msg.includes('música') || msg.includes('musica')) return `🎵 **Curiosidades sobre Música**\n\n**Por que música nos emociona?**\nMúsica ativa o sistema dopaminérgico (recompensa) do cérebro — o mesmo de comida e sexo!\n\n**Efeitos da música:**\n- 🎸 Rock/Metal = aumenta adrenalina e foco\n- 🎹 Clássica = reduz estresse, melhora concentração (Mozart effect)\n- 🎧 Lo-fi = ideal para estudar\n- 🎵 Salsa/Funk = melhora humor\n\n**Curiosidades:**\n- Uma música "gruda" na cabeça (earworm) porque o cérebro quer completá-la\n- Músicos têm mais conexões entre hemisférios cerebrais\n- Bebês respondem a músicas antes de nascer\n- A nota mais aguda que humanos ouvem: 20.000 Hz\n\n**Artistas mais ouvidos no mundo:**\n1. The Weeknd / Taylor Swift / Drake (streaming)\n2. Beatles (história — vendas físicas)\n3. Michael Jackson (impacto cultural)\n\nQue estilo você prefere? 🎶`;
        }

        // ---- PIADAS ----
        if (/(piada|humor|engraçad|me faz rir|conta uma)/.test(msg)) {
            const piadas = [
                '😄 Por que o pato chegou atrasado? Porque o semáforo estava em quackm!\n\n(Tá, eu preciso melhorar minhas piadas 😅)',
                '🧑‍💻 Um programador foi ao mercado.\nA esposa pediu: "Compra um litro de leite. Se tiver ovos, compra 12."\nEle voltou com 12 litros de leite.\n"Tinha ovos!" 😂',
                '💰 Por que os economistas nunca ganham na loteria?\nPorque eles sempre esperam o valor esperado! 😄',
                '🤓 O professor perguntou ao aluno: "Se você tiver 10 chocolates e der 2 para um amigo, com quantos fica?"\nAluno: "Com 10."\nProfessor: "Por quê?"\nAluno: "Porque eu não tenho amigos!" 😂',
                '🐍 Por que programadores preferem Python?\nPorque é a única cobra que não morde! 🐍',
                '🏦 Um bancário, um economista e um contador estão num deserto.\nO bancário diz: "Precisamos de água!"\nO economista diz: "Vamos supor que temos água..."\nO contador diz: "Quanto a gente tem a receber se morrermos?" 😂',
            ];
            return piadas[Math.floor(Math.random() * piadas.length)];
        }

        // ---- MOTIVAÇÃO ----
        if (/(motiv|desanimad|desistir|não consigo|difícil|cansad|vontade de desistir|ajuda|encoraj)/.test(msg)) {
            const mensagens = [
                `💪 **Você é mais forte do que imagina!**\n\nTodo mundo tem dias difíceis. A diferença entre quem chega lá e quem não chega não é talento — é persistência.\n\nLembre-se: **cada passo à frente conta**, mesmo que seja pequeno. Você já chegou longe só por estar tentando.\n\n🌱 "O melhor momento para plantar uma árvore foi há 20 anos. O segundo melhor é agora."\n\nVai em frente. Você consegue! 🚀`,
                `⭐ **Acredite no processo!**\n\nOs resultados não aparecem da noite para o dia — aparecem quando você menos espera, depois de muita consistência.\n\nDormir bem, tentar de novo amanhã, cuidar de você mesmo... isso **também é progresso**.\n\n🔥 "Difícil não significa impossível. Significa que vai precisar de mais esforço."\n\nEu acredito em você! 💫`,
                `🌟 **Tá difícil? Ótimo sinal.**\n\nCoisas importantes nunca são fáceis. Se fosse fácil, todo mundo faria e não valeria tanto.\n\nA dificuldade que você está sentindo agora está te moldando para um futuro melhor.\n\n💎 Diamantes são formados sob pressão extrema. Você também está sendo lapidado.\n\nContinue! Cada dia que você persiste conta! 🏆`,
            ];
            return mensagens[Math.floor(Math.random() * mensagens.length)];
        }

        // ---- MATEMÁTICA ----
        if (/(\d+)\s*[\+\-\*\/x÷]\s*(\d+)/.test(msg)) {
            try {
                const expr = msg.match(/[\d\s\+\-\*\/\.]+/)?.[0]?.trim();
                if (expr && /^[\d\s\+\-\*\/\.]+$/.test(expr)) {
                    const result = Function('"use strict"; return (' + expr + ')')();
                    if (typeof result === 'number' && isFinite(result)) {
                        return `🧮 **${expr} = ${result}**\n\nCálculo feito! Precisa de mais algum? 😊`;
                    }
                }
            } catch (e) {}
        }

        // ---- CLIMA / TEMPO ----
        if (/(temperatura|clima|tempo (hoje|amanhã|agora)|previsão do tempo|vai chover|está (frio|quente|calor))/.test(msg)) {
            return `🌤️ Infelizmente não tenho acesso aos dados meteorológicos em tempo real.\n\nPara saber o clima atual:\n- 🌐 **Google:** pesquise "tempo em [sua cidade]"\n- 📱 **App:** AccuWeather, Weather Channel, Climatempo\n- 🔍 **Site:** tempo.com.br\n\nDesculpe não poder ajudar mais com isso! Tem outra pergunta? 😊`;
        }

        // ---- ESPORTES ----
        if (/(futebol|brasileiro|champions|copa do mundo|neymar|messi|ronaldo|mbappé|flamengo|palmeiras|corinthians|santos|sporting|fórmula 1|tênis|basquete|nba)/.test(msg)) {
            return `⚽ **Esportes**\n\nAdoro falar de esportes! Embora meu conhecimento tenha uma data de corte, posso compartilhar fatos e curiosidades.\n\n**Futebol Brasil:**\n- 5 títulos da Copa do Mundo (1958, 62, 70, 94, 02)\n- Pelé é considerado o maior de todos os tempos\n- Rodada Brasileira mais movimentada: brasileirão tem 38 rodadas\n\n**Recordes mundiais:**\n- Mais gols em carreira: Cristiano Ronaldo (900+)\n- Mais títulos de Champions: Real Madrid (15)\n- Copa do Mundo: Brasil (5 títulos)\n\n**Para resultados ao vivo:**\n⚡ Google "resultados futebol hoje"\n📱 Apps: OneFootball, FlashScore, Sofascore\n\nTem algum time favorito? Posso contar curiosidades! ⚽`;
        }

        // ---- RESPOSTA GENÉRICA INTELIGENTE ----
        const topico = msg.length > 5 ? msg.substring(0, 40) : 'esse assunto';
        const respostas = [
            `Que pergunta interessante sobre **"${topico}"**! 🤔\n\nEssa é uma área fascinante. Para te dar a melhor resposta:\n\n📌 **Pode me dar mais detalhes?** Quanto mais específico, melhor posso ajudar!\n\nAlternativamente, posso te ajudar com:\n💰 Finanças e economia\n📚 Dicas de estudo\n💻 Tecnologia\n🌍 Ciência e história\n💪 Motivação e bem-estar\n\nO que você gostaria de explorar? 😊`,

            `Ótima pergunta! 💡\n\nSobre **"${topico}"** — é um tema com muita profundidade.\n\n🔍 Para a resposta mais completa:\n1. Posso buscar ângulos específicos se você detalhar mais\n2. Para informações muito atuais, recomendo verificar no Google\n3. Me diga o que exatamente quer saber!\n\nSou como o ChatGPT — quanto mais contexto, melhor a resposta! 🤖`,

            `Entendo sua curiosidade sobre **"${topico}"**! 🧠\n\nMe conte mais detalhes para eu poder te ajudar melhor:\n- Qual aspecto específico interessa mais?\n- É para uso pessoal, estudo ou trabalho?\n- Tem algum contexto que devo considerar?\n\nCom mais informações, posso dar uma resposta muito mais útil! 💬`,
        ];

        return respostas[Math.floor(Math.random() * respostas.length)];
    }
};
