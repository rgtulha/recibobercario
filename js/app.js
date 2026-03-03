import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getFirestore, collection, query, onSnapshot, doc, setDoc, deleteDoc, getDocs } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

import { formatCurrency, formatDate, getCurrentDateFormatted, capitalizeWords, numberToWords } from './utils.js';
import { RECEIPT_CONFIG, HOLIDAYS_DB, calculateWorkingDays, getMarkedDatesInSpecificMonth } from './business.js';

const AppState = {
    user: { id: null, email: null, isAuthenticated: false },
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

// --- FIREBASE CONFIG (BERÇÁRIO CRESCER KIDS) ---
const firebaseConfig = {
    apiKey: "AIzaSyDWt4fgnCiHECnOF-lNMsvtc1Cwe1SmYXc",
    authDomain: "controlevenda-ef7db.firebaseapp.com",
    projectId: "controlevenda-ef7db",
    storageBucket: "controlevenda-ef7db.firebasestorage.app",
    messagingSenderId: "468868061475",
    appId: "1:468868061475:web:dc4bfbf02eeae989a61496"
};

const appId = firebaseConfig.appId; 

let db, auth;

// --- INICIALIZAÇÃO ---
async function init() {
    console.log("Iniciando Aplicação - Berçário Crescer Kids...");
    cacheDOM();
    setupEventListeners();

    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    if (DOM.startDate) DOM.startDate.value = firstDay;
    if (DOM.endDate) DOM.endDate.value = lastDay;
    AppState.selection.startDate = firstDay;
    AppState.selection.endDate = lastDay;

    updateCalendarContext(); 
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
        'receipt-total-words-label', 'receipt-total-words', 'employee-signature-name', 'receipt-description',
        'newReceiptButton', 
        'receipt-observation-container', 'receipt-observation-text'
    ];

    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) DOM[id] = el;
    });

    DOM.receiptTypeRadios = document.querySelectorAll('input[name="receiptType"]');
    DOM.markTypeRadios = document.querySelectorAll('input[name="markType"]');
}

async function initFirebase() {
    try {
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);

        onAuthStateChanged(auth, (user) => {
            if (user) {
                AppState.user.id = user.uid;
                AppState.user.email = user.email;
                AppState.user.isAuthenticated = true;
                showLoggedInState();
                setupFirestoreListeners();
            } else {
                AppState.user.isAuthenticated = false;
                AppState.employees = [];
                renderEmployeeList(); 
                showLoginForm();
            }
        });
    } catch (error) {
        console.error("Erro Firebase:", error);
    }
}

function showLoginForm() {
    const container = DOM['welcome-message'];
    if (!container) return;
    container.classList.remove('hidden');
    container.classList.remove('items-center', 'justify-center'); 
    DOM['receipt-content']?.classList.add('hidden');
    container.innerHTML = `
        <div class="sticky top-10 z-10 p-8 bg-white rounded-xl shadow-lg border border-stone-200 max-w-sm mx-auto mt-4">
            <h2 class="text-2xl font-bold text-teal-700 mb-4 text-center">Acesso Restrito</h2>
            <input type="email" id="loginEmail" placeholder="E-mail" class="w-full mb-3 px-3 py-2 border border-stone-300 rounded focus:ring-2 focus:ring-teal-500">
            <input type="password" id="loginPass" placeholder="Senha" class="w-full mb-4 px-3 py-2 border border-stone-300 rounded focus:ring-2 focus:ring-teal-500">
            <button id="btnLogin" class="w-full bg-teal-600 text-white py-2 rounded hover:bg-teal-700 transition font-bold">Entrar</button>
            <p id="loginError" class="text-red-500 text-xs mt-2 hidden text-center"></p>
        </div>
    `;
    document.getElementById('btnLogin').addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value;
        const pass = document.getElementById('loginPass').value;
        try {
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (error) {
            document.getElementById('loginError').classList.remove('hidden');
            document.getElementById('loginError').textContent = "Erro ao entrar.";
        }
    });
}

