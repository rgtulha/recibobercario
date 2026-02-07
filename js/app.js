import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getFirestore, collection, query, onSnapshot, doc, setDoc, deleteDoc, getDocs } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

import { formatCurrency, formatDate, getCurrentDateFormatted, capitalizeWords, numberToWords } from './utils.js';
import { RECEIPT_CONFIG, HOLIDAYS_DB, calculateWorkingDays, getMarkedDatesInSpecificMonth } from './business.js';

const AppState = {
    user: { id: null, isAuthenticated: false },
    employees: [],
    ui: {
        filterText: '',
        calendarMonth: new Date().getMonth(),
        calendarYear: new Date().getFullYear(),
        currentMarkType: 'absence'
    },
    selection: {
        employee: null,
        receiptType: 'valeTransporte',
        startDate: '',
        endDate: '',
        internPeriod: 'matutino',
        absences: new Set(),
        certificates: new Set()
    }
};

const DOM = {};

// --- INICIALIZAÇÃO ROBUSTA ---
async function init() {
    console.log("Iniciando Aplicação...");
    cacheDOM();
    setupEventListeners();

    // 1. Define datas padrão (Hoje)
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    
    // Formata para YYYY-MM-DD
    const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
    const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0];

    // 2. Preenche os Inputs Visuais
    if (DOM.startDate) DOM.startDate.value = firstDay;
    if (DOM.endDate) DOM.endDate.value = lastDay;

    // 3. Força a atualização do Estado (AppState) IMEDIATAMENTE
    AppState.selection.startDate = firstDay;
    AppState.selection.endDate = lastDay;
    AppState.selection.receiptType = 'valeTransporte';

    // 4. Renderiza o Calendário AGORA (Sem esperar nada)
    updateCalendarContext(); 
    updateReceiptPreview();

    // 5. Só depois conecta ao banco
    await initFirebase();
}

function cacheDOM() {
    const ids = [
        'employeeList', 'searchInput', 'welcome-message', 'receipt-content',
        'startDate', 'endDate', 'workingDaysInfo', 'calculateDaysButton', 
        'holidaysInPeriod', 'calculateDaysButtonContainer', 'periodInfoContainer',
        'confirmationModal', 'modalEmployeeName', 'confirmButton', 'cancelButton',
        'receiptTypeSelection', 'internPeriodContainer', 'internPeriod',
        'receipt-title', 'receipt-date-top', 'calendar', 'currentMonthYear',
        'prevMonth', 'nextMonth', 'clearMarkingButton', 'generateReceiptButton',
        'messageModal', 'messageModalTitle', 'messageModalContent', 'messageModalCloseButton',
        'newEmployeeName', 'newEmployeeCpf', 'addEmployeeButton',
        'exportEmployeesButton', 'importEmployeesButton', 'importEmployeesFile',
        'deleteConfirmationModal', 'deleteEmployeeName', 'cancelDeleteButton', 'confirmDeleteButton',
        'receipt-total', 'receipt-payer', 'receipt-cnpj', 'employee-name', 'employee-cpf',
        'receipt-period-info', 'receipt-daily-value', 'receipt-holidays-info',
        'receipt-total-words-label', 'receipt-total-words', 'employee-signature-name', 'receipt-description'
    ];

    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) DOM[id] = el;
    });

    DOM.receiptTypeRadios = document.querySelectorAll('input[name="receiptType"]');
    DOM.markTypeRadios = document.querySelectorAll('input[name="markType"]');
}

// --- FIREBASE CONFIGURATION (ATUALIZADO) ---
let db, auth;
// Mantive o appId genérico caso não venha de variável externa
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

const firebaseConfig = {
    apiKey: "AIzaSyDWt4fgnCiHECnOF-lNMsvtc1Cwe1SmYXc",
    authDomain: "controlevenda-ef7db.firebaseapp.com",
    projectId: "controlevenda-ef7db",
    storageBucket: "controlevenda-ef7db.firebasestorage.app",
    messagingSenderId: "468868061475",
    appId: "1:468868061475:web:dc4bfbf02eeae989a61496"
};

async function initFirebase() {
    try {
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);

        const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
        if (initialAuthToken) await signInWithCustomToken(auth, initialAuthToken);
        else await signInAnonymously(auth);

        onAuthStateChanged(auth, (user) => {
            if (user) {
                AppState.user.id = user.uid;
                AppState.user.isAuthenticated = true;
                setupFirestoreListeners();
            } else {
                AppState.user.isAuthenticated = false;
            }
        });
    } catch (error) {
        console.error("Firebase Error:", error);
        showModal("Erro de Conexão", "Verifique sua internet ou as configurações do Firebase.");
    }
}

