import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, query, onSnapshot, doc, setDoc, deleteDoc, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Importações dos nossos módulos
import { formatCurrency, formatDate, getCurrentDateFormatted, capitalizeWords, numberToWords } from './utils.js';
import { RECEIPT_CONFIG, HOLIDAYS_DB, calculateWorkingDays, getMarkedDatesInSpecificMonth } from './business.js';

const AppState = {
    user: {
        id: null,
        isAuthenticated: false
    },
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

async function init() {
    console.log("Iniciando Aplicação...");
    cacheDOM();
    setupEventListeners();
    await initFirebase();
    
    // Configura datas iniciais (Mês atual completo)
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
    
    if(DOM.startDate) DOM.startDate.value = firstDay;
    if(DOM.endDate) DOM.endDate.value = lastDay;
    
    // Atualiza o estado com os valores dos inputs
    handleInputChanges(); 
    
    // CORREÇÃO: Força a renderização inicial do calendário e do recibo
    updateCalendarContext(); 
    updateReceiptPreview();
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

let db, auth;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
    apiKey: "AIzaSyAFbb0gWQ51vF92rN-Vis39FHqRAWbzhKE", 
    authDomain: "funcionarias-503a4.firebaseapp.com",
    projectId: "funcionarias-503a4",
    storageBucket: "funcionarias-503a4.firebasestorage.app",
    messagingSenderId: "486757099128",
    appId: "1:486757099128:web:e4d8c17b61e20d8e2cef8d"
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
        showModal("Erro Crítico", "Falha ao conectar ao banco de dados.");
    }
}

function setupFirestoreListeners() {
    const employeesRef = collection(db, `artifacts/${appId}/public/data/employees`);
    const q = query(employeesRef);

    onSnapshot(q, (snapshot) => {
        AppState.employees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        AppState.employees.sort((a, b) => a.nome.localeCompare(b.nome));
        renderEmployeeList();
    });
}

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
        updateCalendarContext(); // Isso chama o renderCalendar
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
    AppState.selection.startDate = DOM.startDate?.value;
    AppState.selection.endDate = DOM.endDate?.value;
    AppState.selection.receiptType = document.querySelector('input[name="receiptType"]:checked')?.value || 'valeTransporte';
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

