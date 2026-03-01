// --- STATE & UTILS ---
var currentTab = 'admin';
var selectedItems = {}; // Track selected items: { itemName: quantity }
var todayAttendance = []; // Track today's attendance

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    await initDatabase();
    updateDashboardStats();
    renderExpenses();
    renderStock();
    renderWorkshopOrders();
    renderItemsCatalogue();
    renderExpenseCategoryButtons();
    renderSavedCustomers();

    // Set current date in forms if needed
    // document.getElementById('orderDate').valueAsDate = new Date();
});

// --- NAVIGATION ---
function switchTab(tab) {
    currentTab = tab;

    // Update Sidebar/Nav Active State
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if (btn.dataset.tab === tab) {
            btn.classList.add('bg-green-700', 'text-white');
            btn.classList.remove('text-green-100', 'hover:bg-green-800');
        } else {
            btn.classList.remove('bg-green-700', 'text-white');
            btn.classList.add('text-green-100', 'hover:bg-green-800');
        }
    });

    // Show/Hide Sections
    document.getElementById('admin-section').classList.toggle('hidden', tab !== 'admin');
    document.getElementById('workshop-section').classList.toggle('hidden', tab !== 'workshop');

    // Refresh Data on Switch
    if (tab === 'admin') {
        updateDashboardStats();
        renderExpenses();
        renderStock();
    } else {
        renderWorkshopOrders();
    }
}

// --- UTILS ---
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(amount);
}

function showToast(title, icon = 'success') {
    Swal.fire({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        icon: icon,
        title: title
    });
}

// --- ADMIN: DASHBOARD STATS ---
async function updateDashboardStats() {
    const orders = await db.orders.toArray();
    const expenses = await db.expenses.toArray();

    const pendingCount = orders.filter(o => o.status === 'pending').length;
    const completedCount = orders.filter(o => o.status === 'completed').length;

    const completedOrdersValue = orders
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + parseFloat(o.orderTotal || 0), 0);

    const totalExpensesValue = expenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

    // Using the IDs from index.html
    const pendingEl = document.getElementById('stat-pending') || document.getElementById('pendingCount');
    const completedEl = document.getElementById('stat-completed') || document.getElementById('completedCount');
    const expensesEl = document.getElementById('stat-expenses') || document.getElementById('totalExpenses');

    if (pendingEl) pendingEl.innerText = pendingCount;
    if (completedEl) completedEl.innerText = completedCount;
    if (expensesEl) expensesEl.innerText = formatCurrency(totalExpensesValue);

    const completedValueEl = document.getElementById('completedOrdersTotal');
    if (completedValueEl) completedValueEl.innerText = formatCurrency(completedOrdersValue);
}