function setupFirestoreListeners() {
    // Atenção: Como mudou o projeto, o banco estará vazio inicialmente.
    // O caminho continua sendo artifacts/default-app-id/public/data/employees
    const employeesRef = collection(db, `artifacts/${appId}/public/data/employees`);
    const q = query(employeesRef);
    onSnapshot(q, (snapshot) => {
        AppState.employees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        AppState.employees.sort((a, b) => a.nome.localeCompare(b.nome));
        renderEmployeeList();
    });
}

// --- EVENTOS ---
function setupEventListeners() {
    DOM.searchInput?.addEventListener('keyup', (e) => {
        AppState.ui.filterText = e.target.value;
        renderEmployeeList();
    });

    const updateDates = () => {
        AppState.selection.startDate = DOM.startDate.value;
        AppState.selection.endDate = DOM.endDate.value;
        AppState.selection.absences.clear();
        AppState.selection.certificates.clear();
        updateCalendarContext(); 
        updateReceiptPreview();
    };
    DOM.startDate?.addEventListener('change', updateDates);
    DOM.endDate?.addEventListener('change', updateDates);

    DOM.receiptTypeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            AppState.selection.receiptType = e.target.value;
            toggleReceiptTypeFields();
            updateCalendarContext();
            updateReceiptPreview();
        });
    });

    DOM.prevMonth?.addEventListener('click', () => changeCalendarMonth(-1));
    DOM.nextMonth?.addEventListener('click', () => changeCalendarMonth(1));
    DOM.markTypeRadios.forEach(radio => radio.addEventListener('change', (e) => AppState.ui.currentMarkType = e.target.value));
    
    DOM.clearMarkingButton?.addEventListener('click', () => {
        AppState.selection.absences.clear();
        AppState.selection.certificates.clear();
        renderCalendar();
        updateReceiptPreview();
    });

    DOM.addEmployeeButton?.addEventListener('click', handleAddEmployee);
    DOM.confirmDeleteButton?.addEventListener('click', handleDeleteEmployee);
    
    DOM.exportEmployeesButton?.addEventListener('click', handleExport);
    DOM.importEmployeesButton?.addEventListener('click', () => DOM.importEmployeesFile.click());
    DOM.importEmployeesFile?.addEventListener('change', handleImport);

    DOM.generateReceiptButton?.addEventListener('click', () => {
        if (!AppState.selection.employee) return showModal("Atenção", "Selecione uma funcionária.");
        updateReceiptPreview();
        DOM.modalEmployeeName.textContent = `Gerar recibo para ${capitalizeWords(AppState.selection.employee.nome)}?`;
        DOM.confirmationModal.classList.remove('hidden');
    });
    
    DOM.confirmButton?.addEventListener('click', () => {
        DOM.confirmationModal.classList.add('hidden');
        DOM['welcome-message'].classList.add('hidden');
        DOM['receipt-content'].classList.remove('hidden');
        window.print();
    });
    DOM.cancelButton?.addEventListener('click', () => DOM.confirmationModal.classList.add('hidden'));
    DOM.cancelDeleteButton?.addEventListener('click', () => DOM.deleteConfirmationModal.classList.add('hidden'));
    DOM.messageModalCloseButton?.addEventListener('click', () => DOM.messageModal.classList.add('hidden'));
}

function handleInputChanges() {
    if(DOM.startDate?.value) AppState.selection.startDate = DOM.startDate.value;
    if(DOM.endDate?.value) AppState.selection.endDate = DOM.endDate.value;
    
    const checkedRadio = document.querySelector('input[name="receiptType"]:checked');
    if(checkedRadio) AppState.selection.receiptType = checkedRadio.value;
    
    toggleReceiptTypeFields();
}

function toggleReceiptTypeFields() {
    const type = AppState.selection.receiptType;
    if (type === 'salarioEstagiario') DOM.internPeriodContainer?.classList.remove('hidden');
    else DOM.internPeriodContainer?.classList.add('hidden');

    if (['valeTransporte', 'salarioEstagiario', 'bonificacao'].includes(type)) {
        DOM.calculateDaysButtonContainer?.classList.add('hidden');
        DOM.periodInfoContainer?.classList.add('hidden');
    } else {
        DOM.calculateDaysButtonContainer?.classList.remove('hidden');
        DOM.periodInfoContainer?.classList.remove('hidden');
    }
}

