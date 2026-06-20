import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useSocket } from '../hooks/useSocket.js';

const STATUS_LABEL = { ordered: 'Ordered', in_progress: 'In Progress', ready: 'Ready!' };
const STATUS_COLOR = {
  ordered: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  ready: 'bg-green-100 text-green-800',
};

function formatPrice(cents) {
  return (cents / 100).toFixed(2) + ' €';
}

export default function Cashier() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menu, setMenu] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [cart, setCart] = useState({}); // { menuItemId: quantity }
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('order'); // 'order' | 'orders'

  useEffect(() => {
    fetch('/api/menu', { credentials: 'include' })
      .then(r => r.json()).then(setMenu);
    fetch('/api/orders', { credentials: 'include' })
      .then(r => r.json()).then(setMyOrders);
  }, []);

  useSocket({
    'order:updated': updated => {
      setMyOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
    },
    'order:new': order => {
      if (order.created_by === user?.id) {
        setMyOrders(prev => [order, ...prev]);
      }
    },
  });

  const categories = [...new Set(menu.filter(i => i.available).map(i => i.category))].sort();

  function addToCart(item) {
    setCart(c => ({ ...c, [item.id]: (c[item.id] ?? 0) + 1 }));
  }
  function removeFromCart(itemId) {
    setCart(c => {
      const next = { ...c };
      if (next[itemId] > 1) next[itemId]--;
      else delete next[itemId];
      return next;
    });
  }

  const cartItems = Object.entries(cart).map(([id, qty]) => ({
    item: menu.find(m => m.id === Number(id)),
    qty,
  })).filter(x => x.item);
  const total = cartItems.reduce((sum, { item, qty }) => sum + item.price * qty, 0);

  async function submitOrder() {
    if (cartItems.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cartItems.map(({ item, qty }) => ({ menuItemId: item.id, quantity: qty })),
          note: note || undefined,
        }),
      });
      if (res.ok) {
        const order = await res.json();
        setMyOrders(prev => [order, ...prev]);
        setCart({});
        setNote('');
        setActiveTab('orders');
        toast.success(`Order #${order.id} placed!`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-brand-500 text-white px-4 py-3 flex items-center justify-between safe-top">
        <h1 className="text-lg font-bold">Cashier</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm opacity-80">{user?.username}</span>
          <button onClick={async () => { await logout(); navigate('/login'); }} className="text-sm bg-white/20 px-3 py-1 rounded-lg">
            Sign out
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <div className="flex border-b bg-white">
        <button
          onClick={() => setActiveTab('order')}
          className={`flex-1 py-3 text-sm font-medium ${activeTab === 'order' ? 'text-brand-600 border-b-2 border-brand-500' : 'text-gray-500'}`}
        >
          New order {cartItems.length > 0 && <span className="ml-1 bg-brand-500 text-white text-xs px-1.5 py-0.5 rounded-full">{cartItems.length}</span>}
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex-1 py-3 text-sm font-medium ${activeTab === 'orders' ? 'text-brand-600 border-b-2 border-brand-500' : 'text-gray-500'}`}
        >
          My orders {myOrders.filter(o => o.status === 'ready').length > 0 && (
            <span className="ml-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">
              {myOrders.filter(o => o.status === 'ready').length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'order' ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 pb-48">
            {categories.map(cat => (
              <div key={cat} className="mb-6">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">{cat ?? 'Other'}</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {menu.filter(i => i.available && i.category === cat).map(item => (
                    <button
                      key={item.id}
                      onClick={() => addToCart(item)}
                      className="bg-white rounded-2xl shadow-sm p-4 text-left active:scale-95 transition border border-gray-100 relative"
                    >
                      {cart[item.id] && (
                        <span className="absolute top-2 right-2 bg-brand-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                          {cart[item.id]}
                        </span>
                      )}
                      <p className="font-semibold text-sm leading-tight">{item.name}</p>
                      {item.description && <p className="text-xs text-gray-400 mt-1 leading-tight">{item.description}</p>}
                      <p className="text-brand-600 font-bold mt-2 text-sm">{formatPrice(item.price)}</p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Sticky cart summary */}
          {cartItems.length > 0 && (
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 safe-bottom">
              <div className="max-w-lg mx-auto">
                <div className="flex items-start gap-2 mb-3 max-h-28 overflow-y-auto">
                  <div className="flex-1 space-y-1">
                    {cartItems.map(({ item, qty }) => (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <span>{qty}× {item.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">{formatPrice(item.price * qty)}</span>
                          <button onClick={() => removeFromCart(item.id)} className="text-gray-400 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs">−</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Order note (optional)"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  onClick={submitOrder}
                  disabled={submitting}
                  className="w-full bg-brand-500 text-white font-bold py-4 rounded-2xl text-base disabled:opacity-50 active:scale-95 transition flex items-center justify-between px-6"
                >
                  <span>Place order</span>
                  <span>{formatPrice(total)}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {myOrders.length === 0 && (
            <p className="text-center text-gray-400 mt-12">No orders yet</p>
          )}
          {myOrders.map(order => (
            <div key={order.id} className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm">Order #{order.id}</span>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLOR[order.status]}`}>
                  {STATUS_LABEL[order.status]}
                </span>
              </div>
              {order.items?.map(i => (
                <p key={i.id} className="text-sm text-gray-600">{i.quantity}× {i.name ?? i.item_name}</p>
              ))}
              {order.note && <p className="text-xs text-gray-400 mt-1 italic">"{order.note}"</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