// --- ADMIN: ITEMS CATALOGUE ---
async function renderItemsCatalogue() {
    const stock = await db.stock.toArray();
    const prices = await db.prices.toArray();
    const priceMap = {};

    prices.forEach(p => {
        priceMap[p.itemName] = p.price;
    });

    const container = document.getElementById('itemsCatalogue');
    if (!container) return;

    container.innerHTML = stock.map(item => {
        const price = priceMap[item.itemSize] || 0;
        const quantity = selectedItems[item.itemSize] || 0;

        return `
            <div class="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition">
                <div class="flex justify-between items-start mb-2">
                    <div class="flex-1">
                        <h5 class="font-bold text-gray-800 text-sm">${item.itemSize}</h5>
                        <p class="text-xs text-gray-500">Stock: ${item.quantity}</p>
                    </div>
                    <span class="text-sm font-bold text-green-600">Rs ${price.toFixed(2)}</span>
                </div>
                <div class="flex items-center justify-between mt-3">
                    <button type="button" onclick="updateItemQuantity('${item.itemSize}', -1)" 
                        class="w-8 h-8 rounded-full bg-red-100 hover:bg-red-200 text-red-600 font-bold transition ${quantity === 0 ? 'opacity-50 cursor-not-allowed' : ''}"
                        ${quantity === 0 ? 'disabled' : ''}>
                        <i class="fas fa-minus text-xs"></i>
                    </button>
                    <span class="font-bold text-lg text-gray-800 min-w-[40px] text-center">${quantity}</span>
                    <button type="button" onclick="updateItemQuantity('${item.itemSize}', 1)" 
                        class="w-8 h-8 rounded-full bg-green-100 hover:bg-green-200 text-green-600 font-bold transition">
                        <i class="fas fa-plus text-xs"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    updateOrderTotal();
}

function updateItemQuantity(itemName, change) {
    if (!selectedItems[itemName]) {
        selectedItems[itemName] = 0;
    }
    selectedItems[itemName] += change;
    if (selectedItems[itemName] < 0) {
        selectedItems[itemName] = 0;
    }
    renderItemsCatalogue();
}

async function updateOrderTotal() {
    const prices = await db.prices.toArray();
    const priceMap = {};
    prices.forEach(p => {
        priceMap[p.itemName] = p.price;
    });

    let total = 0;
    for (let itemName in selectedItems) {
        const quantity = selectedItems[itemName];
        const price = priceMap[itemName] || 0;
        total += quantity * price;
    }

    const totalEl = document.getElementById('orderTotalValue') || document.getElementById('orderTotalValue');
    if (totalEl) totalEl.innerText = formatCurrency(total);
}

// --- ADMIN: COMPLETED ORDERS ---
async function openCompletedOrdersModal() {
    const modal = document.getElementById('completedOrdersModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    await renderCompletedOrders();
}

function closeCompletedOrdersModal() {
    const modal = document.getElementById('completedOrdersModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

async function renderCompletedOrders() {
    let orders = await db.orders.where('status').equals('completed').reverse().toArray();

    const fromDate = document.getElementById('orderReportFrom').value;
    const toDate = document.getElementById('orderReportTo').value;

    if (fromDate || toDate) {
        const from = fromDate ? new Date(fromDate).getTime() : 0;
        const to = toDate ? new Date(toDate).getTime() + 86399999 : Infinity;

        orders = orders.filter(o => {
            const time = o.completedTimestamp || o.timestamp;
            return time >= from && time <= to;
        });
    }

    const container = document.getElementById('completedOrdersList');
    const totalEl = document.getElementById('completedOrdersTotalValue');
    let totalValue = 0;

    if (orders.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-center py-8">No matching orders found.</p>';
        if (totalEl) totalEl.innerText = formatCurrency(0);
        return;
    }

    container.innerHTML = orders.map(o => {
        totalValue += parseFloat(o.orderTotal || 0);
        return `
            <div class="bg-gray-50 border border-gray-200 rounded-xl p-4 md:p-5 hover:border-green-300 transition">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h4 class="font-bold text-gray-800 text-lg">${o.customerName}</h4>
                        <p class="text-xs text-gray-500">Order: ${o.date} | Completed: ${o.completionDate || 'N/A'}</p>
                    </div>
                    <span class="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-green-200">
                        ${formatCurrency(o.orderTotal || 0)}
                    </span>
                </div>
                <div class="text-sm text-gray-600 bg-white p-3 rounded-lg border border-gray-100 mb-3 font-mono">
                    ${o.details.split('\n').join('<br>')}
                </div>
                <div class="flex justify-between items-center text-xs text-gray-400">
                    <span>Order #${o.id}</span>
                    <button onclick="printOrder(${o.id})" class="text-blue-600 hover:text-blue-800 font-bold flex items-center">
                        <i class="fas fa-print mr-1"></i> Print Receipt
                    </button>
                </div>
            </div>
        `;
    }).join('');

    if (totalEl) totalEl.innerText = formatCurrency(totalValue);
}

// --- ADMIN: EXPENSES ---
async function renderExpenses() {
    const exps = await db.expenses.reverse().limit(10).toArray();
    const container = document.getElementById('expenseList');
    if (!container) return;

    if (exps.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-center py-4">No expenses recorded.</p>';
        return;
    }

    container.innerHTML = exps.map(e => `
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
            <div class="flex items-center space-x-3">
                <div class="w-2 h-2 rounded-full bg-red-500"></div>
                <div>
                    <p class="font-medium text-gray-800">${e.note}</p>
                    <p class="text-xs text-gray-500">${e.date}</p>
                </div>
            </div>
            <span class="font-bold text-red-600">${formatCurrency(e.amount)}</span>
        </div>
    `).join('');
}

// --- ADMIN: EXPENSE REPORTS ---
async function openExpenseReportModal() {
    const modal = document.getElementById('expenseReportModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    await renderExpenseReports();
}

function closeExpenseReportModal() {
    const modal = document.getElementById('expenseReportModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

async function renderExpenseReports() {
    let expenses = await db.expenses.reverse().toArray();

    const fromDate = document.getElementById('expenseReportFrom').value;
    const toDate = document.getElementById('expenseReportTo').value;

    if (fromDate || toDate) {
        const from = fromDate ? new Date(fromDate).getTime() : 0;
        const to = toDate ? new Date(toDate).getTime() + 86399999 : Infinity;

        expenses = expenses.filter(e => {
            const time = e.timestamp || 0;
            return time >= from && time <= to;
        });
    }

    const container = document.getElementById('expenseReportList');
    const totalEl = document.getElementById('expenseReportTotalValue');
    let totalValue = 0;

    if (expenses.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-center py-8">No expenses found for this range.</p>';
        if (totalEl) totalEl.innerText = formatCurrency(0);
        return;
    }

    const categorySummary = {};
    expenses.forEach(e => {
        totalValue += parseFloat(e.amount || 0);
        const cat = e.category || "Uncategorized";
        if (!categorySummary[cat]) categorySummary[cat] = { total: 0, items: [] };
        categorySummary[cat].total += parseFloat(e.amount || 0);
        categorySummary[cat].items.push(e);
    });

    container.innerHTML = Object.keys(categorySummary).sort().map(cat => `
        <div class="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden mb-4 shadow-sm">
            <div class="bg-red-50 px-4 py-3 border-b border-red-100 flex justify-between items-center">
                <h4 class="font-bold text-red-800">${cat}</h4>
                <span class="font-black text-red-600">${formatCurrency(categorySummary[cat].total)}</span>
            </div>
            <div class="p-3 bg-white">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="text-gray-400 text-left border-b border-gray-50">
                            <th class="py-2 font-medium">Date</th>
                            <th class="py-2 font-medium">Note</th>
                            <th class="py-2 font-medium text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${categorySummary[cat].items.map(item => `
                            <tr class="border-b border-gray-50 last:border-0">
                                <td class="py-2 text-gray-500">${item.date}</td>
                                <td class="py-2 text-gray-800">${item.note}</td>
                                <td class="py-2 text-right font-bold text-gray-700">${formatCurrency(item.amount)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `).join('');

    if (totalEl) totalEl.innerText = formatCurrency(totalValue);

    const chartContainer = document.getElementById('expenseChartContainer');
    if (chartContainer && !chartContainer.classList.contains('hidden')) {
        if (typeof renderExpenseChart === 'function') renderExpenseChart();
    }
}

// --- ADMIN & WORKSHOP: STOCK ---
async function renderStock() {
    const stock = await db.stock.toArray();

    // Admin List (Editable Inputs)
    const adminHtmlString = stock.map(s => `
        <div class="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center group hover:border-blue-200 transition">
            <span class="font-medium text-gray-700 w-1/2">${s.itemSize}</span>
            <input type="number" data-admin-stock="${s.itemSize}" value="${s.quantity}" min="0" class="admin-stock-input w-24 text-center bg-gray-50 border border-gray-200 rounded-lg p-1.5 focus:ring-2 focus:ring-blue-500 outline-none transition font-bold text-sm">
        </div>
    `).join('');

    // Workshop List (Read-only Spans)
    const workshopHtmlString = stock.map(s => `
        <div class="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center group hover:border-green-200 transition">
            <span class="font-medium text-gray-700">${s.itemSize}</span>
            <span class="px-3 py-1 bg-green-100 text-green-800 rounded-full font-bold text-sm min-w-[2.5rem] text-center">${s.quantity}</span>
        </div>
    `).join('');

    const container = document.getElementById('stockList');
    if (container) container.innerHTML = adminHtmlString;

    const workshopContainer = document.getElementById('workshopStockList');
    if (workshopContainer) workshopContainer.innerHTML = workshopHtmlString;
}

async function saveAdminStock() {
    const inputs = document.querySelectorAll('.admin-stock-input');
    let hasUpdates = false;

    for (let input of inputs) {
        const itemName = input.dataset.adminStock;
        const newQty = parseInt(input.value);

        if (!isNaN(newQty) && newQty >= 0) {
            await db.stock.update(itemName, { quantity: newQty });
            hasUpdates = true;
        }
    }

    if (hasUpdates) {
        showToast('Stock updated successfully!');
        renderStock();
    } else {
        showToast('No valid stock changes', 'info');
    }
}

// --- WORKSHOP: ORDERS ---
async function renderWorkshopOrders() {
    const pending = await db.orders.where('status').equals('pending').reverse().toArray();
    const container = document.getElementById('workshopOrdersList');
    if (!container) return;

    if (pending.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-12 text-gray-400">
                <i class="fas fa-clipboard-check text-4xl mb-4"></i>
                <p>No pending orders right now.</p>
            </div>`;
        return;
    }

    container.innerHTML = pending.map(o => `
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition duration-300">
            <div class="p-5">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h3 class="font-bold text-xl text-gray-800">${o.customerName}</h3>
                        <div class="text-sm text-gray-600 mt-2">
                            <p class="flex items-start mb-1"><i class="fas fa-map-marker-alt mt-1 mr-2 text-gray-400"></i> ${o.address}</p>
                            <div class="flex items-center text-sm text-gray-500">
                                <i class="fas fa-phone-alt mr-2 text-xs"></i> <span>${o.phone}</span>
                            </div>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="px-3 py-1 rounded-full text-xs font-bold ${o.paymentStatus === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                            ${o.paymentStatus === 'Paid' ? 'PAID' : 'NOT PAID'}
                        </span>
                        ${o.orderTotal ? `<div class="mt-2 text-lg font-bold text-green-700">Rs ${o.orderTotal.toFixed(2)}</div>` : ''}
                    </div>
                </div>

                <div class="bg-blue-50 p-4 rounded-lg mb-4 border-l-4 border-blue-400">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-xs font-bold text-blue-600 uppercase tracking-wide">Ordered Items</span>
                        <button onclick="viewOrderDetails(${o.id})" class="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded transition">
                            <i class="fas fa-eye mr-1"></i> View Full List
                        </button>
                    </div>
                    <div class="text-blue-900 font-mono text-sm leading-relaxed line-clamp-3">
                        ${o.details}
                    </div>
                </div>

                <div class="flex space-x-3 pt-3 border-t border-gray-100">
                    <button onclick="printOrder(${o.id})" class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg font-medium transition flex items-center justify-center space-x-2">
                        <i class="fas fa-print"></i> <span>Print</span>
                    </button>
                    <button onclick="completeOrder(${o.id})" class="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium transition flex items-center justify-center space-x-2">
                        <i class="fas fa-check"></i> <span>Complete</span>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

async function completeOrder(id) {
    const order = await db.orders.get(id);

    const result = await Swal.fire({
        title: 'Complete Order?',
        text: "This will deduct items from stock and mark order as completed.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#16a34a',
        confirmButtonText: 'Yes, Complete & Deduct Stock'
    });

    if (result.isConfirmed) {
        let deductions = [];

        if (order.items && Array.isArray(order.items)) {
            for (let item of order.items) {
                const stockItem = await db.stock.get(item.name);
                if (stockItem) {
                    const newQty = Math.max(0, stockItem.quantity - item.quantity);
                    await db.stock.update(item.name, { quantity: newQty });
                    deductions.push({ item: item.name, qty: item.quantity });
                }
            }
        } else {
            deductions = await parseAndDeductStock(order.details);
        }

        await db.orders.update(id, {
            status: 'completed',
            completionDate: new Date().toLocaleDateString(),
            completedTimestamp: Date.now()
        });

        if (deductions.length > 0) {
            const deductionMsg = deductions.map(d => `${d.qty}x ${d.item}`).join('<br>');
            await Swal.fire({
                title: 'Order Completed',
                html: `Stock updated:<br><small>${deductionMsg}</small>`,
                icon: 'success',
                timer: 4000
            });
        } else {
            showToast('Order completed!', 'success');
        }

        renderWorkshopOrders();
        renderStock();
        updateDashboardStats();
    }
}

async function parseAndDeductStock(detailsText) {
    const lines = detailsText.split(/[\n,]/);
    const allStock = await db.stock.toArray();
    allStock.sort((a, b) => b.itemSize.length - a.itemSize.length);

    const deductions = [];
    for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        let qty = 1;
        let cleanLine = line;

        const suffixMatch = line.match(/[*xX]\s*(\d+)$/);
        if (suffixMatch) {
            qty = parseInt(suffixMatch[1]);
            cleanLine = line.substring(0, suffixMatch.index).trim();
        } else {
            const prefixMatch = line.match(/^(\d+)\s*[*xX]?\s*/);
            if (prefixMatch) {
                qty = parseInt(prefixMatch[1]);
                cleanLine = line.substring(prefixMatch[0].length).trim();
            }
        }

        let normalizedInput = cleanLine.toLowerCase();
        normalizedInput = normalizedInput.replace(/\bfeet\b|\bfoot\b/g, 'ft');
        normalizedInput = normalizedInput.replace(/(\d)\s+ft/g, '$1ft');
        normalizedInput = normalizedInput.replace(/(^|\s)(\d+)ft/g, '$1$2.0ft');

        const matchedItem = allStock.find(stockItem => {
            const stockName = stockItem.itemSize.toLowerCase();
            const stockTokens = stockName.split(/\s+/);
            const inputTokens = normalizedInput.split(/\s+/);
            return stockTokens.every(token => inputTokens.some(it => it.includes(token)));
        });

        if (matchedItem) {
            const newQty = Math.max(0, matchedItem.quantity - qty);
            await db.stock.update(matchedItem.itemSize, { quantity: newQty });
            matchedItem.quantity = newQty;

            const existingDeduction = deductions.find(d => d.item === matchedItem.itemSize);
            if (existingDeduction) existingDeduction.qty += qty;
            else deductions.push({ item: matchedItem.itemSize, qty: qty });
        }
    }
    return deductions;
}

async function printOrder(id) {
    const o = await db.orders.get(id);
    const printArea = document.getElementById('printArea');
    printArea.innerHTML = `
        <div class="order-card-print">
            <h2 style="text-align:center; margin-bottom: 5px;">AMAZING DECORA</h2>
            <h4 style="text-align:center; margin-top: 0; color: #555;">JOB SLIP / ORDER RECEIPT</h4>
            <hr style="margin: 15px 0;">
            <div style="display: flex; justify-content: space-between;">
                <div>
                    <p><b>Date:</b> ${o.date}</p>
                    <p><b>Order ID:</b> #${o.id}</p>
                </div>
                <div>
                    <p style="text-align: right; font-weight: bold; font-size: 1.2em;">${o.paymentStatus === 'Paid' ? 'PAID' : 'NOT PAID'}</p>
                </div>
            </div>

            <div style="margin-top: 20px;">
                <p><b>Customer:</b> ${o.customerName}</p>
                <p><b>Address:</b> ${o.address || 'N/A'}</p>
                <p><b>Phone:</b> ${o.phone || 'N/A'}</p>
            </div>

            <div style="border: 2px solid #000; padding: 15px; margin-top: 20px; font-family: monospace; font-size: 1.1em; background: #eee;">
                <b>ORDER DETAILS:</b><br />${o.details.replace(/\n/g, '<br>')}
            </div>

            ${o.orderTotal ? `
            <div style="margin-top: 20px; text-align: right; font-size: 1.3em;">
                <b>TOTAL ORDER VALUE: Rs ${o.orderTotal.toFixed(2)}</b>
            </div>
            ` : ''}

            <div style="margin-top: 40px; text-align: center; font-size: 0.8em; color: #777;">
                <p>Thank you for choosing Amazing Decora!</p>
            </div>
        </div>
    `;
    window.print();
}

// --- WORKSHOP: PRODUCTION ---
async function openProductionModal() {
    const modal = document.getElementById('productionModal');
    const container = document.getElementById('prodInputs');
    if (!container) return;

    // Fetch from db instead of using initialSizes
    const stock = await db.stock.toArray();
    const sizes = stock.map(s => s.itemSize);

    container.innerHTML = sizes.map(s => `
        <div class="bg-orange-50 p-4 rounded-lg border border-orange-100">
            <label class="block text-xs font-bold text-orange-800 uppercase mb-2 tracking-wide">${s}</label>
            <input type="number" data-size="${s}" value="0" min="0" class="prod-qty w-full p-2 border border-orange-200 rounded-lg text-center font-bold text-lg focus:outline-none focus:ring-2 focus:ring-orange-500">
        </div>
    `).join('');

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeProductionModal() {
    const modal = document.getElementById('productionModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

document.getElementById('prodEntryForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inputs = document.querySelectorAll('.prod-qty');
    let hasUpdates = false;

    for (let input of inputs) {
        const qty = parseInt(input.value);
        if (qty > 0) {
            hasUpdates = true;
            const item = await db.stock.get(input.dataset.size);
            if (item) {
                await db.stock.update(input.dataset.size, { quantity: item.quantity + qty });
            }
            // Reset input value after processing
            input.value = 0;
        }
    }

    if (hasUpdates) {
        showToast('Stock updated successfully!');
        closeProductionModal();
        renderStock();
    } else {
        showToast('No quantities entered', 'info');
    }
});

// --- PRICE MANAGER ---
async function openPriceManagerModal() {
    const modal = document.getElementById('priceManagerModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    await renderPriceManager();
}

function closePriceManagerModal() {
    const modal = document.getElementById('priceManagerModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

async function renderPriceManager() {
    const prices = await db.prices.toArray();
    const container = document.getElementById('priceManagerList');
    if (!container) return;

    container.innerHTML = prices.map(p => `
        <div class="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <label class="block text-sm font-bold text-gray-700 mb-2">${p.itemName}</label>
            <div class="flex items-center space-x-2">
                <span class="text-gray-600">Rs</span>
                <input type="number" 
                    data-item="${p.itemName}"
                    value="${p.price}" 
                    min="0" 
                    step="0.01"
                    class="price-input flex-1 bg-white border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-orange-500 outline-none transition font-bold text-lg">
            </div>
        </div>
    `).join('');
}

async function savePrices() {
    const inputs = document.querySelectorAll('.price-input');
    let hasUpdates = false;

    for (let input of inputs) {
        const itemName = input.dataset.item;
        const newPrice = parseFloat(input.value);

        if (!isNaN(newPrice) && newPrice >= 0) {
            await db.prices.update(itemName, { price: newPrice });
            hasUpdates = true;
        }
    }

    if (hasUpdates) {
        showToast('Prices updated successfully!');
        closePriceManagerModal();
        renderItemsCatalogue();
    } else {
        showToast('No valid price changes', 'info');
    }
}