function showLoggedInState() {
    const container = DOM['welcome-message'];
    if (!container) return;
    container.classList.remove('items-center', 'justify-center');
    container.innerHTML = `
        <div class="sticky top-10 z-10 p-8 bg-white rounded-xl shadow-lg border border-teal-100 relative mt-4 text-center">
            <button id="btnLogout" class="absolute top-2 right-2 text-xs text-red-500 hover:underline">Sair</button>
            <h2 class="text-3xl font-bold text-teal-700 mb-2">Gerador de Recibos</h2>
            <p class="text-stone-600">Logado como: <strong>${AppState.user.email}</strong></p>
        </div>
    `;
    document.getElementById('btnLogout').addEventListener('click', () => signOut(auth));
}

function setupFirestoreListeners() {
    const employeesRef = collection(db, `artifacts/${appId}/public/data/employees`);
    onSnapshot(query(employeesRef), (snapshot) => {
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
        updateCalendarContext(); 
        updateReceiptPreview();
    };
    DOM.startDate?.addEventListener('change', updateDates);
    DOM.endDate?.addEventListener('change', updateDates);
    DOM.receiptTypeRadios.forEach(radio => radio.addEventListener('change', (e) => {
        AppState.selection.receiptType = e.target.value;
        toggleReceiptTypeFields();
        updateCalendarContext();
        updateReceiptPreview();
    }));
    DOM.internPeriod?.addEventListener('change', (e) => {
        AppState.selection.internPeriod = e.target.value;
        updateReceiptPreview();
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
    DOM.newReceiptButton?.addEventListener('click', () => {
        AppState.selection.employee = null;
        AppState.selection.absences.clear();
        AppState.selection.certificates.clear();
        DOM['receipt-content'].classList.add('hidden');
        DOM['welcome-message'].classList.remove('hidden');
        showLoggedInState(); renderEmployeeList(); renderCalendar();
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
    if (!AppState.user.isAuthenticated) return;
    const filter = AppState.ui.filterText.toLowerCase();
    const filtered = AppState.employees.filter(emp => emp.nome.toLowerCase().includes(filter));
    filtered.forEach(emp => {
        const div = document.createElement('div');
        div.className = `p-3 mb-2 rounded-lg cursor-pointer hover:bg-teal-50 border-b border-stone-200 employee-item flex justify-between items-center ${AppState.selection.employee?.id === emp.id ? 'selected bg-teal-100 font-bold border-teal-500' : ''}`;
        div.innerHTML = `<span>${capitalizeWords(emp.nome)}</span><button class="text-red-500 delete-btn"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg></button>`;
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
    let start = AppState.selection.startDate ? new Date(AppState.selection.startDate + 'T12:00:00') : new Date();
    AppState.ui.calendarMonth = start.getMonth();
    AppState.ui.calendarYear = start.getFullYear();
    renderCalendar();
}

function changeCalendarMonth(delta) {
    AppState.ui.calendarMonth += delta;
    if (AppState.ui.calendarMonth > 11) { AppState.ui.calendarMonth = 0; AppState.ui.calendarYear++; }
    else if (AppState.ui.calendarMonth < 0) { AppState.ui.calendarMonth = 11; AppState.ui.calendarYear--; }
    const year = AppState.ui.calendarYear;
    const month = AppState.ui.calendarMonth;
    const strMonth = String(month + 1).padStart(2, '0');
    const newStart = `${year}-${strMonth}-01`;
    const newEnd = `${year}-${strMonth}-${new Date(year, month + 1, 0).getDate()}`;
    if(DOM.startDate) DOM.startDate.value = newStart;
    if(DOM.endDate) DOM.endDate.value = newEnd;
    AppState.selection.startDate = newStart;
    AppState.selection.endDate = newEnd;
    renderCalendar();
    updateReceiptPreview();
}

function renderCalendar() {
    if (!DOM.calendar) return;
    DOM.calendar.innerHTML = '';
    const year = AppState.ui.calendarYear;
    const month = AppState.ui.calendarMonth;
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    if (DOM.currentMonthYear) DOM.currentMonthYear.textContent = `${monthNames[month]} ${year}`;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].forEach(d => {
        const el = document.createElement('div'); el.className = 'calendar-day header'; el.textContent = d; DOM.calendar.appendChild(el);
    });
    for (let i = 0; i < firstDay; i++) {
        const el = document.createElement('div'); el.className = 'calendar-day other-month'; DOM.calendar.appendChild(el);
    }
    for (let day = 1; day <= daysInMonth; day++) {
        const isoDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const el = document.createElement('div');
        el.className = 'calendar-day current-month';
        el.textContent = day;
        if (HOLIDAYS_DB.some(h => h.date === isoDate)) el.classList.add('holiday');
        if (AppState.selection.absences.has(isoDate)) el.classList.add('selected-absence');
        if (AppState.selection.certificates.has(isoDate)) el.classList.add('selected-certificate');
        el.addEventListener('click', () => {
            const type = AppState.ui.currentMarkType;
            if (type === 'absence') {
                if (AppState.selection.absences.has(isoDate)) AppState.selection.absences.delete(isoDate);
                else { AppState.selection.absences.add(isoDate); AppState.selection.certificates.delete(isoDate); }
            } else {
                if (AppState.selection.certificates.has(isoDate)) AppState.selection.certificates.delete(isoDate);
                else { AppState.selection.certificates.add(isoDate); AppState.selection.absences.delete(isoDate); }
            }
            renderCalendar(); updateReceiptPreview();
        });
        DOM.calendar.appendChild(el);
    }
}

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
    const calculations = calculateWorkingDays(start, end, AppState.selection.absences, AppState.selection.certificates);
    const periodString = `<strong>Período:</strong> ${formatDate(start)} até ${formatDate(end)}<br>`;

    const getFormattedList = (set) => {
        const list = Array.from(set).filter(dtStr => dtStr >= start && dtStr <= end).sort().map(dt => formatDate(dt));
        return list.length > 0 ? list.join(', ') : null;
    };

    const absenceList = getFormattedList(AppState.selection.absences);
    const certList = getFormattedList(AppState.selection.certificates);
    const totalWorkingDaysInPeriod = calculations.effectiveDays + calculations.absenceCount + calculations.certificateCount;

    let totalValue = 0;
    let descriptionText = '';
    let detailsHtml = '';

    if (type === 'salarioEstagiario') {
        DOM['receipt-observation-container']?.classList.remove('hidden');
        DOM['receipt-observation-text'].textContent = "Nos termos da Lei nº 11.788/2008 (Lei do Estágio), o presente estágio possui caráter exclusivamente educativo, não configurando vínculo empregatício de qualquer natureza, desde que observados os requisitos legais, não sendo devidos encargos trabalhistas e previdenciários típicos da relação de emprego.";
        
        DOM['receipt-title'].textContent = "Recibo Bolsa Estágio";
        descriptionText = `REFERENTE À BOLSA ESTÁGIO (${AppState.selection.internPeriod === 'matutino' ? 'Matutino' : 'Vespertino'})`;
        
        // --- NOVO CÁLCULO PROPORCIONAL: CONTA DIAS CORRIDOS ---
        const sDate = new Date(start + 'T12:00:00');
        const eDate = new Date(end + 'T12:00:00');
        
        // Conta o total de dias corridos entre as duas datas (inclui sábados, domingos e feriados)
        const totalCalendarDays = Math.round((eDate - sDate) / (1000 * 60 * 60 * 24)) + 1;
        
        // Conta quantas faltas marcadas estão dentro do período selecionado
        const absencesInPeriodCount = Array.from(AppState.selection.absences).filter(dtStr => {
            const dt = new Date(dtStr + 'T12:00:00');
            return dt >= sDate && dt <= eDate;
        }).length;

        // Valor da diária = 1100 / 30
        const dailyAllowance = RECEIPT_CONFIG.monthlyAllowance / 30;
        
        // Dias a pagar = Dias corridos totais no período - Faltas
        const payingDaysIntern = totalCalendarDays - absencesInPeriodCount;
        
        // Valor total final
        totalValue = payingDaysIntern * dailyAllowance;
        if(totalValue < 0) totalValue = 0;

        let details = absenceList ? `<div class="text-red-600">Faltas descontadas: ${absenceList}</div>` : 'Sem faltas';
        if (certList) details += `<div class="text-stone-600">Atestados: ${certList}</div>`;
        
        detailsHtml = `
            ${periodString}
            <strong>Valor Mensal Base:</strong> ${formatCurrency(RECEIPT_CONFIG.monthlyAllowance)}<br>
            ${details}
        `;
    } 
    else {
        DOM['receipt-observation-container']?.classList.add('hidden');
        
        if (type === 'valeTransporte') {
            DOM['receipt-title'].textContent = "Recibo de Vale Transporte";
            const payingDaysVT = totalWorkingDaysInPeriod - calculations.absenceCount;
            totalValue = payingDaysVT * RECEIPT_CONFIG.dailyValue;
            descriptionText = "REFERENTE AO VALE TRANSPORTE";
            let discount = absenceList ? `<div class="text-red-600">Descontos (Faltas): ${absenceList}</div>` : '';
            if (certList) discount += `<div class="text-stone-600">Atestados: ${certList}</div>`;
            detailsHtml = `${periodString}<strong>Valor Diário:</strong> ${formatCurrency(RECEIPT_CONFIG.dailyValue)}<br><strong>Dias Úteis no Período:</strong> ${totalWorkingDaysInPeriod}<br>${discount || 'Sem descontos ou atestados'}`;
        }
        else if (type === 'bonificacao') {
            DOM['receipt-title'].textContent = "Recibo de Bonificação";
            descriptionText = "REFERENTE À BONIFICAÇÃO";
            if (calculations.absenceCount > 0 || calculations.certificateCount > 0) {
                totalValue = 0;
                detailsHtml = `${periodString}<span class="text-red-600 font-bold">Bonificação cancelada.</span>`;
            } else {
                totalValue = RECEIPT_CONFIG.fixedBonusAmount;
                detailsHtml = `${periodString}<strong>Valor Integral:</strong> ${formatCurrency(totalValue)}`;
            }
        }
    }

    if(DOM['receipt-total']) DOM['receipt-total'].textContent = formatCurrency(totalValue);
    if(DOM['receipt-total-words']) DOM['receipt-total-words'].textContent = numberToWords(totalValue);
    if(DOM['receipt-description']) DOM['receipt-description'].textContent = descriptionText;
    if(DOM['receipt-period-info']) DOM['receipt-period-info'].innerHTML = detailsHtml; 
    if(DOM['receipt-holidays-info']) {
        DOM['receipt-holidays-info'].innerHTML = calculations.holidaysInPeriod.length > 0 
            ? `Feriados:<br>${calculations.holidaysInPeriod.map(h => `${formatDate(h.date)} - ${h.name}`).join('<br>')}` : '';
    }
}

async function handleAddEmployee() {
    const nome = DOM.newEmployeeName.value.trim();
    let cpf = DOM.newEmployeeCpf.value.trim();
    if (!nome || !cpf) return showModal("Erro", "Preencha todos os campos.");
    const cleanCpf = cpf.replace(/\D/g, '');
    try {
        await setDoc(doc(db, `artifacts/${appId}/public/data/employees`, cleanCpf), { nome: capitalizeWords(nome), cpf: cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') });
        showModal("Sucesso", "Funcionária adicionada!");
        DOM.newEmployeeName.value = ''; DOM.newEmployeeCpf.value = ''; DOM.newEmployeeName.focus();
    } catch (e) { showModal("Erro", "Falha ao salvar."); }
}

async function handleDeleteEmployee() {
    try {
        await deleteDoc(doc(db, `artifacts/${appId}/public/data/employees`, AppState.employeeToDelete));
        DOM.deleteConfirmationModal.classList.add('hidden');
        renderEmployeeList();
    } catch (e) { showModal("Erro", "Falha ao excluir."); }
}

function handleExport() {
    let content = "Nome,CPF\n";
    AppState.employees.forEach(e => content += `${e.nome},${e.cpf}\n`);
    const blob = new Blob([content], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'funcionarias.txt';
    link.click();
}

function handleImport(e) {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async (ev) => {
        const lines = ev.target.result.split('\n');
        for (let line of lines) {
            const parts = line.split(',');
            if (parts.length >= 2) {
                const cleanCpf = parts[1].trim().replace(/\D/g, '');
                await setDoc(doc(db, `artifacts/${appId}/public/data/employees`, cleanCpf), { nome: parts[0].trim(), cpf: cleanCpf });
            }
        }
        showModal("Importação", "Concluída.");
    };
    reader.readAsText(file);
}

function showModal(title, msg) {
    if (DOM.messageModalTitle) DOM.messageModalTitle.textContent = title;
    if (DOM.messageModalContent) DOM.messageModalContent.textContent = msg;
    if (DOM.messageModal) DOM.messageModal.classList.remove('hidden');
}

window.addEventListener('DOMContentLoaded', init);
