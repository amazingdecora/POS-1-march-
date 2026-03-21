import React, { useCallback, useEffect, useState } from 'react';
import { apiWorkshop } from '../api';
import { formatCurrency } from '../format';

interface Order {
  id: number;
  customerName: string;
  address: string;
  phone: string;
  details: string;
  items?: Array<{ name: string; quantity: number; price?: number; total?: number }>;
  orderTotal: number | null;
  paymentStatus: string;
  date: string;
}

interface StockRow {
  itemSize: string;
  quantity: number;
}

export const WorkshopPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [prodOpen, setProdOpen] = useState(false);
  const [attOpen, setAttOpen] = useState(false);
  const [prodQty, setProdQty] = useState<Record<string, number>>({});
  const [employees, setEmployees] = useState<Array<{ id: number; name: string }>>([]);
  const [present, setPresent] = useState<Set<string>>(new Set());
  const [newEmp, setNewEmp] = useState('');
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const [o, s] = await Promise.all([
        apiWorkshop<Order[]>('/orders'),
        apiWorkshop<StockRow[]>('/stock')
      ]);
      setOrders(o);
      setStock(s);
    } catch (e) {
      setMsg(String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const printOrder = async (id: number) => {
    const o = await apiWorkshop<Order>(`/orders/${id}`);
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>Order #${o.id}</title></head><body style="font-family:sans-serif;padding:20px;">
      <h2 style="text-align:center">AMAZING DECORA</h2>
      <h4 style="text-align:center;color:#555">JOB SLIP / ORDER RECEIPT</h4><hr/>
      <p><b>Date:</b> ${o.date}</p><p><b>Order ID:</b> #${o.id}</p>
      <p style="text-align:right;font-weight:bold">${o.paymentStatus === 'Paid' ? 'PAID' : 'NOT PAID'}</p>
      <p><b>Customer:</b> ${o.customerName}</p>
      <p><b>Address:</b> ${o.address ?? ''}</p><p><b>Phone:</b> ${o.phone ?? ''}</p>
      <div style="border:2px solid #000;padding:15px;margin-top:16px;font-family:monospace;white-space:pre-wrap">${(o.details ?? '').replace(/</g, '&lt;')}</div>
      ${o.orderTotal != null ? `<p style="text-align:right;margin-top:16px;font-size:1.2em"><b>TOTAL: ${formatCurrency(o.orderTotal)}</b></p>` : ''}
      </body></html>`);
    w.document.close();
    w.print();
  };

  const completeOrder = async (id: number) => {
    if (!window.confirm('Complete order and deduct stock?')) return;
    try {
      await apiWorkshop(`/orders/${id}/complete`, { method: 'POST' });
      setMsg('Order completed');
      void load();
    } catch (e) {
      setMsg(String(e));
    }
  };

  const openProduction = () => {
    const q: Record<string, number> = {};
    stock.forEach(s => { q[s.itemSize] = 0; });
    setProdQty(q);
    setProdOpen(true);
  };

  const saveProduction = async () => {
    try {
      await apiWorkshop('/production', { method: 'POST', body: JSON.stringify({ quantities: prodQty }) });
      setProdOpen(false);
      void load();
    } catch (e) {
      setMsg(String(e));
    }
  };

  const openAttendance = async () => {
    setMsg('');
    try {
      const emps = await apiWorkshop<Array<{ id: number; name: string }>>('/employees');
      const today = new Date().toLocaleDateString();
      const recs = await apiWorkshop<Array<{ employeeName: string }>>(`/attendance?date=${encodeURIComponent(today)}`);
      setEmployees(emps);
      setPresent(new Set(recs.map(r => r.employeeName)));
      setAttOpen(true);
    } catch (e) {
      setMsg(String(e));
    }
  };

  const saveAttendance = async () => {
    const today = new Date().toLocaleDateString();
    try {
      await apiWorkshop('/attendance', {
        method: 'POST',
        body: JSON.stringify({ dateStr: today, presentNames: [...present] })
      });
      setAttOpen(false);
      setMsg('Attendance saved');
    } catch (e) {
      setMsg(String(e));
    }
  };

  const addEmployee = async () => {
    const n = newEmp.trim();
    if (!n) return;
    try {
      await apiWorkshop('/employees', { method: 'POST', body: JSON.stringify({ name: n }) });
      setNewEmp('');
      const emps = await apiWorkshop<Array<{ id: number; name: string }>>('/employees');
      setEmployees(emps);
    } catch (e) {
      setMsg(String(e));
    }
  };

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col">
      {msg !== '' && (
        <div className="mb-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{msg}</div>
      )}
      <header className="flex flex-col md:flex-row justify-between items-center mb-6 md:mb-8 bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="text-center md:text-left mb-4 md:mb-0">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800">Workshop Interface</h2>
          <h3 className="text-lg md:text-xl text-orange-600 font-medium">කර්මාන්තශාලා අතුරුමුහුණත</h3>
        </div>
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          <button
            type="button"
            onClick={() => void openAttendance()}
            className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl shadow-lg font-bold"
          >
            අද වැඩට ආපු අය
          </button>
          <button
            type="button"
            onClick={openProduction}
            className="w-full md:w-auto bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-xl shadow-lg font-bold"
          >
            දවස තුල කරන ලද නිශ්පාදන
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-700 mb-4 border-b border-gray-200 pb-2">
            Pending Orders
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-20">
            {orders.length === 0 && (
              <p className="text-gray-400 col-span-full text-center py-8">No pending orders.</p>
            )}
            {orders.map(o => (
              <div key={o.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-xl text-gray-800">{o.customerName}</h3>
                    <p className="text-sm text-gray-600 mt-2">{o.address}</p>
                    <p className="text-sm text-gray-500">{o.phone}</p>
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${o.paymentStatus === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {o.paymentStatus === 'Paid' ? 'PAID' : 'NOT PAID'}
                    </span>
                    {o.orderTotal != null && (
                      <div className="mt-2 text-lg font-bold text-green-700">{formatCurrency(o.orderTotal)}</div>
                    )}
                  </div>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg mb-4 border-l-4 border-blue-400 text-sm font-mono line-clamp-3 whitespace-pre-wrap">
                  {o.details}
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => void printOrder(o.id)} className="flex-1 bg-gray-100 py-2 rounded-lg font-medium">Print</button>
                  <button type="button" onClick={() => void setDetailOrder(o)} className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium">Details</button>
                  <button type="button" onClick={() => void completeOrder(o.id)} className="flex-1 bg-green-600 text-white py-2 rounded-lg font-medium">Complete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="w-full lg:w-[320px] flex-shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 sticky top-4">
            <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Current Stock</h3>
            <div className="grid gap-2 max-h-[60vh] overflow-y-auto">
              {stock.map(s => (
                <div key={s.itemSize} className="flex justify-between items-center p-3 bg-white border rounded-xl">
                  <span className="font-medium text-gray-700 text-sm">{s.itemSize}</span>
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full font-bold text-sm">{s.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {prodOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold">Daily production</h2>
              <button type="button" onClick={() => setProdOpen(false)} className="text-gray-500 text-2xl">&times;</button>
            </div>
            <div className="p-4 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 flex-1">
              {stock.map(s => (
                <div key={s.itemSize} className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                  <label className="block text-xs font-bold text-orange-800 mb-1">{s.itemSize}</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full border rounded p-2 text-center font-bold"
                    value={prodQty[s.itemSize] ?? 0}
                    onChange={e => setProdQty({ ...prodQty, [s.itemSize]: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
              ))}
            </div>
            <div className="p-4 border-t">
              <button type="button" onClick={() => void saveProduction()} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold">
                Save production
              </button>
            </div>
          </div>
        </div>
      )}

      {attOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="p-4 border-b flex justify-between">
              <div>
                <h2 className="text-xl font-bold">Attendance</h2>
                <p className="text-sm text-gray-500">{new Date().toLocaleDateString()}</p>
              </div>
              <button type="button" onClick={() => setAttOpen(false)} className="text-2xl text-gray-500">&times;</button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-2">
              <div className="flex gap-2 mb-4">
                <input
                  className="flex-1 border rounded-lg p-2 text-sm"
                  placeholder="New employee name"
                  value={newEmp}
                  onChange={e => setNewEmp(e.target.value)}
                />
                <button type="button" onClick={() => void addEmployee()} className="bg-blue-600 text-white px-4 rounded-lg text-sm font-bold">
                  Add
                </button>
              </div>
              {employees.map(emp => (
                <label key={emp.id} className="flex items-center p-3 bg-gray-50 rounded-lg border cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-5 h-5 mr-3"
                    checked={present.has(emp.name)}
                    onChange={e => {
                      const next = new Set(present);
                      if (e.target.checked) next.add(emp.name);
                      else next.delete(emp.name);
                      setPresent(next);
                    }}
                  />
                  <span className="font-medium">{emp.name}</span>
                </label>
              ))}
            </div>
            <div className="p-4 border-t flex gap-2">
              <button type="button" onClick={() => void saveAttendance()} className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {detailOrder !== null && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between mb-4">
              <h2 className="text-xl font-bold">Order #{detailOrder.id}</h2>
              <button type="button" onClick={() => setDetailOrder(null)} className="text-2xl">&times;</button>
            </div>
            <pre className="bg-gray-50 p-4 rounded text-sm whitespace-pre-wrap font-mono">{detailOrder.details}</pre>
            <button
              type="button"
              onClick={() => void printOrder(detailOrder.id)}
              className="mt-4 w-full bg-gray-800 text-white py-2 rounded-lg font-bold"
            >
              Print
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
