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
    dailyValue: 8.60,          
    fixedBonusAmount: 200.00, 
    monthlyAllowance: 1100.00 
};

/**
 * Lista Completa de Feriados (2025-2030)
 * Atualizado com Recesso Escolar em 16/02/2026
 */
export const HOLIDAYS_DB = [
    // --- 2025 ---
    {date: "2025-01-01", name: "Confraternização Universal"},
    {date: "2025-03-03", name: "Carnaval"},
    {date: "2025-03-04", name: "Carnaval"},
    {date: "2025-04-18", name: "Sexta-feira Santa"},
    {date: "2025-04-21", name: "Tiradentes"},
    {date: "2025-05-01", name: "Dia do Trabalhador"},
    {date: "2025-05-24", name: "Nossa Senhora Auxiliadora (Padroeira de Goiânia)"},
    {date: "2025-06-19", name: "Corpus Christi"},
    {date: "2025-09-07", name: "Independência do Brasil"},
    {date: "2025-10-12", name: "Nossa Senhora Aparecida"},
    {date: "2025-10-24", name: "Aniversário de Goiânia"},
    {date: "2025-11-02", name: "Finados"},
    {date: "2025-11-15", name: "Proclamação da República"},
    {date: "2025-11-20", name: "Dia da Consciência Negra"},
    {date: "2025-12-25", name: "Natal"},

    // --- 2026 ---
    {date: "2026-01-01", name: "Confraternização Universal"},
    {date: "2026-02-16", name: "Recesso Escolar"}, // ADICIONADO
    {date: "2026-02-17", name: "Carnaval"}, 
    {date: "2026-04-03", name: "Sexta-feira Santa"}, 
    {date: "2026-04-21", name: "Tiradentes"},
    {date: "2026-05-01", name: "Dia do Trabalhador"},
    {date: "2026-05-24", name: "Nossa Senhora Auxiliadora"},
    {date: "2026-06-04", name: "Corpus Christi"},
    {date: "2026-09-07", name: "Independência do Brasil"},
    {date: "2026-10-12", name: "Nossa Senhora Aparecida"},
    {date: "2026-10-24", name: "Aniversário de Goiânia"},
    {date: "2026-11-02", name: "Finados"},
    {date: "2026-11-15", name: "Proclamação da República"},
    {date: "2026-11-20", name: "Dia da Consciência Negra"},
    {date: "2026-12-25", name: "Natal"},

    // --- 2027 ---
    {date: "2027-01-01", name: "Confraternização Universal"},
    {date: "2027-02-09", name: "Carnaval"}, 
    {date: "2027-03-26", name: "Sexta-feira Santa"}, 
    {date: "2027-04-21", name: "Tiradentes"},
    {date: "2027-05-01", name: "Dia do Trabalhador"},
    {date: "2027-05-24", name: "Nossa Senhora Auxiliadora"},
    {date: "2027-05-27", name: "Corpus Christi"},
    {date: "2027-09-07", name: "Independência do Brasil"},
    {date: "2027-10-12", name: "Nossa Senhora Aparecida"},
    {date: "2027-10-24", name: "Aniversário de Goiânia"},
    {date: "2027-11-02", name: "Finados"},
    {date: "2027-11-15", name: "Proclamação da República"},
    {date: "2027-11-20", name: "Dia da Consciência Negra"},
    {date: "2027-12-25", name: "Natal"},

    // --- 2028 ---
    {date: "2028-01-01", name: "Confraternização Universal"},
    {date: "2028-02-29", name: "Carnaval"}, 
    {date: "2028-04-14", name: "Sexta-feira Santa"}, 
    {date: "2028-04-21", name: "Tiradentes"},
    {date: "2028-05-01", name: "Dia do Trabalhador"},
    {date: "2028-05-24", name: "Nossa Senhora Auxiliadora"},
    {date: "2028-06-15", name: "Corpus Christi"},
    {date: "2028-09-07", name: "Independência do Brasil"},
    {date: "2028-10-12", name: "Nossa Senhora Aparecida"},
    {date: "2028-10-24", name: "Aniversário de Goiânia"},
    {date: "2028-11-02", name: "Finados"},
    {date: "2028-11-15", name: "Proclamação da República"},
    {date: "2028-11-20", name: "Dia da Consciência Negra"},
    {date: "2028-12-25", name: "Natal"},

    // --- 2029 ---
    {date: "2029-01-01", name: "Confraternização Universal"},
    {date: "2029-02-13", name: "Carnaval"}, 
    {date: "2029-03-30", name: "Sexta-feira Santa"}, 
    {date: "2029-04-21", name: "Tiradentes"},
    {date: "2029-05-01", name: "Dia do Trabalhador"},
    {date: "2029-05-24", name: "Nossa Senhora Auxiliadora"},
    {date: "2029-05-31", name: "Corpus Christi"},
    {date: "2029-09-07", name: "Independência do Brasil"},
    {date: "2029-10-12", name: "Nossa Senhora Aparecida"},
    {date: "2029-10-24", name: "Aniversário de Goiânia"},
    {date: "2029-11-02", name: "Finados"},
    {date: "2029-11-15", name: "Proclamação da República"},
    {date: "2029-11-20", name: "Dia da Consciência Negra"},
    {date: "2029-12-25", name: "Natal"},

    // --- 2030 ---
    {date: "2030-01-01", name: "Confraternização Universal"},
    {date: "2030-03-05", name: "Carnaval"}, 
    {date: "2030-04-19", name: "Sexta-feira Santa"}, 
    {date: "2030-04-21", name: "Tiradentes"}, 
    {date: "2030-05-01", name: "Dia do Trabalhador"},
    {date: "2030-05-24", name: "Nossa Senhora Auxiliadora"},
    {date: "2030-06-20", name: "Corpus Christi"},
    {date: "2030-09-07", name: "Independência do Brasil"},
    {date: "2030-10-12", name: "Nossa Senhora Aparecida"},
    {date: "2030-10-24", name: "Aniversário de Goiânia"},
    {date: "2030-11-02", name: "Finados"},
    {date: "2030-11-15", name: "Proclamação da República"},
    {date: "2030-11-20", name: "Dia da Consciência Negra"},
    {date: "2030-12-25", name: "Natal"}
];

