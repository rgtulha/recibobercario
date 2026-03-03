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
    AppState.ui.calendarMonth = start
