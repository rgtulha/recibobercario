/**
 * js/utils.js
 * Utilitários gerais para formatação de dados, datas e strings.
 * Sem dependências de estado global.
 */

/**
 * Formata um número para o padrão de moeda brasileiro (BRL).
 * @param {number} value - O valor numérico.
 * @returns {string} String formatada (ex: R$ 1.200,00).
 */
export function formatCurrency(value) {
    if (value === null || value === undefined) return 'R$ 0,00';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Formata uma string de data (YYYY-MM-DD) para o padrão brasileiro (DD/MM/AAAA).
 * Resolve problemas de timezone criando a data com hora zerada localmente.
 * @param {string} dateString - Data no formato YYYY-MM-DD.
 * @returns {string} Data formatada ou string vazia se inválida.
 */
export function formatDate(dateString) {
    if (!dateString) return '';
    // Garante a interpretação correta do dia, independente do fuso horário
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
}

/**
 * Retorna a data atual formatada por extenso.
 * Ex: "09 de janeiro de 2026".
 * @returns {string} Data atual por extenso.
 */
export function getCurrentDateFormatted() {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const monthNames = [
        "janeiro", "fevereiro", "março", "abril", "maio", "junho", 
        "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
    ];
    const month = monthNames[today.getMonth()];
    const year = today.getFullYear();
    return `${day} de ${month} de ${year}`;
}

/**
 * Capitaliza as palavras de uma string, ignorando preposições comuns.
 * Ideal para nomes próprios (ex: "JOÃO DA SILVA" -> "João da Silva").
 * @param {string} str - Texto original.
 * @returns {string} Texto capitalizado.
 */
export function capitalizeWords(str) {
    if (!str) return '';
    const lowerWordsException = ['de', 'da', 'do', 'dos', 'das', 'e', 'em', 'com', 'sem', 'para', 'por'];
    
    return str.split(' ').map(word => {
        if (word.length === 0) return '';
        const lowerWord = word.toLowerCase();
        if (lowerWordsException.includes(lowerWord)) {
            return lowerWord;
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
}

/**
 * Converte um valor numérico monetário para sua representação por extenso em português.
 * Suporta valores até a casa dos milhares.
 * @param {number|string} num - O valor a ser convertido.
 * @returns {string} O valor por extenso (ex: "cento e dez reais").
 */
export function numberToWords(num) {
    let numericValue = parseFloat(num);
    if (isNaN(numericValue)) {
        numericValue = 0;
    }

    const [reaisStr, centavosStr] = numericValue.toFixed(2).split('.');
    let reaisNum = parseInt(reaisStr);
    let centavosNum = parseInt(centavosStr);

    const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
    const especiais = ["dez", "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
    const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
    const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

    function getWordsPart(n) {
        if (n === 0) return "";
        let str = "";

        if (n >= 1000) {
            if (n === 1000) {
                str += "mil";
            } else {
                str += getWordsPart(Math.floor(n / 1000)) + " mil";
            }
            n %= 1000;
            if (n > 0) str += " e "; 
        }

        if (n >= 100) {
            if (n === 100) str += "cem";
            else str += centenas[Math.floor(n / 100)];
            n %= 100;
            if (n > 0) str += " e ";
        }
        
        if (n >= 20) {
            str += dezenas[Math.floor(n / 10)];
            n %= 10;
            if (n > 0) str += " e ";
        } else if (n >= 10) {
            str += especiais[n - 10];
            n = 0;
        }
        
        if (n > 0) {
            str += unidades[n];
        }
        return str;
    }

    let reaisText = getWordsPart(reaisNum);
    if (reaisNum === 0 && centavosNum === 0) reaisText = "zero"; 
    else if (reaisNum === 0) reaisText = ""; 
    else reaisText += reaisNum === 1 ? " real" : " reais"; 

    let centavosText = "";
    if (centavosNum > 0) {
        centavosText = getWordsPart(centavosNum);
        centavosText += centavosNum === 1 ? " centavo" : " centavos";
    }
    
    if (reaisNum > 0 && centavosNum > 0) {
        return `${reaisText} e ${centavosText}`;
    } else if (centavosNum > 0) {
        return centavosText;
    } else if (reaisNum > 0) {
        return reaisText;
    } else {
        return "zero reais"; 
    }
}