// --- RENDERIZAÇÃO DE LISTA ---
function renderEmployeeList() {
    if (!DOM.employeeList) return;
    DOM.employeeList.innerHTML = '';
    
    const filter = AppState.ui.filterText.toLowerCase();
    const filtered = AppState.employees.filter(emp => emp.nome.toLowerCase().includes(filter));

    if (filtered.length === 0) {
        DOM.employeeList.innerHTML = `<p class="text-stone-500 p-4 text-center">Nenhuma funcionária encontrada.</p>`;
        return;
    }

    filtered.forEach(emp => {
        const div = document.createElement('div');
        div.className = `p-3 mb-2 rounded-lg cursor-pointer hover:bg-teal-50 border-b border-stone-200 employee-item flex justify-between items-center ${AppState.selection.employee?.id === emp.id ? 'selected bg-teal-100 font-bold border-teal-500' : ''}`;
        
        div.innerHTML = `
            <span>${capitalizeWords(emp.nome)}</span>
            <button class="text-red-500 hover:text-red-700 ml-2 delete-btn">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>
            </button>
        `;

        div.addEventListener('click', (e) => {
            if (e.target.closest('.delete-btn')) return;
            AppState.selection.employee = emp;
            renderEmployeeList();
            showModal("Funcionária Selecionada", capitalizeWords(emp.nome));
            DOM['welcome-message'].classList.remove('hidden');
            DOM['receipt-content'].classList.add('hidden');
            updateReceiptPreview();
        });

        div.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            AppState.employeeToDelete = emp.id;
            DOM.deleteEmployeeName.textContent = capitalizeWords(emp.nome);
            DOM.deleteConfirmationModal.classList.remove('hidden');
        });

        DOM.employeeList.appendChild(div);
    });
}

// --- CALENDÁRIO ---
function updateCalendarContext() {
    let start;
    
    // Fallback para Hoje se o input estiver vazio
    if (AppState.selection.startDate) {
        start = new Date(AppState.selection.startDate + 'T00:00:00');
    } else {
        start = new Date(); // Data atual como segurança
    }

    // Regra: VT = mês anterior, Outros = mês selecionado
    if (AppState.selection.receiptType === 'valeTransporte') {
        AppState.ui.calendarMonth = start.getMonth() - 1;
        AppState.ui.calendarYear = start.getFullYear();
        if (AppState.ui.calendarMonth < 0) {
            AppState.ui.calendarMonth = 11;
            AppState.ui.calendarYear--;
        }
    } else {
        AppState.ui.calendarMonth = start.getMonth();
        AppState.ui.calendarYear = start.getFullYear();
    }
    
    renderCalendar();
}

function changeCalendarMonth(delta) {
    AppState.ui.calendarMonth += delta;
    if (AppState.ui.calendarMonth > 11) {
        AppState.ui.calendarMonth = 0;
        AppState.ui.calendarYear++;
    } else if (AppState.ui.calendarMonth < 0) {
        AppState.ui.calendarMonth = 11;
        AppState.ui.calendarYear--;
    }
    renderCalendar();
}

function renderCalendar() {
    if (!DOM.calendar) {
        console.error("DOM Element #calendar não encontrado!");
        return;
    }
    DOM.calendar.innerHTML = ''; // Limpa tudo
    
    const year = AppState.ui.calendarYear;
    const month = AppState.ui.calendarMonth;
    
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    if (DOM.currentMonthYear) DOM.currentMonthYear.textContent = `${monthNames[month]} ${year}`;

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const startDayOfWeek = firstDayOfMonth.getDay();

    // Dias da Semana
    ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].forEach(d => {
        const el = document.createElement('div');
        el.className = 'calendar-day header';
        el.textContent = d;
        DOM.calendar.appendChild(el);
    });

    // Padding (dias vazios)
    for (let i = 0; i < startDayOfWeek; i++) {
        const el = document.createElement('div');
        el.className = 'calendar-day other-month disabled-for-marking';
        DOM.calendar.appendChild(el);
    }

    // Dias Reais
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const isoDate = date.toISOString().split('T')[0];
        
        const el = document.createElement('div');
        el.className = 'calendar-day current-month';
        el.textContent = day;
        
        if (HOLIDAYS_DB.some(h => h.date === isoDate)) el.classList.add('holiday');
        if (AppState.selection.absences.has(isoDate)) el.classList.add('selected-absence');
        if (AppState.selection.certificates.has(isoDate)) el.classList.add('selected-certificate');
        
        const todayIso = new Date().toISOString().split('T')[0];
        if (isoDate === todayIso) el.classList.add('today');

        el.addEventListener('click', () => toggleDateSelection(isoDate, el));
        DOM.calendar.appendChild(el);
    }
}

