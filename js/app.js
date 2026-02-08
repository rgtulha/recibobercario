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

// --- FIREBASE CONFIG ---
const appId = '1:468868061475:web:dc4bfbf02eeae989a61496'; 
const firebaseConfig = {
    apiKey: "AIzaSyDWt4fgnCiHECnOF-lNMsvtc1Cwe1SmYXc",
    authDomain: "controlevenda-ef7db.firebaseapp.com",
    projectId: "controlevenda-ef7db",
    storageBucket: "controlevenda-ef7db.firebasestorage.app",
    messagingSenderId: "468868061475",
    appId: appId
};

let db, auth;

// --- INICIALIZAÇÃO ---
async function init() {
    console.log("Iniciando Aplicação...");
    cacheDOM();
    setupEventListeners();

    // Configura Datas Iniciais
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    if (DOM.startDate) DOM.startDate.value = firstDay;
    if (DOM.endDate) DOM.endDate.value = lastDay;
    AppState.selection.startDate = firstDay;
    AppState.selection.endDate = lastDay;

    updateCalendarContext(); 
    
    // Inicia Firebase
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
        'newReceiptButton' // ID do novo botão adicionado aqui
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
        showModal("Erro Fatal", "Não foi possível conectar ao sistema.");
    }
}

// --- CONTROLE DE LOGIN E UI ---
function showLoginForm() {
    const container = DOM['welcome-message'];
    if (!container) return;
    
    container.classList.remove('hidden');
    DOM['receipt-content']?.classList.add('hidden');

    container.innerHTML = `
        <div class="p-8 bg-white rounded-xl shadow-lg border border-stone-200 max-w-sm mx-auto">
            <h2 class="text-2xl font-bold text-teal-700 mb-4">Acesso Restrito</h2>
            <p class="text-stone-600 mb-4 text-sm">Faça login para acessar o sistema.</p>
            
            <input type="email" id="loginEmail" placeholder="E-mail" class="w-full mb-3 px-3 py-2 border border-stone-300 rounded focus:ring-2 focus:ring-teal-500">
            <input type="password" id="loginPass" placeholder="Senha" class="w-full mb-4 px-3 py-2 border border-stone-300 rounded focus:ring-2 focus:ring-teal-500">
            
            <button id="btnLogin" class="w-full bg-teal-600 text-white py-2 rounded hover:bg-teal-700 transition font-bold">Entrar</button>
            <p id="loginError" class="text-red-500 text-xs mt-2 hidden"></p>
        </div>
    `;

    document.getElementById('btnLogin').addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value;
        const pass = document.getElementById('loginPass').value;
        const errorMsg = document.getElementById('loginError');
        
        errorMsg.classList.add('hidden');
        document.getElementById('btnLogin').innerText = "Entrando...";

        try {
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (error) {
            console.error(error);
            document.getElementById('btnLogin').innerText = "Entrar";
            errorMsg.textContent = "E-mail ou senha incorretos.";
            errorMsg.classList.remove('hidden');
        }
    });
}

function showLoggedInState() {
    const container = DOM['welcome-message'];
    if (!container) return;

    // AQUI: Adicionadas as classes 'sticky', 'top-8' e 'z-10' para flutuar
    container.innerHTML = `
        <div class="sticky top-8 z-10 p-8 bg-white rounded-xl shadow-lg border border-teal-100 relative">
            <button id="btnLogout" class="absolute top-2 right-2 text-xs text-red-500 hover:underline">Sair</button>
            <h2 class="text-3xl font-bold text-teal-700 mb-2">Gerador de Recibos</h2>
            <p class="text-stone-600 max-w-md">Logado como: <strong>${AppState.user.email}</strong></p>
            <p class="text-stone-500 text-sm mt-2">Selecione uma funcionária ao lado para começar.</p>
        </div>
    `;

    document.getElementById('btnLogout').addEventListener('click', () => signOut(auth));
}