function updateCalendarContext() {
    if (!AppState.selection.startDate) return;

    const start = new Date(AppState.selection.startDate + 'T00:00:00');
    
    // Regra de visualização do calendário:
    // VT = mostra o mês anterior
    // Outros = mostra o mês atual/selecionado
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
    if (!DOM.calendar) return;
    DOM.calendar.innerHTML = '';
    
    const year = AppState.ui.calendarYear;
    const month = AppState.ui.calendarMonth;
    
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    DOM.currentMonthYear.textContent = `${monthNames[month]} ${year}`;

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const startDayOfWeek = firstDayOfMonth.getDay();

    ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].forEach(d => {
        const el = document.createElement('div');
        el.className = 'calendar-day header';
        el.textContent = d;
        DOM.calendar.appendChild(el);
    });

    for (let i = 0; i < startDayOfWeek; i++) {
        const el = document.createElement('div');
        el.className = 'calendar-day other-month disabled-for-marking';
        DOM.calendar.appendChild(el);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const isoDate = date.toISOString().split('T')[0];
        
        const el = document.createElement('div');
        el.className = 'calendar-day current-month';
        el.textContent = day;
        
        if (HOLIDAYS_DB.some(h => h.date === isoDate)) el.classList.add('holiday');
        if (AppState.selection.absences.has(isoDate)) el.classList.add('selected-absence');
        if (AppState.selection.certificates.has(isoDate)) el.classList.add('selected-certificate');
        if (isoDate === new Date().toISOString().split('T')[0]) el.classList.add('today');

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

function updateReceiptPreview() {
    if (!AppState.selection.employee) return;
    
    DOM['receipt-date-top'].textContent = getCurrentDateFormatted();
    DOM['employee-name'].textContent = capitalizeWords(AppState.selection.employee.nome);
    DOM['employee-cpf'].textContent = AppState.selection.employee.cpf;
    DOM['employee-signature-name'].textContent = capitalizeWords(AppState.selection.employee.nome);
    DOM['receipt-payer'].textContent = RECEIPT_CONFIG.payer;
    DOM['receipt-cnpj'].textContent = `CNPJ: ${RECEIPT_CONFIG.cnpj}`;

    const type = AppState.selection.receiptType;
    const start = AppState.selection.startDate;
    const end = AppState.selection.endDate;

    if (!start || !end) return;

    const calculations = calculateWorkingDays(start, end, AppState.selection.absences, AppState.selection.certificates);
    
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

        descriptionText = "REFERENTE AO VALE TRANSPORTE";
        detailsHtml = `
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

        detailsHtml = `
            <strong>Valor Mensal:</strong> ${formatCurrency(RECEIPT_CONFIG.monthlyAllowance)}<br>
            <span class="text-red-600">Faltas descontadas: ${calculations.absenceCount} dias</span>
        `;
    }
    else if (type === 'bonificacao') {
        DOM['receipt-title'].textContent = "Recibo de Bonificação";
        descriptionText = "REFERENTE À BONIFICAÇÃO";
        
        if (calculations.absenceCount > 0 || calculations.certificateCount > 0) {
            totalValue = 0;
            detailsHtml = `<span class="text-red-600 font-bold">Bonificação cancelada devido a faltas/atestados.</span>`;
        } else {
            totalValue = RECEIPT_CONFIG.fixedBonusAmount;
            detailsHtml = `<strong>Valor Integral:</strong> ${formatCurrency(totalValue)}`;
        }
    }

    DOM['receipt-total'].textContent = formatCurrency(totalValue);
    DOM['receipt-total-words'].textContent = numberToWords(totalValue);
    DOM['receipt-description'].textContent = descriptionText;
    DOM['receipt-period-info'].innerHTML = detailsHtml; 
    DOM['receipt-holidays-info'].innerHTML = calculations.holidaysInPeriod.length > 0 
        ? `Feriados: ${calculations.holidaysInPeriod.map(h => h.name).join(', ')}` 
        : '';
}

async function handleAddEmployee() {
    const nome = DOM.newEmployeeName.value.trim();
    const cpf = DOM.newEmployeeCpf.value.trim();
    
    if (!nome || !cpf) return showModal("Erro", "Preencha todos os campos.");
    
    try {
        const cleanCpf = cpf.replace(/\D/g, '');
        await setDoc(doc(db, `artifacts/${appId}/public/data/employees`, cleanCpf), { 
            nome: capitalizeWords(nome), 
            cpf: cpf 
        });
        showModal("Sucesso", "Funcionária adicionada.");
        DOM.newEmployeeName.value = '';
        DOM.newEmployeeCpf.value = '';
    } catch (e) {
        console.error(e);
        showModal("Erro", "Falha ao salvar no banco de dados.");
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
        for (let line of lines) {
            const [nome, cpf] = line.split(',');
            if (nome && cpf && cpf.trim().match(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/)) {
                const cleanCpf = cpf.trim().replace(/\D/g, '');
                await setDoc(doc(db, `artifacts/${appId}/public/data/employees`, cleanCpf), { 
                    nome: capitalizeWords(nome.trim()), 
                    cpf: cpf.trim() 
                });
            }
        }
        showModal("Importação", "Processo concluído.");
    };
    reader.readAsText(file);
}

function showModal(title, msg) {
    if (DOM.messageModalTitle) DOM.messageModalTitle.textContent = title;
    if (DOM.messageModalContent) DOM.messageModalContent.textContent = msg;
    if (DOM.messageModal) DOM.messageModal.classList.remove('hidden');
}

window.addEventListener('DOMContentLoaded', init);