function toggleDateSelection(isoDate, el) {
    const type = AppState.ui.currentMarkType;
    const abs = AppState.selection.absences;
    const cert = AppState.selection.certificates;

    if (type === 'absence') {
        if (abs.has(isoDate)) {
            abs.delete(isoDate);
            el.classList.remove('selected-absence');
        } else {
            abs.add(isoDate);
            cert.delete(isoDate);
            el.classList.add('selected-absence');
            el.classList.remove('selected-certificate');
        }
    } else {
        if (cert.has(isoDate)) {
            cert.delete(isoDate);
            el.classList.remove('selected-certificate');
        } else {
            cert.add(isoDate);
            abs.delete(isoDate);
            el.classList.add('selected-certificate');
            el.classList.remove('selected-absence');
        }
    }
    updateReceiptPreview();
}

// --- RECIBO ---
function updateReceiptPreview() {
    if (!AppState.selection.employee) return;
    
    if(DOM['receipt-date-top']) DOM['receipt-date-top'].textContent = getCurrentDateFormatted();
    if(DOM['employee-name']) DOM['employee-name'].textContent = capitalizeWords(AppState.selection.employee.nome);
    if(DOM['employee-cpf']) DOM['employee-cpf'].textContent = AppState.selection.employee.cpf;
    if(DOM['employee-signature-name']) DOM['employee-signature-name'].textContent = capitalizeWords(AppState.selection.employee.nome);
    if(DOM['receipt-payer']) DOM['receipt-payer'].textContent = RECEIPT_CONFIG.payer;
    if(DOM['receipt-cnpj']) DOM['receipt-cnpj'].textContent = `CNPJ: ${RECEIPT_CONFIG.cnpj}`;

    const type = AppState.selection.receiptType;
    let start = AppState.selection.startDate;
    let end = AppState.selection.endDate;

    if (!start || !end) {
        start = new Date().toISOString().split('T')[0];
        end = start;
    }

    const calculations = calculateWorkingDays(start, end, AppState.selection.absences, AppState.selection.certificates);
    
    // --- NOVO: Linha de Período ---
    // Cria a string do período: "Período: DD/MM/AAAA até DD/MM/AAAA"
    const periodString = `<strong>Período:</strong> ${formatDate(start)} até ${formatDate(end)}<br>`;

    let totalValue = 0;
    let descriptionText = '';
    let detailsHtml = '';

    if (type === 'valeTransporte') {
        DOM['receipt-title'].textContent = "Recibo de Vale Transporte";
        
        const totalBusinessDays = calculations.effectiveDays + calculations.absenceCount + calculations.certificateCount; 
        
        const prevMonthAbsences = AppState.selection.absences.size; 
        const prevMonthCerts = AppState.selection.certificates.size;

        const effectiveDaysForVT = totalBusinessDays - (prevMonthAbsences + prevMonthCerts);
        totalValue = effectiveDaysForVT * RECEIPT_CONFIG.dailyValue;
        if(totalValue < 0) totalValue = 0; 

        descriptionText = "REFERENTE AO VALE TRANSPORTE";
        
        // Inserimos o periodString no início
        detailsHtml = `
            ${periodString}
            <strong>Valor Diário:</strong> ${formatCurrency(RECEIPT_CONFIG.dailyValue)}<br>
            <strong>Dias Úteis no Período:</strong> ${totalBusinessDays}<br>
            <span class="text-red-600">Descontos (Mês Anterior): ${prevMonthAbsences + prevMonthCerts} dias</span>
        `;
    } 
    else if (type === 'salarioEstagiario') {
        DOM['receipt-title'].textContent = "Recibo Bolsa Estágio";
        descriptionText = `REFERENTE À BOLSA ESTÁGIO (${AppState.selection.internPeriod === 'matutino' ? 'Matutino' : 'Vespertino'})`;
        
        const dailyAllowance = RECEIPT_CONFIG.monthlyAllowance / 30;
        const discount = calculations.absenceCount * dailyAllowance;
        totalValue = RECEIPT_CONFIG.monthlyAllowance - discount;
        if(totalValue < 0) totalValue = 0;

        // Inserimos o periodString no início
        detailsHtml = `
            ${periodString}
            <strong>Valor Mensal:</strong> ${formatCurrency(RECEIPT_CONFIG.monthlyAllowance)}<br>
            <span class="text-red-600">Faltas descontadas: ${calculations.absenceCount} dias</span>
        `;
    }
    else if (type === 'bonificacao') {
        DOM['receipt-title'].textContent = "Recibo de Bonificação";
        descriptionText = "REFERENTE À BONIFICAÇÃO";
        
        if (calculations.absenceCount > 0 || calculations.certificateCount > 0) {
            totalValue = 0;
            // Inserimos o periodString mesmo em caso de cancelamento
            detailsHtml = `${periodString}<span class="text-red-600 font-bold">Bonificação cancelada devido a faltas/atestados.</span>`;
        } else {
            totalValue = RECEIPT_CONFIG.fixedBonusAmount;
            // Inserimos o periodString no início
            detailsHtml = `${periodString}<strong>Valor Integral:</strong> ${formatCurrency(totalValue)}`;
        }
    }

    if(DOM['receipt-total']) DOM['receipt-total'].textContent = formatCurrency(totalValue);
    if(DOM['receipt-total-words']) DOM['receipt-total-words'].textContent = numberToWords(totalValue);
    if(DOM['receipt-description']) DOM['receipt-description'].textContent = descriptionText;
    if(DOM['receipt-period-info']) DOM['receipt-period-info'].innerHTML = detailsHtml; 
    
    if(DOM['receipt-holidays-info']) {
        DOM['receipt-holidays-info'].innerHTML = calculations.holidaysInPeriod.length > 0 
            ? `Feriados:<br>${calculations.holidaysInPeriod.map(h => `${formatDate(h.date)} - ${h.name}`).join('<br>')}` 
            : '';
    }
}