function setupFirestoreListeners() {
    const employeesRef = collection(db, `artifacts/${appId}/public/data/employees`);
    const q = query(employeesRef);
    
    onSnapshot(q, (snapshot) => {
        AppState.employees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        AppState.employees.sort((a, b) => a.nome.localeCompare(b.nome));
        renderEmployeeList();
    }, (error) => {
        console.error("Erro de Permissão:", error);
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

    // Correção Matutino/Vespertino
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

    // --- LÓGICA DO BOTÃO NOVO RECIBO ---
    DOM.newReceiptButton?.addEventListener('click', () => {
        // 1. Limpa a funcionária selecionada
        AppState.selection.employee = null;
        
        // 2. Limpa as faltas e atestados (pois são de outra pessoa)
        AppState.selection.absences.clear();
        AppState.selection.certificates.clear();

        // 3. Troca a visualização
        DOM['receipt-content'].classList.add('hidden');
        DOM['welcome-message'].classList.remove('hidden');
        
        // 4. Atualiza a UI (Remove seleção da lista e limpa calendário)
        renderEmployeeList();
        renderCalendar();

        // Obs: Mantemos as DATAS e o TIPO DE RECIBO para facilitar lançamentos em lote.
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

// --- RENDERIZAÇÃO E CRUD ---
function renderEmployeeList() {
    if (!DOM.employeeList) return;
    DOM.employeeList.innerHTML = '';

    if (!AppState.user.isAuthenticated) {
        DOM.employeeList.innerHTML = `<p class="text-stone-400 p-4 text-center text-sm">Faça login para ver a lista.</p>`;
        return;
    }
    
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
            <button class="text-red-500 hover:text-red-700 ml-2 delete-btn" title="Excluir">
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
    let start;
    if (AppState.selection.startDate) start = new Date(AppState.selection.startDate + 'T00:00:00');
    else start = new Date();

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
    if (DOM.currentMonthYear) DOM.currentMonthYear.textContent = `${monthNames[month]} ${year}`;

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
    if (!start || !end) { start = new Date().toISOString().split('T')[0]; end = start; }

    const calculations = calculateWorkingDays(start, end, AppState.selection.absences, AppState.selection.certificates);
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
            detailsHtml = `${periodString}<span class="text-red-600 font-bold">Bonificação cancelada devido a faltas/atestados.</span>`;
        } else {
            totalValue = RECEIPT_CONFIG.fixedBonusAmount;
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

// --- CRUD E ARQUIVOS ---
async function handleAddEmployee() {
    const nome = DOM.newEmployeeName.value.trim();
    let cpf = DOM.newEmployeeCpf.value.trim();
    
    if (!nome || !cpf) return showModal("Erro", "Preencha todos os campos.");
    
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) return showModal("Erro", "O CPF deve ter 11 dígitos.");
    const formattedCpf = cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    
    try {
        await setDoc(doc(db, `artifacts/${appId}/public/data/employees`, cleanCpf), { 
            nome: capitalizeWords(nome), 
            cpf: formattedCpf 
        });
        showModal("Sucesso", "Funcionária adicionada.");
        DOM.newEmployeeName.value = '';
        DOM.newEmployeeCpf.value = '';
    } catch (e) {
        console.error(e);
        if (e.code === 'permission-denied') showModal("Sem Permissão", "Você precisa estar logado para salvar.");
        else showModal("Erro", "Falha ao salvar no banco.");
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
        showModal("Erro", "Falha ao excluir. Verifique se está logado.");
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
        let count = 0;
        for (let line of lines) {
            if (!line.trim()) continue;
            const parts = line.split(',');
            if (parts.length >= 2) {
                const nome = parts[0].trim();
                const cleanCpf = parts[1].trim().replace(/\D/g, '');
                if (nome && cleanCpf.length === 11) {
                    const formattedCpf = cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
                    try {
                        await setDoc(doc(db, `artifacts/${appId}/public/data/employees`, cleanCpf), { nome: capitalizeWords(nome), cpf: formattedCpf });
                        count++;
                    } catch(e) { console.error("Erro import:", e); }
                }
            }
        }
        showModal("Importação", `${count} funcionárias importadas.`);
    };
    reader.readAsText(file);
}

function showModal(title, msg) {
    if (DOM.messageModalTitle) DOM.messageModalTitle.textContent = title;
    if (DOM.messageModalContent) DOM.messageModalContent.textContent = msg;
    if (DOM.messageModal) DOM.messageModal.classList.remove('hidden');
}

window.addEventListener('DOMContentLoaded', init);
