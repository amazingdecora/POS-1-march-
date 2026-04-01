import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { apiAdmin } from '../api';
import { formatCurrency } from '../format';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface Stats {
  pendingCount: number;
  completedCount: number;
  completedOrdersValue: number;
  totalExpenses: number;
  attendanceThisMonth: number;
}

interface StockRow {
  itemSize: string;
  quantity: number;
}

interface PriceRow {
  itemName: string;
  price: number;
}

interface Order {
  id: number;
  customerName: string;
  address: string;
  phone: string;
  details: string;
  items?: Array<{ name: string; quantity: number; price: number; total: number }>;
  orderTotal: number | null;
  paymentStatus: string;
  status: string;
  date: string;
  timestamp: number;
  completionDate?: string;
  completedTimestamp?: number;
}

interface Expense {
  id: number;
  note: string;
  category: string;
  amount: number;
  date: string;
  timestamp: number;
}

interface Customer {
  id: number;
  name: string;
  phone: string;
  address: string;
}

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [customerText, setCustomerText] = useState('');
  const [payStatus, setPayStatus] = useState('Paid');
  const [msg, setMsg] = useState('');

  const [modal, setModal] = useState<
    | null
    | 'completed'
    | 'expenseReport'
    | 'prices'
    | 'customers'
    | 'products'
    | 'analytics'
    | 'attendanceReport'
    | 'newExpense'
  >(null);

  const [orderFrom, setOrderFrom] = useState('');
  const [orderTo, setOrderTo] = useState('');
  const [completedList, setCompletedList] = useState<Order[]>([]);

  const [expFrom, setExpFrom] = useState('');
  const [expTo, setExpTo] = useState('');
  const [expenseReportRows, setExpenseReportRows] = useState<Expense[]>([]);

  const [priceEdits, setPriceEdits] = useState<Record<string, number>>({});
  const [stockEdits, setStockEdits] = useState<Record<string, number>>({});

  const [newCust, setNewCust] = useState({ name: '', phone: '', address: '' });
  const [newProd, setNewProd] = useState({ name: '', price: '' });
  const [newExp, setNewExp] = useState({ category: '', amount: '' });

  const [chartFrom, setChartFrom] = useState('');
  const [chartTo, setChartTo] = useState('');
  const [chartData, setChartData] = useState<{ labels: string[]; data: number[] }>({ labels: [], data: [] });

  const [attFrom, setAttFrom] = useState('');
  const [attTo, setAttTo] = useState('');
  const [attReport, setAttReport] = useState<Array<{ name: string; daysPresent: number }>>([]);

  const priceMap = useMemo(() => {
    const m: Record<string, number> = {};
    prices.forEach(p => { m[p.itemName] = p.price; });
    return m;
  }, [prices]);

  const orderTotal = useMemo(() => {
    let t = 0;
    Object.entries(selectedItems).forEach(([name, qty]) => {
      t += qty * (priceMap[name] ?? 0);
    });
    return t;
  }, [selectedItems, priceMap]);

  const loadAll = useCallback(async () => {
    try {
      const [st, stRows, pr, cats, ex, cust] = await Promise.all([
        apiAdmin<Stats>('/dashboard/stats'),
        apiAdmin<StockRow[]>('/stock'),
        apiAdmin<PriceRow[]>('/prices'),
        apiAdmin<string[]>('/expense-categories'),
        apiAdmin<Expense[]>('/expenses?limit=10'),
        apiAdmin<Customer[]>('/customers')
      ]);
      setStats(st);
      setStock(stRows);
      setPrices(pr);
      setCategories(cats);
      setExpenses(ex);
      setCustomers(cust);
      const se: Record<string, number> = {};
      stRows.forEach(s => { se[s.itemSize] = s.quantity; });
      setStockEdits(se);
    } catch (e) {
      setMsg(String(e));
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const updateQty = (name: string, delta: number) => {
    setSelectedItems(prev => {
      const q = Math.max(0, (prev[name] ?? 0) + delta);
      const next = { ...prev };
      if (q === 0) delete next[name];
      else next[name] = q;
      return next;
    });
  };

  const submitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = customerText.split('\n').map(l => l.trim()).filter(Boolean);
    const customerName = lines[0] ?? 'Customer';
    const address = lines[1] ?? 'N/A';
    const phone = lines[2] ?? 'N/A';

    const itemsList: Array<{ name: string; quantity: number; price: number; total: number }> = [];
    for (const [name, quantity] of Object.entries(selectedItems)) {
      if (quantity <= 0) continue;
      const price = priceMap[name] ?? 0;
      itemsList.push({ name, quantity, price, total: quantity * price });
    }
    if (itemsList.length === 0) {
      window.alert('Select at least one item');
      return;
    }
    const detailsText = itemsList.map(
      i => `${i.name} * ${i.quantity} @ Rs ${i.price.toFixed(2)} = Rs ${i.total.toFixed(2)}`
    ).join('\n');

    try {
      await apiAdmin('/orders', {
        method: 'POST',
        body: JSON.stringify({
          customerName,
          address,
          phone,
          details: detailsText,
          items: itemsList,
          orderTotal: orderTotal,
          paymentStatus: payStatus,
          date: new Date().toLocaleDateString(),
          timestamp: Date.now()
        })
      });
      setCustomerText('');
      setSelectedItems({});
      setMsg('Order created');
      void loadAll();
    } catch (err) {
      setMsg(String(err));
    }
  };

  const saveStock = async () => {
    const items = stock.map(s => ({ itemSize: s.itemSize, quantity: stockEdits[s.itemSize] ?? s.quantity }));
    try {
      await apiAdmin('/stock', { method: 'PUT', body: JSON.stringify({ items }) });
      setMsg('Stock saved');
      void loadAll();
    } catch (e) {
      setMsg(String(e));
    }
  };

  const quickExpense = async (cat: string) => {
    const amountStr = window.prompt(`Amount for ${cat} (Rs)`);
    if (amountStr === null) return;
    const amount = parseFloat(amountStr);
    if (Number.isNaN(amount) || amount <= 0) return;
    const now = new Date();
    const isoMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    try {
      await apiAdmin('/expenses', {
        method: 'POST',
        body: JSON.stringify({
          note: cat,
          category: cat,
          amount,
          date: now.toLocaleDateString(),
          isoMonth,
          timestamp: Date.now()
        })
      });
      void loadAll();
    } catch (e) {
      setMsg(String(e));
    }
  };

  const openCompleted = async () => {
    setModal('completed');
    const list = await apiAdmin<Order[]>(`/orders?status=completed`);
    setCompletedList(list);
  };

  const filterCompleted = async () => {
    const q = new URLSearchParams({ status: 'completed' });
    if (orderFrom) q.set('from', orderFrom);
    if (orderTo) q.set('to', orderTo);
    const list = await apiAdmin<Order[]>(`/orders?${q.toString()}`);
    setCompletedList(list);
  };

  const openExpenseReport = async () => {
    setModal('expenseReport');
    const all = await apiAdmin<Expense[]>('/expenses');
    setExpenseReportRows(all);
  };

  const filteredExpenses = useMemo(() => {
    let list = expenseReportRows;
    if (expFrom || expTo) {
      const fromT = expFrom ? new Date(expFrom).getTime() : 0;
      const toT = expTo ? new Date(expTo).getTime() + 86399999 : Infinity;
      list = list.filter(e => {
        const t = e.timestamp ?? 0;
        return t >= fromT && t <= toT;
      });
    }
    return list;
  }, [expenseReportRows, expFrom, expTo]);

  const expenseTotal = useMemo(
    () => filteredExpenses.reduce((s, e) => s + e.amount, 0),
    [filteredExpenses]
  );

  const openPrices = () => {
    const pe: Record<string, number> = {};
    prices.forEach(p => { pe[p.itemName] = p.price; });
    setPriceEdits(pe);
    setModal('prices');
  };

  const savePrices = async () => {
    const arr = Object.entries(priceEdits).map(([itemName, price]) => ({ itemName, price }));
    await apiAdmin('/prices', { method: 'PUT', body: JSON.stringify({ prices: arr }) });
    setModal(null);
    void loadAll();
  };

  const saveNewExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(newExp.amount);
    if (Number.isNaN(amount)) return;
    const now = new Date();
    await apiAdmin('/expenses', {
      method: 'POST',
      body: JSON.stringify({
        note: newExp.category,
        category: newExp.category,
        amount,
        date: now.toLocaleDateString(),
        isoMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
        timestamp: Date.now()
      })
    });
    setNewExp({ category: '', amount: '' });
    setModal(null);
    void loadAll();
  };

  const saveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiAdmin('/customers', {
      method: 'POST',
      body: JSON.stringify(newCust)
    });
    setNewCust({ name: '', phone: '', address: '' });
    const cust = await apiAdmin<Customer[]>('/customers');
    setCustomers(cust);
  };

  const addProduct = async () => {
    const price = parseFloat(newProd.price);
    if (!newProd.name.trim() || Number.isNaN(price)) return;
    await apiAdmin('/products', { method: 'POST', body: JSON.stringify({ name: newProd.name.trim(), price }) });
    setNewProd({ name: '', price: '' });
    void loadAll();
  };

  const deleteProduct = async (name: string) => {
    if (!window.confirm(`Delete ${name}?`)) return;
    await apiAdmin(`/products/${encodeURIComponent(name)}`, { method: 'DELETE' });
    void loadAll();
  };

  const loadChart = async () => {
    const q = new URLSearchParams();
    if (chartFrom) q.set('from', chartFrom);
    if (chartTo) q.set('to', chartTo);
    const d = await apiAdmin<{ labels: string[]; data: number[] }>(`/analytics/item-sales?${q.toString()}`);
    setChartData(d);
  };

  const loadAttReport = async () => {
    const q = new URLSearchParams();
    if (attFrom) q.set('from', attFrom);
    if (attTo) q.set('to', attTo);
    const rows = await apiAdmin<Array<{ name: string; daysPresent: number }>>(`/attendance/report?${q.toString()}`);
    setAttReport(rows);
  };

  useEffect(() => {
    if (modal === 'analytics') void loadChart();
  }, [modal]);

  useEffect(() => {
    if (modal === 'attendanceReport') {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const f = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      setAttFrom(f(first));
      setAttTo(f(last));
    }
  }, [modal]);

  useEffect(() => {
    if (modal === 'attendanceReport' && attFrom && attTo) void loadAttReport();
  }, [modal, attFrom, attTo]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {msg !== '' && (
        <div className="text-sm text-green-800 bg-green-50 px-3 py-2 rounded-lg border border-green-200">{msg}</div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start gap-2">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800">Admin Dashboard</h2>
          <p className="text-gray-500 text-sm md:text-base">Orders, expenses, inventory</p>
        </div>
        <span className="bg-white px-3 py-1 rounded-full shadow text-sm text-gray-600">
          {new Date().toLocaleDateString()}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border flex items-center gap-4">
          <div className="p-3 bg-orange-100 text-orange-600 rounded-xl text-2xl">⏱</div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Pending</p>
            <h3 className="text-2xl font-bold">{stats?.pendingCount ?? '—'}</h3>
          </div>
        </div>
        <button type="button" onClick={() => void openCompleted()} className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border flex items-center gap-4 text-left hover:shadow-md w-full">
          <div className="p-3 bg-green-100 text-green-600 rounded-xl text-2xl">✓</div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Completed</p>
            <h3 className="text-2xl font-bold">{stats?.completedCount ?? '—'}</h3>
            <p className="text-sm font-bold text-green-700">{stats != null ? formatCurrency(stats.completedOrdersValue) : ''}</p>
          </div>
        </button>
        <button type="button" onClick={() => void openExpenseReport()} className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border flex items-center gap-4 text-left hover:shadow-md w-full">
          <div className="p-3 bg-red-100 text-red-600 rounded-xl text-2xl">₨</div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Total expenses</p>
            <h3 className="text-xl font-bold truncate">{stats != null ? formatCurrency(stats.totalExpenses) : '—'}</h3>
          </div>
        </button>
        <button type="button" onClick={() => { setModal('analytics'); }} className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border flex items-center gap-4 text-left hover:shadow-md w-full">
          <div className="p-3 bg-purple-100 text-purple-600 rounded-xl text-2xl">▤</div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Sales analytics</p>
            <p className="text-sm font-bold text-purple-600">Charts</p>
          </div>
        </button>
        <button type="button" onClick={() => { setModal('attendanceReport'); }} className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border flex items-center gap-4 text-left hover:shadow-md w-full lg:col-span-1">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-xl text-2xl">👥</div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Attendance (month)</p>
            <h3 className="text-2xl font-bold">{stats?.attendanceThisMonth ?? '—'}</h3>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border p-4 md:p-6">
          <h3 className="text-lg font-bold mb-4">Create new order</h3>
          <form onSubmit={e => void submitOrder(e)} className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
              <div className="flex justify-between mb-2">
                <span className="font-bold">Customer (name, address, phone — one per line)</span>
                <button type="button" onClick={() => setModal('customers')} className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                  Manage customers
                </button>
              </div>
              <textarea
                required
                rows={4}
                className="w-full border rounded-lg p-2 font-mono text-sm"
                value={customerText}
                onChange={e => setCustomerText(e.target.value)}
                placeholder="John Doe&#10;No 5, Flower Rd&#10;077-1234567"
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {customers.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCustomerText(`${c.name}\n${c.address}\n${c.phone}`)}
                    className="text-xs bg-blue-100 px-2 py-1 rounded"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-xl border border-green-200">
              <div className="flex justify-between mb-2 flex-wrap gap-2">
                <span className="font-bold">Items</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setModal('products')} className="text-xs bg-green-600 text-white px-2 py-1 rounded">Products</button>
                  <button type="button" onClick={openPrices} className="text-xs bg-orange-500 text-white px-2 py-1 rounded">Prices</button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                {stock.map(s => {
                  const q = selectedItems[s.itemSize] ?? 0;
                  const pr = priceMap[s.itemSize] ?? 0;
                  return (
                    <div key={s.itemSize} className="bg-white border rounded-lg p-3">
                      <div className="flex justify-between text-sm">
                        <span className="font-bold">{s.itemSize}</span>
                        <span className="text-green-600 font-bold">Rs {pr.toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-gray-500">Stock: {s.quantity}</p>
                      <div className="flex items-center justify-between mt-2">
                        <button type="button" disabled={q === 0} onClick={() => updateQty(s.itemSize, -1)} className="w-8 h-8 rounded-full bg-red-100 text-red-600 font-bold">−</button>
                        <span className="font-bold text-lg">{q}</span>
                        <button type="button" onClick={() => updateQty(s.itemSize, 1)} className="w-8 h-8 rounded-full bg-green-100 text-green-600 font-bold">+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-4 border-t border-green-300 flex justify-between font-bold">
                <span>Total</span>
                <span className="text-green-700 text-xl">{formatCurrency(orderTotal)}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Payment</label>
              <select value={payStatus} onChange={e => setPayStatus(e.target.value)} className="w-full border rounded-lg p-2 bg-gray-50">
                <option value="Paid">Paid</option>
                <option value="Not Paid">Not Paid</option>
              </select>
            </div>
            <button type="submit" className="w-full md:w-auto bg-black text-white font-bold py-3 px-6 rounded-xl">Send to workshop</button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border p-4 md:p-6">
            <h3 className="font-bold mb-3">Quick expenses</h3>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {categories.map(c => (
                <button key={c} type="button" onClick={() => void quickExpense(c)} className="text-xs bg-red-50 border border-red-200 text-red-700 py-2 rounded">
                  {c}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setModal('newExpense')} className="w-full bg-purple-600 text-white py-2 rounded text-sm font-medium">
              New expense
            </button>
            <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
              {expenses.map(e => (
                <div key={e.id} className="flex justify-between text-sm bg-gray-50 p-2 rounded">
                  <span>{e.note}</span>
                  <span className="text-red-600 font-bold">{formatCurrency(e.amount)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border p-4 md:p-6">
            <div className="flex justify-between mb-3">
              <h3 className="font-bold">Stock</h3>
              <button type="button" onClick={() => void saveStock()} className="text-xs bg-blue-600 text-white px-2 py-1 rounded font-bold">Save</button>
            </div>
            <div className="grid gap-2 max-h-80 overflow-y-auto">
              {stock.map(s => (
                <div key={s.itemSize} className="flex justify-between items-center text-sm border rounded-lg p-2">
                  <span className="w-1/2 truncate">{s.itemSize}</span>
                  <input
                    type="number"
                    min={0}
                    className="w-20 border rounded text-center"
                    value={stockEdits[s.itemSize] ?? s.quantity}
                    onChange={e => setStockEdits({ ...stockEdits, [s.itemSize]: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Completed orders modal */}
      {modal === 'completed' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="p-4 border-b flex justify-between">
              <h2 className="text-xl font-bold">Completed orders</h2>
              <button type="button" onClick={() => setModal(null)} className="text-2xl">&times;</button>
            </div>
            <div className="p-4 flex flex-wrap gap-2 border-b">
              <input type="date" value={orderFrom} onChange={e => setOrderFrom(e.target.value)} className="border rounded p-1 text-sm" />
              <input type="date" value={orderTo} onChange={e => setOrderTo(e.target.value)} className="border rounded p-1 text-sm" />
              <button type="button" onClick={() => void filterCompleted()} className="bg-green-600 text-white px-3 py-1 rounded text-sm">Filter</button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {completedList.map(o => (
                <div key={o.id} className="border rounded-lg p-3">
                  <div className="flex justify-between">
                    <span className="font-bold">{o.customerName}</span>
                    <span className="text-green-700 font-bold">{formatCurrency(o.orderTotal ?? 0)}</span>
                  </div>
                  <p className="text-xs text-gray-500">{o.date}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {modal === 'expenseReport' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
            <div className="p-4 border-b flex justify-between">
              <h2 className="text-xl font-bold">Expense report</h2>
              <button type="button" onClick={() => setModal(null)} className="text-2xl">&times;</button>
            </div>
            <div className="p-4 flex gap-2 flex-wrap border-b">
              <input type="date" value={expFrom} onChange={e => setExpFrom(e.target.value)} className="border rounded p-1" />
              <input type="date" value={expTo} onChange={e => setExpTo(e.target.value)} className="border rounded p-1" />
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {filteredExpenses.map(e => (
                <div key={e.id} className="flex justify-between text-sm border-b py-2">
                  <span>{e.date} — {e.note}</span>
                  <span>{formatCurrency(e.amount)}</span>
                </div>
              ))}
            </div>
            <div className="p-4 border-t font-bold flex justify-between">
              <span>Total</span>
              <span className="text-red-700">{formatCurrency(expenseTotal)}</span>
            </div>
          </div>
        </div>
      )}

      {modal === 'prices' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between mb-4">
              <h2 className="text-xl font-bold">Prices</h2>
              <button type="button" onClick={() => setModal(null)} className="text-2xl">&times;</button>
            </div>
            <div className="space-y-2">
              {Object.keys(priceEdits).map(name => (
                <div key={name} className="flex items-center gap-2">
                  <span className="flex-1 text-sm font-medium">{name}</span>
                  <input
                    type="number"
                    className="border rounded p-2 w-32"
                    value={priceEdits[name]}
                    onChange={e => setPriceEdits({ ...priceEdits, [name]: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              ))}
            </div>
            <button type="button" onClick={() => void savePrices()} className="mt-4 w-full bg-orange-600 text-white py-3 rounded-xl font-bold">Save prices</button>
          </div>
        </div>
      )}

      {modal === 'customers' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between mb-4">
              <h2 className="text-xl font-bold">Customers</h2>
              <button type="button" onClick={() => setModal(null)} className="text-2xl">&times;</button>
            </div>
            <form onSubmit={e => void saveCustomer(e)} className="space-y-2 mb-4">
              <input className="w-full border rounded p-2" placeholder="Name" value={newCust.name} onChange={e => setNewCust({ ...newCust, name: e.target.value })} />
              <input className="w-full border rounded p-2" placeholder="Address" value={newCust.address} onChange={e => setNewCust({ ...newCust, address: e.target.value })} />
              <input className="w-full border rounded p-2" placeholder="Phone" value={newCust.phone} onChange={e => setNewCust({ ...newCust, phone: e.target.value })} />
              <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded font-bold">Add customer</button>
            </form>
            {customers.map(c => (
              <div key={c.id} className="border rounded p-2 mb-2 text-sm">
                <div className="font-bold">{c.name}</div>
                <div>{c.address}</div>
                <div>{c.phone}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {modal === 'products' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between mb-4">
              <h2 className="text-xl font-bold">Products</h2>
              <button type="button" onClick={() => setModal(null)} className="text-2xl">&times;</button>
            </div>
            <div className="flex gap-2 mb-4">
              <input className="flex-1 border rounded p-2" placeholder="Name" value={newProd.name} onChange={e => setNewProd({ ...newProd, name: e.target.value })} />
              <input className="w-28 border rounded p-2" placeholder="Price" value={newProd.price} onChange={e => setNewProd({ ...newProd, price: e.target.value })} />
              <button type="button" onClick={() => void addProduct()} className="bg-green-600 text-white px-4 rounded font-bold">Add</button>
            </div>
            {stock.map(s => (
              <div key={s.itemSize} className="flex justify-between items-center border rounded p-2 mb-2">
                <span className="text-sm font-medium">{s.itemSize}</span>
                <button type="button" onClick={() => void deleteProduct(s.itemSize)} className="text-red-600 text-sm">Delete</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {modal === 'newExpense' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="font-bold mb-4">New expense</h2>
            <form onSubmit={e => void saveNewExpense(e)} className="space-y-3">
              <input required className="w-full border rounded p-2" placeholder="Category" value={newExp.category} onChange={e => setNewExp({ ...newExp, category: e.target.value })} />
              <input required type="number" step="0.01" className="w-full border rounded p-2" placeholder="Amount" value={newExp.amount} onChange={e => setNewExp({ ...newExp, amount: e.target.value })} />
              <button type="submit" className="w-full bg-purple-600 text-white py-2 rounded font-bold">Save</button>
            </form>
            <button type="button" onClick={() => setModal(null)} className="mt-2 w-full text-gray-500">Cancel</button>
          </div>
        </div>
      )}

      {modal === 'analytics' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col p-4">
            <div className="flex justify-between mb-2">
              <h2 className="text-xl font-bold">Sales analytics</h2>
              <button type="button" onClick={() => setModal(null)} className="text-2xl">&times;</button>
            </div>
            <div className="flex gap-2 mb-4 flex-wrap">
              <input type="date" value={chartFrom} onChange={e => setChartFrom(e.target.value)} className="border rounded p-1" />
              <input type="date" value={chartTo} onChange={e => setChartTo(e.target.value)} className="border rounded p-1" />
              <button type="button" onClick={() => void loadChart()} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">Update</button>
            </div>
            <div className="h-[400px]">
              {chartData.labels.length > 0 ? (
                <Bar
                  data={{
                    labels: chartData.labels,
                    datasets: [{ label: 'Units sold', data: chartData.data, backgroundColor: 'rgba(75,192,192,0.6)' }]
                  }}
                  options={{ responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }}
                />
              ) : (
                <p className="text-gray-400 text-center py-8">No data for range</p>
              )}
            </div>
          </div>
        </div>
      )}

      {modal === 'attendanceReport' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between mb-4">
              <h2 className="text-xl font-bold">Attendance report</h2>
              <button type="button" onClick={() => setModal(null)} className="text-2xl">&times;</button>
            </div>
            <div className="flex gap-2 mb-4">
              <input type="date" value={attFrom} onChange={e => setAttFrom(e.target.value)} className="border rounded p-1" />
              <input type="date" value={attTo} onChange={e => setAttTo(e.target.value)} className="border rounded p-1" />
              <button type="button" onClick={() => void loadAttReport()} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">Filter</button>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="bg-blue-100"><th className="p-2 text-left">Employee</th><th className="p-2">Days</th></tr></thead>
              <tbody>
                {attReport.map(r => (
                  <tr key={r.name} className="border-b"><td className="p-2">{r.name}</td><td className="p-2 text-center font-bold text-blue-600">{r.daysPresent}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
