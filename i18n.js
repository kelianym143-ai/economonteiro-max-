/**
 * SISTEMA COMPLETO DE INTERNACIONALIZAÇÃO (I18N)
 * Garante que 100% do app mude para o idioma selecionado
 * Suporta: Português (Brasil), English, Español, Français
 */

const i18n = {
    // Idioma atual padrão
    currentLanguage: localStorage.getItem('language') || 'pt-BR',
    
    // Função para obter tradução aninhada
    t(key) {
        const keys = key.split('.');
        let value = translations[this.currentLanguage];
        
        if (!value) {
            console.warn(`⚠️ Idioma '${this.currentLanguage}' não encontrado em translations`);
            value = translations['pt-BR'];
        }
        
        for (let k of keys) {
            value = value?.[k];
            if (!value) {
                console.warn(`⚠️ Chave de tradução '${key}' não encontrada para idioma ${this.currentLanguage}`);
                return key; // Retorna a chave se não encontrar
            }
        }
        return value || key;
    },

    /**
     * Muda o idioma do aplicativo COMPLETAMENTE
     * @param {string} lang - Código do idioma ('pt-BR', 'en', 'es', 'fr')
     */
    setLanguage(lang) {
        const previousLanguage = this.currentLanguage;

        // Validar se o idioma é suportado
        const supportedLanguages = ['pt-BR', 'en', 'es', 'fr'];
        if (!supportedLanguages.includes(lang)) {
            console.warn(`⚠️ Idioma '${lang}' não suportado`);
            return false;
        }

        // 1️⃣ Atualizar variável interna
        this.currentLanguage = lang;
        
        // 2️⃣ Salvar no localStorage
        localStorage.setItem('language', lang);
        
        // 3️⃣ Atualizar atributo lang do HTML
        document.documentElement.lang = lang.toLowerCase();
        
        // 4️⃣ Atualizar direction (para futuros idiomas RTL)
        const rtlLanguages = []; // Adicione 'ar', 'he' se suportar árabe/hebraico
        document.documentElement.dir = rtlLanguages.includes(lang) ? 'rtl' : 'ltr';
        
        // 5️⃣ Atualizar meta tags de idioma
        this.updateMetaTags(lang);
        
        // 6️⃣ Disparar evento customizado para módulos externos
        window.dispatchEvent(new CustomEvent('languageChanged', { 
            detail: { language: lang, oldLanguage: previousLanguage } 
        }));
        
        // 7️⃣ Recarregar renderização do app
        if (window.app && typeof window.app.render === 'function') {
            window.app.render();
        }
        
        // 8️⃣ Atualizar documento.title
        document.title = this.getPageTitle(lang);
        
        return true;
    },

    /**
     * Atualiza meta tags com o idioma correto
     */
    updateMetaTags(lang) {
        const langMap = {
            'pt-BR': { code: 'pt-br', name: 'Português (Brasil)' },
            'en': { code: 'en', name: 'English' },
            'es': { code: 'es', name: 'Español' },
            'fr': { code: 'fr', name: 'Français' }
        };

        const langInfo = langMap[lang];
        
        // Atualizar meta language
        let metaLang = document.querySelector('meta[http-equiv="content-language"]');
        if (!metaLang) {
            metaLang = document.createElement('meta');
            metaLang.httpEquiv = 'content-language';
            document.head.appendChild(metaLang);
        }
        metaLang.content = langInfo.code;
    },

    /**
     * Obtém o título da página no idioma correto
     */
    getPageTitle(lang) {
        const titles = {
            'pt-BR': 'ECONOMONTEIRO MAX - Seu Assistente Financeiro Inteligente',
            'en': 'ECONOMONTEIRO MAX - Your Smart Financial Assistant',
            'es': 'ECONOMONTEIRO MAX - Tu Asistente Financiero Inteligente',
            'fr': 'ECONOMONTEIRO MAX - Votre Assistant Financier Intelligent'
        };
        return titles[lang] || titles['pt-BR'];
    },

    /**
     * Obtém a moeda padrão para o idioma
     */
    getDefaultCurrency(lang) {
        const currencies = {
            'pt-BR': 'BRL',
            'en': 'USD',
            'es': 'USD',
            'fr': 'EUR'
        };
        return currencies[lang] || 'BRL';
    },

    /**
     * Formata número seguindo o padrão do idioma
     */
    formatNumber(value, decimals = 2) {
        const locales = {
            'pt-BR': 'pt-BR',
            'en': 'en-US',
            'es': 'es-ES',
            'fr': 'fr-FR'
        };
        
        return new Intl.NumberFormat(locales[this.currentLanguage], {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(value);
    },

    /**
     * Formata moeda seguindo o padrão do idioma
     */
    formatCurrency(value, currency = 'BRL') {
        const locales = {
            'pt-BR': 'pt-BR',
            'en': 'en-US',
            'es': 'es-ES',
            'fr': 'fr-FR'
        };

        const currencyMap = {
            'BRL': 'BRL',
            'USD': 'USD',
            'EUR': 'EUR'
        };

        return new Intl.NumberFormat(locales[this.currentLanguage], {
            style: 'currency',
            currency: currencyMap[currency] || 'BRL'
        }).format(value);
    },

    /**
     * Formata data seguindo o padrão do idioma
     */
    formatDate(date, format = 'short') {
        const locales = {
            'pt-BR': 'pt-BR',
            'en': 'en-US',
            'es': 'es-ES',
            'fr': 'fr-FR'
        };

        const options = {
            short: { year: 'numeric', month: '2-digit', day: '2-digit' },
            long: { year: 'numeric', month: 'long', day: 'numeric' },
            full: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
        };

        return new Intl.DateTimeFormat(locales[this.currentLanguage], options[format] || options.short)
            .format(new Date(date));
    },

    /**
     * Formata hora seguindo o padrão do idioma
     */
    formatTime(date) {
        const locales = {
            'pt-BR': 'pt-BR',
            'en': 'en-US',
            'es': 'es-ES',
            'fr': 'fr-FR'
        };

        return new Intl.DateTimeFormat(locales[this.currentLanguage], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).format(new Date(date));
    },

    /**
     * Obtém a lista de idiomas suportados
     */
    getSupportedLanguages() {
        return [
            { code: 'pt-BR', flag: '🇧🇷', name: 'Português (Brasil)' },
            { code: 'en', flag: '🇺🇸', name: 'English' },
            { code: 'es', flag: '🇪🇸', name: 'Español' },
            { code: 'fr', flag: '🇫🇷', name: 'Français' }
        ];
    },

    /**
     * Inicializa o sistema i18n
     * Deve ser chamado quando o DOM está pronto
     */
    init() {
        // Configurar idioma inicial
        this.setLanguage(this.currentLanguage);
        
        // Adicionar listeners aos seletores de idioma
        this.attachLanguageSelectors();
        
        console.log(`✅ I18N iniciado com idioma: ${this.currentLanguage}`);
    },

    /**
     * Anexa listeners aos seletores de idioma na página
     */
    attachLanguageSelectors() {
        document.addEventListener('change', (event) => {
            if (event.target.classList.contains('lang-selector') || 
                event.target.name === 'language' ||
                event.target.classList.contains('language-select')) {
                this.setLanguage(event.target.value);
            }
        });
    }
};

// Garantir que i18n está disponível globalmente
window.i18n = i18n;

// Inicializar quando o documento estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        i18n.init();
    });
} else {
    i18n.init();
}
