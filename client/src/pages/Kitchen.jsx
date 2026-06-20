import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useSocket } from '../hooks/useSocket.js';

const COLUMNS = [
  { status: 'ordered', label: 'Ordered', color: 'bg-yellow-50 border-yellow-200', badge: 'bg-yellow-100 text-yellow-800', action: 'Start', actionColor: 'bg-blue-500 text-white' },
  { status: 'in_progress', label: 'In Progress', color: 'bg-blue-50 border-blue-200', badge: 'bg-blue-100 text-blue-800', action: 'Ready', actionColor: 'bg-green-500 text-white' },
  { status: 'ready', label: 'Ready', color: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-800', action: 'Done', actionColor: 'bg-gray-500 text-white' },
];

function timeAgo(epochSec) {
  const diff = Math.floor(Date.now() / 1000) - epochSec;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function Kitchen() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [, setTick] = useState(0);

  useEffect(() => {
    fetch('/api/orders', { credentials: 'include' })
      .then(r => r.json()).then(setOrders);

    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  useSocket({
    'order:new': order => setOrders(prev => [...prev, order]),
    'order:updated': updated => setOrders(prev => {
      if (updated.status === 'done') return prev.filter(o => o.id !== updated.id);
      return prev.map(o => o.id === updated.id ? updated : o);
    }),
  });

  async function advance(order) {
    const nextMap = { ordered: 'in_progress', in_progress: 'ready', ready: 'done' };
    const next = nextMap[order.status];
    if (!next) return;

    const res = await fetch(`/api/orders/${order.id}/status`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      const updated = await res.json();
      if (next === 'done') {
        setOrders(prev => prev.filter(o => o.id !== order.id));
      } else {
        setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
      }
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <header className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between safe-top">
        <h1 className="text-lg font-bold">Kitchen</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm opacity-60">{user?.username}</span>
          <button onClick={async () => { await logout(); navigate('/login'); }} className="text-sm bg-white/10 px-3 py-1 rounded-lg">
            Sign out
          </button>
        </div>
      </header>

      {/* Mobile: tabs per status; md+: three columns */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row gap-3 p-3">
        {COLUMNS.map(col => {
          const colOrders = orders.filter(o => o.status === col.status);
          return (
            <div key={col.status} className={`flex-1 flex flex-col rounded-2xl border ${col.color} overflow-hidden`}>
              <div className="px-4 py-3 flex items-center justify-between">
                <h2 className="font-bold text-sm">{col.label}</h2>
                {colOrders.length > 0 && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.badge}`}>{colOrders.length}</span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-3">
                {colOrders.length === 0 && (
                  <p className="text-center text-gray-400 text-sm pt-6">Empty</p>
                )}
                {colOrders.map(order => (
                  <div key={order.id} className="bg-white rounded-2xl shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-bold text-base">#{order.id}</span>
                      <span className="text-xs text-gray-400">{timeAgo(order.created_at)}</span>
                    </div>
                    <ul className="space-y-1 mb-3">
                      {order.items?.map(item => (
                        <li key={item.id} className="text-sm font-medium">
                          <span className="text-brand-600 font-bold">{item.quantity}×</span> {item.name ?? item.item_name}
                        </li>
                      ))}
                    </ul>
                    {order.note && (
                      <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 mb-3 italic">"{order.note}"</p>
                    )}
                    <button
                      onClick={() => advance(order)}
                      className={`w-full py-3 rounded-xl font-bold text-sm active:scale-95 transition ${col.actionColor}`}
                    >
                      {col.action}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