export function calculateWorkingDays(startDate, endDate, absencesSet, certificatesSet) {
    let effectiveDays = 0;
    let absenceCount = 0;
    let certificateCount = 0;
    let holidaysFound = [];

    const start = new Date(startDate);
    const end = new Date(endDate);
    const currentDate = new Date(start);

    while (currentDate <= end) {
        const dayOfWeek = currentDate.getDay();
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6); 
        
        const isoDateString = currentDate.toISOString().split('T')[0];
        const holiday = HOLIDAYS_DB.find(h => h.date === isoDateString);
        const isHoliday = holiday !== undefined;

        const isAbsenceDay = absencesSet.has(isoDateString);
        const isCertificateDay = certificatesSet.has(isoDateString);

        if (!isWeekend && !isHoliday) {
            if (!isAbsenceDay && !isCertificateDay) {
                effectiveDays++;
            } else {
                if (isAbsenceDay) absenceCount++;
                if (isCertificateDay) certificateCount++;
            }
        } else if (isHoliday) {
            holidaysFound.push(holiday);
        }

        currentDate.setDate(currentDate.getDate() + 1);
    }

    return { 
        effectiveDays, 
        absenceCount, 
        certificateCount, 
        holidaysInPeriod: holidaysFound 
    };
}

export function getMarkedDatesInSpecificMonth(globalMarkedDatesSet, year, monthIndex) {
    const startOfMonth = new Date(year, monthIndex, 1);
    const endOfMonth = new Date(year, monthIndex + 1, 0);
    
    const filteredDates = Array.from(globalMarkedDatesSet).filter(dateString => {
        const date = new Date(dateString + 'T00:00:00'); 
        return date >= startOfMonth && date <= endOfMonth;
    });
    
    return new Set(filteredDates);
}