// --- MODAIS E CRUD ---
async function handleAddEmployee() {
    const nome = DOM.newEmployeeName.value.trim();
    const cpf = DOM.newEmployeeCpf.value.trim();
    
    if (!nome || !cpf) return showModal("Erro", "Preencha todos os campos.");
    
    try {
        const cleanCpf = cpf.replace(/\D/g, '');
        // Usando o path completo incluindo o appId (mesmo que seja default)
        await setDoc(doc(db, `artifacts/${appId}/public/data/employees`, cleanCpf), { 
            nome: capitalizeWords(nome), 
            cpf: cpf 
        });
        showModal("Sucesso", "Funcionária adicionada.");
        DOM.newEmployeeName.value = '';
        DOM.newEmployeeCpf.value = '';
    } catch (e) {
        console.error(e);
        showModal("Erro", "Falha ao salvar.");
    }
}

async function handleDeleteEmployee() {
    if (!AppState.employeeToDelete) return;
    try {
        await deleteDoc(doc(db, `artifacts/${appId}/public/data/employees`, AppState.employeeToDelete));
        DOM.deleteConfirmationModal.classList.add('hidden');
        if (AppState.selection.employee?.id === AppState.employeeToDelete) {
            AppState.selection.employee = null;
            DOM['welcome-message'].classList.remove('hidden');
            DOM['receipt-content'].classList.add('hidden');
        }
    } catch (e) {
        showModal("Erro", "Falha ao excluir.");
    }
}

function handleExport() {
    let content = "Nome,CPF\n";
    AppState.employees.forEach(e => content += `${e.nome},${e.cpf}\n`);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'funcionarias.txt';
    link.click();
}

function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
        const lines = ev.target.result.split('\n');
        let importedCount = 0;

        for (let line of lines) {
            // Ignora linhas vazias
            if (!line.trim()) continue;

            // Divide pelo primeiro separador encontrado (vírgula)
            const parts = line.split(',');
            
            // Verifica se tem pelo menos Nome e CPF
            if (parts.length >= 2) {
                const nome = parts[0].trim();
                const rawCpf = parts[1].trim();
                
                // Remove tudo que não for número do CPF para validar
                const cleanCpf = rawCpf.replace(/\D/g, '');

                // Validação mais flexível: Aceita se tiver 11 dígitos (com ou sem ponto)
                if (nome && cleanCpf.length === 11) {
                    
                    // Formata o CPF para o padrão XXX.XXX.XXX-XX antes de salvar
                    const formattedCpf = cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');

                    await setDoc(doc(db, `artifacts/${appId}/public/data/employees`, cleanCpf), { 
                        nome: capitalizeWords(nome), 
                        cpf: formattedCpf 
                    });
                    
                    importedCount++;
                } else {
                    console.warn(`Linha ignorada (dados inválidos): ${line}`);
                }
            }
        }
        showModal("Importação Concluída", `${importedCount} funcionárias foram importadas com sucesso.`);
    };
    reader.readAsText(file);
}

window.addEventListener('DOMContentLoaded', init);

