// ===== NEW FEATURES =====

// --- CUSTOMER MANAGEMENT ---
async function renderSavedCustomers() {
    const customers = await db.customers.toArray();
    const container = document.getElementById('savedCustomersList');

    if (customers.length === 0) {
        container.innerHTML = '<p class="text-xs text-gray-400">No saved customers yet</p>';
        return;
    }

    container.innerHTML = customers.map(c => `
        <button type="button" onclick="selectCustomer(${c.id})" 
            class="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg text-xs font-medium transition">
            ${c.name}
        </button>
    `).join('');
}

async function selectCustomer(id) {
    const customer = await db.customers.get(id);
    if (customer) {
        const details = `${customer.name}\n${customer.address}\n${customer.phone}`;
        document.getElementById('customerDetailsUnified').value = details;
    }
}

function openCustomerManagerModal() {
    const modal = document.getElementById('customerManagerModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    renderCustomersList();
}

function closeCustomerManagerModal() {
    const modal = document.getElementById('customerManagerModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

async function renderCustomersList() {
    const customers = await db.customers.toArray();
    const container = document.getElementById('customersList');

    if (customers.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 py-8">No customers saved yet</p>';
        return;
    }

    container.innerHTML = customers.map(c => `
        <div class="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div class="flex justify-between items-start">
                <div class="flex-1">
                    <h4 class="font-bold text-gray-800">${c.name}</h4>
                    <p class="text-sm text-gray-600 mt-1"><i class="fas fa-map-marker-alt text-xs mr-1"></i> ${c.address}</p>
                    <p class="text-sm text-gray-600 mt-1"><i class="fas fa-phone text-xs mr-1"></i> ${c.phone}</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="editCustomer(${c.id})" 
                        class="text-blue-600 hover:text-blue-800 text-sm">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteCustomer(${c.id})" 
                        class="text-red-600 hover:text-red-800 text-sm">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function showAddCustomerForm() {
    document.getElementById('addCustomerForm').classList.remove('hidden');
}

function hideAddCustomerForm() {
    document.getElementById('addCustomerForm').classList.add('hidden');
    document.getElementById('newCustomerName').value = '';
    document.getElementById('newCustomerPhone').value = '';
    document.getElementById('newCustomerAddress').value = '';
}

async function saveNewCustomer() {
    const name = document.getElementById('newCustomerName').value.trim();
    const phone = document.getElementById('newCustomerPhone').value.trim();
    const address = document.getElementById('newCustomerAddress').value.trim();

    if (!name || !phone || !address) {
        showToast('Please fill all fields', 'warning');
        return;
    }

    await db.customers.add({ name, phone, address });
    showToast('Customer saved successfully!');
    hideAddCustomerForm();
    renderCustomersList();
    renderSavedCustomers();
}

async function deleteCustomer(id) {
    const result = await Swal.fire({
        title: 'Delete Customer?',
        text: "This action cannot be undone",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Yes, delete'
    });

    if (result.isConfirmed) {
        await db.customers.delete(id);
        showToast('Customer deleted');
        renderCustomersList();
        renderSavedCustomers();
    }
}

// --- EXPENSE CATEGORIES ---
async function renderExpenseCategoryButtons() {
    const categories = await db.expenseCategories.toArray();
    const container = document.getElementById('expenseCategoryButtons');

    container.innerHTML = categories.map(cat => `
        <button type="button" onclick="quickExpense('${cat.name}')" 
            class="bg-red-50 hover:bg-red-100 text-red-700 py-2 px-3 rounded-lg text-xs font-medium transition border border-red-200">
            ${cat.name}
        </button>
    `).join('');
}

async function quickExpense(category) {
    const { value: amount } = await Swal.fire({
        title: category,
        input: 'number',
        inputLabel: 'Enter amount (Rs)',
        inputPlaceholder: '0.00',
        showCancelButton: true,
        inputValidator: (value) => {
            if (!value || parseFloat(value) <= 0) {
                return 'Please enter a valid amount';
            }
        }
    });

    if (amount) {
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        await db.expenses.add({
            note: category,
            category: category,
            amount: parseFloat(amount),
            date: now.toLocaleDateString(),
            isoMonth: currentMonth,
            timestamp: Date.now()
        });

        showToast(`${category} expense added!`);
        renderExpenses();
        updateDashboardStats();
    }
}

function openNewExpenseModal() {
    const modal = document.getElementById('newExpenseModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeNewExpenseModal() {
    const modal = document.getElementById('newExpenseModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.getElementById('newExpenseForm').reset();
}

document.getElementById('newExpenseForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const category = document.getElementById('newExpenseCategory').value.trim();
    const amount = parseFloat(document.getElementById('newExpenseAmount').value);

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Add to expenses
    await db.expenses.add({
        note: category,
        category: category,
        amount: amount,
        date: now.toLocaleDateString(),
        isoMonth: currentMonth,
        timestamp: Date.now()
    });

    // Save category if new
    const existingCategory = await db.expenseCategories.get(category);
    if (!existingCategory) {
        await db.expenseCategories.add({ name: category });
        renderExpenseCategoryButtons();
    }

    showToast('Expense added successfully!');
    closeNewExpenseModal();
    renderExpenses();
    updateDashboardStats();
});

// --- ATTENDANCE ---
function openAttendanceModal() {
    const modal = document.getElementById('attendanceModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Set today's date
    document.getElementById('attendanceDate').textContent = new Date().toLocaleDateString();

    renderEmployeeAttendanceList();
}

function closeAttendanceModal() {
    const modal = document.getElementById('attendanceModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

async function renderEmployeeAttendanceList() {
    const employees = await db.employees.toArray();
    const container = document.getElementById('employeeAttendanceList');

    // Get today's attendance records
    const today = new Date().toLocaleDateString();
    const todayRecords = await db.attendance.where('date').equals(today).toArray();
    const presentEmployees = todayRecords.map(r => r.employeeName);

    container.innerHTML = employees.map(emp => {
        const isPresent = presentEmployees.includes(emp.name);
        return `
            <label class="flex items-center p-3 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-100 transition">
                <input type="checkbox" 
                    data-employee="${emp.name}" 
                    ${isPresent ? 'checked' : ''}
                    class="attendance-checkbox w-5 h-5 text-blue-600 rounded mr-3">
                <span class="font-medium text-gray-800">${emp.name}</span>
            </label>
        `;
    }).join('');
}

function showAddEmployeeForm() {
    document.getElementById('addEmployeeForm').classList.remove('hidden');
}

function hideAddEmployeeForm() {
    document.getElementById('addEmployeeForm').classList.add('hidden');
    document.getElementById('newEmployeeName').value = '';
}

async function saveNewEmployee() {
    const name = document.getElementById('newEmployeeName').value.trim();

    if (!name) {
        showToast('Please enter employee name', 'warning');
        return;
    }

    const exists = await db.employees.get(name);
    if (exists) {
        showToast('Employee already exists', 'warning');
        return;
    }

    await db.employees.add({ name });
    showToast('Employee added successfully!');
    hideAddEmployeeForm();
    renderEmployeeAttendanceList();
}

async function saveAttendance() {
    const checkboxes = document.querySelectorAll('.attendance-checkbox');
    const today = new Date().toLocaleDateString();

    // Clear today's attendance first
    const todayRecords = await db.attendance.where('date').equals(today).toArray();
    for (let record of todayRecords) {
        await db.attendance.delete(record.id);
    }

    // Add new attendance records
    for (let checkbox of checkboxes) {
        if (checkbox.checked) {
            await db.attendance.add({
                date: today,
                employeeName: checkbox.dataset.employee,
                timestamp: Date.now()
            });
        }
    }

    showToast('Attendance saved successfully!');
    closeAttendanceModal();
}

async function printAttendance() {
    const today = new Date().toLocaleDateString();
    const todayRecords = await db.attendance.where('date').equals(today).toArray();

    const printArea = document.getElementById('printArea');
    printArea.innerHTML = `
        <div class="order-card-print">
            <h2 style="text-align:center; margin-bottom: 5px;">AMAZING DECORA</h2>
            <h4 style="text-align:center; margin-top: 0; color: #555;">ATTENDANCE REPORT</h4>
            <hr style="margin: 15px 0;">
            
            <p><b>Date:</b> ${today}</p>
            <p><b>Total Present:</b> ${todayRecords.length}</p>
            
            <h3 style="margin-top: 20px; margin-bottom: 10px;">Present Employees:</h3>
            <ul style="list-style: none; padding: 0;">
                ${todayRecords.map((r, i) => `
                    <li style="padding: 8px; border-bottom: 1px solid #eee;">
                        ${i + 1}. ${r.employeeName}
                    </li>
                `).join('')}
            </ul>
            
            <div style="margin-top: 40px; text-align: center; font-size: 0.8em; color: #777;">
                <p>Printed on ${new Date().toLocaleString()}</p>
            </div>
        </div>
    `;
    window.print();
}

// Update order form to use unified customer input
const originalOrderFormHandler = document.getElementById('orderForm').onsubmit;
document.getElementById('orderForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const customerDetails = document.getElementById('customerDetailsUnified').value.trim();

    // Parse customer details
    const lines = customerDetails.split('\n').map(l => l.trim()).filter(l => l);
    const customerName = lines[0] || "Customer";

    // New logic to handle Address and Phone correctly based on improved form
    // The visual form has hidden inputs? No, the user reordered fields in visual form, but JS still gets from `customerDetailsUnified` textarea?
    // Wait, the new UI has SEPARATE inputs now? Or did I just reorder them in the `addCustomerForm`?
    // The main order form uses `textarea id="customerDetailsUnified"`.
    // KICKER: The user requested "Customer Details Form – Field Order Improvement".
    // I reordered them in the `addCustomerForm` (modal HTML), but the MAIN ORDER FORM is still a TEXTAREA.
    // "Modify the Customer Details entry form field order as follows: Customer Name, Customer Address, Customer Phone Number"
    // The main form is a textarea. Maybe the user wants 3 inputs in the main form too?
    // The user saw "John Doe \n 077... \n No 5..." in the placeholder.
    // If I split the textarea, I generally assume Name \n Phone \n Address.
    // User wants Name -> Address -> Phone.
    // I should update the parsing logic if the user enters it that way.
    // But since it's a textarea, it's free text.
    // However, I should probably respect the new convention: Line 1 Name, Line 2 Address, Line 3 Phone.

    let customerAddress = "N/A";
    let customerPhone = "N/A";

    if (lines.length > 1) customerAddress = lines[1];
    if (lines.length > 2) customerPhone = lines[2];

    // Build items list with prices
    const prices = await db.prices.toArray();
    const priceMap = {};
    prices.forEach(p => {
        priceMap[p.itemName] = p.price;
    });

    let itemsList = [];
    let orderTotal = 0;

    for (let itemName in selectedItems) {
        const quantity = selectedItems[itemName];
        if (quantity > 0) {
            const price = priceMap[itemName] || 0;
            const itemTotal = quantity * price;
            orderTotal += itemTotal;
            itemsList.push({
                name: itemName,
                quantity: quantity,
                price: price,
                total: itemTotal
            });
        }
    }

    if (itemsList.length === 0) {
        showToast('Please select at least one item', 'warning');
        return;
    }

    // Create details string for compatibility
    const detailsText = itemsList.map(item =>
        `${item.name} * ${item.quantity} @ Rs ${item.price.toFixed(2)} = Rs ${item.total.toFixed(2)}`
    ).join('\n');

    const orderData = {
        customerName: customerName,
        address: customerAddress,
        phone: customerPhone,
        details: detailsText,
        items: itemsList,
        orderTotal: orderTotal,
        paymentStatus: document.getElementById('payStatus').value,
        status: 'pending',
        date: new Date().toLocaleDateString(),
        timestamp: Date.now()
    };

    try {
        await db.orders.add(orderData);
        showToast('Order created successfully!');

        // Reset form
        e.target.reset();
        selectedItems = {};
        renderItemsCatalogue();

        updateDashboardStats();
        if (currentTab === 'workshop') renderWorkshopOrders();
    } catch (err) {
        showToast('Error creating order', 'error');
        console.error(err);
    }
});
// --- REPORTING ---
async function printOrderReport() {
    const fromDate = document.getElementById('orderReportFrom').value;
    const toDate = document.getElementById('orderReportTo').value;

    let orders = await db.orders.where('status').equals('completed').toArray();

    if (fromDate || toDate) {
        const from = fromDate ? new Date(fromDate).getTime() : 0;
        const to = toDate ? new Date(toDate).getTime() + 86399999 : Infinity;
        orders = orders.filter(o => {
            // Fallback to date string if timestamp missing
            let time = o.completedTimestamp || o.timestamp;
            if (!time && o.date) time = new Date(o.date).getTime();
            return time >= from && time <= to;
        });
    }

    const total = orders.reduce((sum, o) => sum + parseFloat(o.orderTotal || 0), 0);

    const printArea = document.getElementById('printArea');
    printArea.innerHTML = `
        <div class="order-card-print">
            <h2 style="text-align:center; margin-bottom: 5px;">AMAZING DECORA</h2>
            <h4 style="text-align:center; margin-top: 0; color: #555;">COMPLETED ORDERS SUMMARY</h4>
            <p style="text-align:center; font-size: 0.8em; color: #777;">Range: ${fromDate || 'All'} to ${toDate || 'All'}</p>
            <hr style="margin: 15px 0;">

            <table style="width: 100%; border-collapse: collapse; font-size: 0.9em;">
                <thead>
                    <tr style="border-bottom: 2px solid #000;">
                        <th style="text-align: left; padding: 5px;">Date</th>
                        <th style="text-align: left; padding: 5px;">Customer</th>
                        <th style="text-align: right; padding: 5px;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${orders.sort((a, b) => b.timestamp - a.timestamp).map(o => `
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 5px;">${o.date}</td>
                            <td style="padding: 5px;">${o.customerName}</td>
                            <td style="padding: 5px; text-align: right;">${formatCurrency(o.orderTotal || 0)}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="border-top: 2px solid #000;">
                        <td colspan="2" style="text-align: right; padding: 10px; font-weight: bold;">TOTAL:</td>
                        <td style="text-align: right; padding: 10px; font-weight: bold;">${formatCurrency(total)}</td>
                    </tr>
                </tfoot>
            </table>

            <div style="margin-top: 40px; text-align: center; font-size: 0.8em; color: #777;">
                <p>Printed on ${new Date().toLocaleString()}</p>
            </div>
        </div>
    `;
    window.print();
}

async function printExpenseReport() {
    const fromDate = document.getElementById('expenseReportFrom').value;
    const toDate = document.getElementById('expenseReportTo').value;

    let expenses = await db.expenses.toArray();

    if (fromDate || toDate) {
        const from = fromDate ? new Date(fromDate).getTime() : 0;
        const to = toDate ? new Date(toDate).getTime() + 86399999 : Infinity;
        expenses = expenses.filter(e => {
            // Fallback to date string if timestamp missing
            let time = e.timestamp;
            if (!time && e.date) time = new Date(e.date).getTime();
            return (time || 0) >= from && (time || 0) <= to;
        });
    }

    const total = expenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

    // Group by category for the report
    const grouped = {};
    expenses.forEach(e => {
        const cat = e.category || "Uncategorized";
        if (!grouped[cat]) grouped[cat] = 0;
        grouped[cat] += parseFloat(e.amount || 0);
    });

    const printArea = document.getElementById('printArea');
    printArea.innerHTML = `
        <div class="order-card-print">
            <h2 style="text-align:center; margin-bottom: 5px;">AMAZING DECORA</h2>
            <h4 style="text-align:center; margin-top: 0; color: #555;">EXPENSE REPORT</h4>
            <p style="text-align:center; font-size: 0.8em; color: #777;">Range: ${fromDate || 'All'} to ${toDate || 'All'}</p>
            <hr style="margin: 15px 0;">

            <h3 style="margin-bottom: 10px;">Category Summary:</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 0.9em; margin-bottom: 20px;">
                ${Object.keys(grouped).sort().map(cat => `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 5px;">${cat}</td>
                        <td style="padding: 5px; text-align: right; font-weight: bold;">${formatCurrency(grouped[cat])}</td>
                    </tr>
                `).join('')}
            </table>

            <h3 style="margin-bottom: 10px;">Itemized List:</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 0.8em; page-break-inside: auto;">
                <thead>
                    <tr style="border-bottom: 2px solid #000;">
                        <th style="text-align: left; padding: 5px;">Date</th>
                        <th style="text-align: left; padding: 5px;">Category</th>
                        <th style="text-align: left; padding: 5px;">Note</th>
                        <th style="text-align: right; padding: 5px;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${expenses.sort((a, b) => b.timestamp - a.timestamp).map(e => `
                        <tr style="border-bottom: 1px solid #eee; page-break-inside: avoid;">
                            <td style="padding: 5px;">${e.date}</td>
                            <td style="padding: 5px;">${e.category || 'N/A'}</td>
                            <td style="padding: 5px;">${e.note}</td>
                            <td style="padding: 5px; text-align: right;">${formatCurrency(e.amount)}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="border-top: 2px solid #000;">
                        <td colspan="3" style="text-align: right; padding: 10px; font-weight: bold;">TOTAL:</td>
                        <td style="text-align: right; padding: 10px; font-weight: bold;">${formatCurrency(total)}</td>
                    </tr>
                </tfoot>
            </table>

            <div style="margin-top: 40px; text-align: center; font-size: 0.8em; color: #777;">
                <p>Printed on ${new Date().toLocaleString()}</p>
            </div>
        </div>
    `;
    window.print();
}

// ==== NEW FEATURES: PRODUCT MANAGER, ANALYTICS, AUTH ====

// --- PRODUCT MANAGER ---
async function openProductManagerModal() {
    const modal = document.getElementById('productManagerModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    renderProductManagerList();
}

function closeProductManagerModal() {
    const modal = document.getElementById('productManagerModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.getElementById('newProdName').value = '';
    document.getElementById('newProdPrice').value = '';
}

async function renderProductManagerList() {
    const stock = await db.stock.toArray();
    const prices = await db.prices.toArray();
    const priceMap = {};
    prices.forEach(p => priceMap[p.itemName] = p.price);

    const container = document.getElementById('productListManager');
    if (!container) return;

    if (stock.length === 0) {
        container.innerHTML = '<p class="col-span-2 text-center text-gray-400">No products found.</p>';
        return;
    }

    container.innerHTML = stock.map(item => `
        <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 flex justify-between items-center">
            <div>
                <h5 class="font-bold text-gray-800">${item.itemSize}</h5>
                <p class="text-xs text-gray-500">Current Stock: ${item.quantity} | Price: Rs ${priceMap[item.itemSize] || 0}</p>
            </div>
            <button onclick="deleteProduct('${item.itemSize}')" class="text-red-600 hover:text-red-800 p-2 rounded hover:bg-red-50 transition">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

async function addNewProduct() {
    const name = document.getElementById('newProdName').value.trim();
    const priceStr = document.getElementById('newProdPrice').value;
    const price = parseFloat(priceStr);

    if (!name || isNaN(price)) {
        showToast('Please enter valid product name and price', 'warning');
        return;
    }

    const exists = await db.stock.get(name);
    if (exists) {
        showToast('Product already exists', 'warning');
        return;
    }

    // Add to stock and prices
    await db.stock.add({ itemSize: name, quantity: 0 });
    await db.prices.put({ itemName: name, price: price });

    showToast('Product added successfully!');
    document.getElementById('newProdName').value = '';
    document.getElementById('newProdPrice').value = '';
    renderProductManagerList();
    renderItemsCatalogue(); // Update main UI
}

async function deleteProduct(itemName) {
    const result = await Swal.fire({
        title: 'Delete Product?',
        text: `Delete "${itemName}"? This will remove it from stock and catalogue.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Yes, Delete'
    });

    if (result.isConfirmed) {
        await db.stock.delete(itemName);
        await db.prices.delete(itemName);
        showToast('Product deleted');
        renderProductManagerList();
        renderItemsCatalogue();
    }
}

// --- ORDER DETAILS VIEW ---
async function viewOrderDetails(id) {
    const order = await db.orders.get(id);
    const container = document.getElementById('orderDetailsContent');
    const modal = document.getElementById('orderDetailsModal');

    // Parse Items or Use Stored Items
    let itemsHtml = '';
    if (order.items && order.items.length > 0) {
        itemsHtml = `
            <table class="w-full text-sm border-collapse">
                <thead>
                    <tr class="bg-gray-50 border-b border-gray-200 text-left">
                        <th class="p-2">Item</th>
                        <th class="p-2 text-right">Qty</th>
                        <th class="p-2 text-right">Price</th>
                        <th class="p-2 text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${order.items.map(item => `
                        <tr class="border-b border-gray-100">
                            <td class="p-2 font-medium">${item.name}</td>
                            <td class="p-2 text-right">${item.quantity}</td>
                            <td class="p-2 text-right">${formatCurrency(item.price)}</td>
                            <td class="p-2 text-right font-bold">${formatCurrency(item.total)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } else {
        itemsHtml = `<pre class="bg-gray-50 p-4 rounded-lg font-mono text-sm whitespace-pre-wrap">${order.details}</pre>`;
    }

    container.innerHTML = `
        <div class="space-y-4">
            <div class="flex justify-between items-start bg-green-50 p-4 rounded-lg border border-green-100">
                <div>
                    <h3 class="font-bold text-lg text-green-900">${order.customerName}</h3>
                    <p class="text-xs text-green-600 mt-1">${order.address}</p>
                    <p class="text-sm text-green-700">${order.phone}</p>
                </div>
                <div class="text-right">
                    <span class="block text-2xl font-bold text-green-700">${formatCurrency(order.orderTotal || 0)}</span>
                    <span class="text-xs uppercase font-bold tracking-wide ${order.paymentStatus === 'Paid' ? 'text-green-600' : 'text-red-500'}">
                        ${order.paymentStatus}
                    </span>
                </div>
            </div>
            
            <div>
                <h4 class="font-bold text-gray-700 mb-2">Requested Items</h4>
                ${itemsHtml}
            </div>
            
            <div class="flex justify-end pt-4">
                <button onclick="printOrder(${order.id})" class="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold transition flex items-center">
                    <i class="fas fa-print mr-2"></i> Print Invoice
                </button>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeOrderDetailsModal() {
    const modal = document.getElementById('orderDetailsModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

// --- SALES ANALYTICS ---
let salesChartInstance = null;

function openExternalAnalytics() {
    const modal = document.getElementById('salesAnalyticsModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    renderSalesChart();
}

function closeAnalyticsModal() {
    const modal = document.getElementById('salesAnalyticsModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

async function renderSalesChart() {
    const fromDate = document.getElementById('chartFrom').value;
    const toDate = document.getElementById('chartTo').value;
    const canvas = document.getElementById('salesChart');

    // Fetch orders
    let orders = await db.orders.where('status').equals('completed').toArray();

    if (fromDate || toDate) {
        const from = fromDate ? new Date(fromDate).getTime() : 0;
        const to = toDate ? new Date(toDate).getTime() + 86399999 : Infinity;
        orders = orders.filter(o => (o.completedTimestamp || o.timestamp) >= from && (o.completedTimestamp || o.timestamp) <= to);
    }

    // Aggregate Item Sales
    const itemSales = {};
    for (let order of orders) {
        if (order.items && Array.isArray(order.items)) {
            order.items.forEach(item => {
                if (!itemSales[item.name]) itemSales[item.name] = 0;
                itemSales[item.name] += item.quantity;
            });
        }
    }

    const labels = Object.keys(itemSales);
    const data = Object.values(itemSales);

    if (salesChartInstance) {
        salesChartInstance.destroy();
    }

    if (labels.length === 0) {
        // Handle empty
    }

    salesChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Units Sold',
                data: data,
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grace: '5%'
                }
            }
        }
    });
}

function printChart() {
    const canvas = document.getElementById('salesChart');
    const win = window.open('', 'Print Chart', 'height=600,width=800');
    win.document.write(`
        <html>
            <head>
                <title>Sales Analytics Chart</title>
                <style>
                    body { font-family: sans-serif; text-align: center; padding: 20px; }
                    img { max-width: 100%; border: 1px solid #ccc; }
                </style>
            </head>
        <body>
            <h2>Sales Analytics Report</h2>
            <p>Generated on ${new Date().toLocaleString()}</p>
            <img src="${canvas.toDataURL()}" />
            <script>
                window.onload = function() { window.print(); }
            </script>
        </body>
        </html>
    `);
    win.document.close();
}

// --- ADMIN AUTHENTICATION ---
const ADMIN_USER = "admin";
const ADMIN_PASS = "admin123"; // Default password
let isAuthenticated = false;

// Check on load
document.addEventListener('DOMContentLoaded', () => {
    // If we are on admin tab and not authed, show login
    // But to be user-friendly, let's default to Workshop if on mobile or just show login
    // The user wants admin protected.
    // If they refresh, they are back to admin tab (default).
    // We can leave it as is, but ensure the "Go to Workshop" button works.
    const adminSection = document.getElementById('admin-section');
    if (currentTab === 'admin' && !isAuthenticated) {
        document.getElementById('adminLoginModal').classList.remove('hidden');
        document.getElementById('adminLoginModal').classList.add('flex');
    }
});

function switchToWorkshop() {
    document.getElementById('adminLoginModal').classList.add('hidden');
    document.getElementById('adminLoginModal').classList.remove('flex');
    switchTab('workshop');
}

// Intercept admin tab switch
const originalSwitchTab = switchTab;
switchTab = function (tab) {
    if (tab === 'admin' && !isAuthenticated) {
        document.getElementById('adminLoginModal').classList.remove('hidden');
        document.getElementById('adminLoginModal').classList.add('flex');
        return; // Block switch
    }
    originalSwitchTab(tab);
}

document.getElementById('adminLoginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const u = document.getElementById('adminUsername').value;
    const p = document.getElementById('adminPassword').value;

    if (u === ADMIN_USER && p === ADMIN_PASS) {
        isAuthenticated = true;
        document.getElementById('adminLoginModal').classList.add('hidden');
        document.getElementById('adminLoginModal').classList.remove('flex');
        switchTab('admin');
        showToast('Login successful', 'success');
    } else {
        showToast('Invalid credentials', 'error');
    }
});

// --- ATTENDANCE REPORTING ---
async function openAttendanceReportModal() {
    const modal = document.getElementById('attendanceReportModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Default date range: current month
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const formatDate = (d) => {
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${d.getFullYear()}-${month}-${day}`;
    };

    document.getElementById('attendanceFromDate').value = formatDate(firstDay);
    document.getElementById('attendanceToDate').value = formatDate(lastDay);

    await renderAttendanceReport();
}

function closeAttendanceReportModal() {
    const modal = document.getElementById('attendanceReportModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

async function renderAttendanceReport() {
    const fromStr = document.getElementById('attendanceFromDate').value;
    const toStr = document.getElementById('attendanceToDate').value;

    const container = document.getElementById('attendanceReportList');

    let records = await db.attendance.toArray();

    if (fromStr || toStr) {
        const fromDate = fromStr ? new Date(fromStr).getTime() : 0;
        const toDate = toStr ? new Date(toStr).getTime() + 86399999 : Infinity;

        records = records.filter(r => {
            let time = r.timestamp;
            if (!time && r.date) time = new Date(r.date).getTime();
            return time >= fromDate && time <= toDate;
        });
    }

    if (records.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 py-4">No attendance records found for this period.</p>';
        return;
    }

    const counts = {};
    records.forEach(r => {
        counts[r.employeeName] = (counts[r.employeeName] || 0) + 1;
    });

    container.innerHTML = `
        <table class="w-full text-sm text-left">
            <thead class="bg-blue-100 text-blue-800">
                <tr>
                    <th class="p-3 rounded-l-lg">Employee Name</th>
                    <th class="p-3 text-center rounded-r-lg">Days Present</th>
                </tr>
            </thead>
            <tbody>
                ${Object.keys(counts).sort().map(name => `
                    <tr class="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                        <td class="p-3 font-medium text-gray-800">${name}</td>
                        <td class="p-3 text-center font-bold text-blue-600">${counts[name]}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function printAttendanceReport() {
    const fromStr = document.getElementById('attendanceFromDate').value;
    const toStr = document.getElementById('attendanceToDate').value;

    let records = await db.attendance.toArray();

    if (fromStr || toStr) {
        const fromDate = fromStr ? new Date(fromStr).getTime() : 0;
        const toDate = toStr ? new Date(toStr).getTime() + 86399999 : Infinity;

        records = records.filter(r => {
            let time = r.timestamp;
            if (!time && r.date) time = new Date(r.date).getTime();
            return time >= fromDate && time <= toDate;
        });
    }

    const counts = {};
    records.forEach(r => {
        counts[r.employeeName] = (counts[r.employeeName] || 0) + 1;
    });

    const printArea = document.getElementById('printArea');
    printArea.innerHTML = `
        <div class="order-card-print">
            <h2 style="text-align:center; margin-bottom: 5px;">AMAZING DECORA</h2>
            <h4 style="text-align:center; margin-top: 0; color: #555;">ATTENDANCE SUMMARY</h4>
            <p style="text-align:center; font-size: 0.8em; color: #777;">Range: ${fromStr || 'All'} to ${toStr || 'All'}</p>
            <hr style="margin: 15px 0;">
            
            <table style="width: 100%; border-collapse: collapse; font-size: 0.9em;">
                <thead>
                    <tr style="border-bottom: 2px solid #000;">
                        <th style="text-align: left; padding: 5px;">Employee Name</th>
                        <th style="text-align: right; padding: 5px;">Days Present</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.keys(counts).sort().map(name => `
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 5px;">${name}</td>
                            <td style="padding: 5px; text-align: right;">${counts[name]}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div style="margin-top: 40px; text-align: center; font-size: 0.8em; color: #777;">
                <p>Printed on ${new Date().toLocaleString()}</p>
            </div>
        </div>
    `;
    window.print();
}

// --- EXPENSES CHART LOGIC ---
let expenseChartInstance = null;

function toggleExpenseChart() {
    const listContainer = document.getElementById('expenseReportList');
    const chartContainer = document.getElementById('expenseChartContainer');
    const printChartBtn = document.getElementById('printExpenseChartBtn');

    if (chartContainer.classList.contains('hidden')) {
        listContainer.classList.add('hidden');
        chartContainer.classList.remove('hidden');
        if (printChartBtn) {
            printChartBtn.classList.remove('hidden');
            printChartBtn.classList.add('flex');
        }
        renderExpenseChart();
    } else {
        chartContainer.classList.add('hidden');
        listContainer.classList.remove('hidden');
        if (printChartBtn) {
            printChartBtn.classList.add('hidden');
            printChartBtn.classList.remove('flex');
        }
    }
}

function printExpenseChart() {
    const canvas = document.getElementById('expenseChart');
    const win = window.open('', 'Print Chart', 'height=600,width=800');
    win.document.write(`
        <html>
            <head>
                <title>Expense Analytics Chart</title>
                <style>
                    body { font-family: sans-serif; text-align: center; padding: 20px; }
                    img { max-width: 100%; border: 1px solid #ccc; margin-top: 20px;}
                </style>
            </head>
        <body>
            <h2>Expense Analytics Report</h2>
            <p>Generated on ${new Date().toLocaleString()}</p>
            <img src="${canvas.toDataURL()}" />
            <script>
                window.onload = function() { window.print(); }
            </script>
        </body>
        </html>
    `);
    win.document.close();
}

async function renderExpenseChart() {
    const fromDateStr = document.getElementById('expenseReportFrom').value;
    const toDateStr = document.getElementById('expenseReportTo').value;
    const canvas = document.getElementById('expenseChart');

    let expenses = await db.expenses.toArray();

    if (fromDateStr || toDateStr) {
        const from = fromDateStr ? new Date(fromDateStr).getTime() : 0;
        const to = toDateStr ? new Date(toDateStr).getTime() + 86399999 : Infinity;
        expenses = expenses.filter(e => {
            const time = e.timestamp || 0;
            return time >= from && time <= to;
        });
    }

    const categorySummary = {};
    expenses.forEach(e => {
        const cat = e.category || "Uncategorized";
        if (!categorySummary[cat]) categorySummary[cat] = 0;
        categorySummary[cat] += parseFloat(e.amount || 0);
    });

    const labels = Object.keys(categorySummary);
    const data = Object.values(categorySummary);

    if (expenseChartInstance) {
        expenseChartInstance.destroy();
    }

    expenseChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Expenses (Rs)',
                data: data,
                backgroundColor: 'rgba(239, 68, 68, 0.6)',
                borderColor: 'rgba(239, 68, 68, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grace: '5%'
                }
            }
        }
    });
}
