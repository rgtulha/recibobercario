/**
 * js/business.js
 * Regras de negócio, constantes de configuração e cálculos de datas.
 */

// Configuração fixa do Emissor e Valores
export const RECEIPT_CONFIG = {
    payer: "BERÇÁRIO E ESCOLA CRESCER FELIZ LTDA",
    cnpj: "32.741.557/0001-70",
    description: "REFERENTE AO VALE TRANSPORTE",
    location: "Goiânia",
    // Valores monetários base
    dailyValue: 8.60,         // Valor diário do vale transporte
    fixedBonusAmount: 200.00, // Valor fixo da bonificação
    monthlyAllowance: 1100.00 // Valor fixo mensal da bolsa de estágio
};

// Lista de Feriados de 2025
export const HOLIDAYS_2025 = [ 
    {date: "2025-01-01", name: "Confraternização Universal"},
    {date: "2025-03-03", name: "Carnaval (Ponto Facultativo)"},
    {date: "2025-03-04", name: "Carnaval (Ponto Facultativo)"},
    {date: "2025-04-18", name: "Paixão de Cristo"},
    {date: "2025-04-21", name: "Tiradentes"},
    {date: "2025-05-01", name: "Dia do Trabalho"},
    {date: "2025-06-19", name: "Corpus Christi (Ponto Facultativo)"},
    {date: "2025-09-07", name: "Independência do Brasil"},
    {date: "2025-10-12", name: "Nossa Senhora Aparecida"},
    {date: "2025-10-24", name: "Aniversário de Goiânia"}, 
    {date: "2025-11-02", name: "Finados"},
    {date: "2025-11-15", name: "Proclamação da República"},
    {date: "2025-11-20", name: "Consciência Negra"},
    {date: "2025-12-25", name: "Natal"}
];

/**
 * Calcula os dias úteis efetivos dentro de um período, descontando feriados e finais de semana.
 * Também contabiliza as faltas e atestados que caem em dias úteis.
 * * @param {Date|string} startDate - Data de início.
 * @param {Date|string} endDate - Data de fim.
 * @param {Set<string>} absencesSet - Set contendo strings (YYYY-MM-DD) de dias de falta.
 * @param {Set<string>} certificatesSet - Set contendo strings (YYYY-MM-DD) de dias de atestado.
 * @returns {Object} { effectiveDays, absenceCount, certificateCount, holidaysFound }
 */
export function calculateWorkingDays(startDate, endDate, absencesSet, certificatesSet) {
    let effectiveDays = 0;
    let absenceCount = 0;
    let certificateCount = 0;
    let holidaysFound = [];

    // Normaliza para objetos Date para garantir a iteração correta
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Iterador começa no dia de início
    const currentDate = new Date(start);

    // Loop dia a dia
    while (currentDate <= end) {
        const dayOfWeek = currentDate.getDay();
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6); // 0 = Dom, 6 = Sáb
        
        const isoDateString = currentDate.toISOString().split('T')[0];
        const holiday = HOLIDAYS_2025.find(h => h.date === isoDateString);
        const isHoliday = holiday !== undefined;

        // Verifica marcações nos Sets
        const isAbsenceDay = absencesSet.has(isoDateString);
        const isCertificateDay = certificatesSet.has(isoDateString);

        if (!isWeekend && !isHoliday) {
            // É um dia útil potencial
            if (!isAbsenceDay && !isCertificateDay) {
                effectiveDays++;
            } else {
                if (isAbsenceDay) absenceCount++;
                if (isCertificateDay) certificateCount++;
            }
        } else if (isHoliday) {
            holidaysFound.push(holiday);
        }

        // Avança para o próximo dia
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return { 
        effectiveDays, 
        absenceCount, 
        certificateCount, 
        holidaysInPeriod: holidaysFound 
    };
}

/**
 * Filtra um conjunto global de datas marcadas para encontrar apenas aquelas que pertencem
 * a um mês e ano específicos. Útil para lógica de Vale Transporte (mês anterior).
 * * @param {Set<string>} globalMarkedDatesSet - Set com todas as datas marcadas.
 * @param {number} year - Ano (ex: 2025).
 * @param {number} monthIndex - Índice do mês (0 = Janeiro, 11 = Dezembro).
 * @returns {Set<string>} Novo Set contendo apenas as datas do mês solicitado.
 */
export function getMarkedDatesInSpecificMonth(globalMarkedDatesSet, year, monthIndex) {
    const startOfMonth = new Date(year, monthIndex, 1);
    const endOfMonth = new Date(year, monthIndex + 1, 0);
    
    const filteredDates = Array.from(globalMarkedDatesSet).filter(dateString => {
        // Adiciona T00:00:00 para evitar problemas de timezone ao converter string para Date
        const date = new Date(dateString + 'T00:00:00'); 
        return date >= startOfMonth && date <= endOfMonth;
    });
    
    return new Set(filteredDates);
}