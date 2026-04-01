import React, { useCallback, useEffect, useState } from 'react';
import { clearToken, getToken, login, setToken } from './api';
import { AdminDashboard } from './pages/AdminDashboard';
import { WorkshopPage } from './pages/WorkshopPage';

type Tab = 'admin' | 'workshop';

const App: React.FC = () => {
  const [tab, setTab] = useState<Tab>('workshop');
  const [auth, setAuth] = useState(!!getToken());
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');

  useEffect(() => {
    setAuth(!!getToken());
  }, []);

  const goAdmin = useCallback(() => {
    setTab('admin');
  }, []);

  const goWorkshop = useCallback(() => {
    setTab('workshop');
  }, []);

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { token } = await login(user, pass);
      setToken(token);
      setAuth(true);
      setPass('');
      setTab('admin');
    } catch {
      window.alert('Invalid credentials');
    }
  };

  return (
    <div className="h-screen w-screen flex bg-gray-100 text-gray-800">
      <aside className="hidden md:flex w-64 bg-green-900 text-white flex-col shadow-2xl z-20 no-print">
        <div className="p-6 border-b border-green-800">
          <h1 className="text-2xl font-bold tracking-tighter uppercase">Amazing Decora</h1>
          <p className="text-xs text-green-300 mt-1 uppercase tracking-widest">Management System</p>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button
            type="button"
            onClick={goAdmin}
            className={`w-full flex items-center px-4 py-3 rounded-xl transition ${
              tab === 'admin' ? 'bg-green-700 text-white' : 'text-green-100 hover:bg-green-800'
            }`}
          >
            <span className="font-medium">Admin Dashboard</span>
          </button>
          <button
            type="button"
            onClick={goWorkshop}
            className={`w-full flex items-center px-4 py-3 rounded-xl transition ${
              tab === 'workshop' ? 'bg-green-700 text-white' : 'text-green-100 hover:bg-green-800'
            }`}
          >
            <span className="font-medium">Workshop (කර්මාන්තශාලා)</span>
          </button>
        </nav>
        <div className="p-4 bg-green-950 text-xs text-green-400 text-center">&copy; 2026 Amazing Decora</div>
      </aside>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 flex justify-around p-2 no-print">
        <button
          type="button"
          onClick={goAdmin}
          className={`flex flex-col items-center w-full py-2 ${tab === 'admin' ? 'text-green-700' : 'text-gray-400'}`}
        >
          <span className="text-xs font-bold">Admin</span>
        </button>
        <button
          type="button"
          onClick={goWorkshop}
          className={`flex flex-col items-center w-full py-2 ${tab === 'workshop' ? 'text-green-700' : 'text-gray-400'}`}
        >
          <span className="text-xs font-bold">Workshop</span>
        </button>
      </nav>

      <main className="flex-1 h-screen overflow-y-auto p-4 md:p-10 pb-24 md:pb-10">
        {tab === 'admin' && auth && <AdminDashboard />}
        {tab === 'workshop' && <WorkshopPage />}
      </main>

      {tab === 'admin' && !auth && (
        <div className="fixed inset-0 bg-gray-900 z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-6 md:p-8 flex flex-col md:flex-row gap-6">
            <button
              type="button"
              onClick={goWorkshop}
              className="flex-1 bg-orange-50 hover:bg-orange-100 text-orange-700 p-8 rounded-2xl border border-orange-200 font-bold text-lg"
            >
              Workshop
              <span className="block text-sm font-normal mt-2">කර්මාන්තශාලා</span>
            </button>
            <div className="flex-1 border-t md:border-t-0 md:border-l border-gray-100 pt-6 md:pt-0 md:pl-8">
              <h2 className="text-2xl font-black text-center mb-4">Admin login</h2>
              <p className="text-sm text-gray-500 text-center mb-4">Default: admin / admin123 (change in production)</p>
              <form onSubmit={e => void submitLogin(e)} className="space-y-3">
                <input
                  className="w-full border rounded-xl p-3"
                  placeholder="Username"
                  value={user}
                  onChange={e => setUser(e.target.value)}
                  required
                />
                <input
                  type="password"
                  className="w-full border rounded-xl p-3"
                  placeholder="Password"
                  value={pass}
                  onChange={e => setPass(e.target.value)}
                  required
                />
                <button type="submit" className="w-full bg-green-700 text-white font-bold py-3 rounded-xl">
                  Login
                </button>
              </form>
              <button
                type="button"
                onClick={() => { clearToken(); setAuth(false); goWorkshop(); }}
                className="mt-2 w-full text-sm text-gray-500"
              >
                Continue as workshop only
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
