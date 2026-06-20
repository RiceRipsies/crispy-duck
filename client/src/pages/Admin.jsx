import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

function formatPrice(cents) {
  return (cents / 100).toFixed(2);
}

const EMPTY_FORM = { name: '', description: '', price: '', category: 'pizza', available: true };

export default function Admin() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null); // null | 'new' | item object
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/menu', { credentials: 'include' })
      .then(r => r.json()).then(setItems);
  }, []);

  function openNew() {
    setForm(EMPTY_FORM);
    setEditing('new');
    setError('');
  }

  function openEdit(item) {
    setForm({
      name: item.name,
      description: item.description ?? '',
      price: formatPrice(item.price),
      category: item.category ?? 'pizza',
      available: Boolean(item.available),
    });
    setEditing(item);
    setError('');
  }

  async function save() {
    setError('');
    const priceCents = Math.round(parseFloat(form.price) * 100);
    if (!form.name || isNaN(priceCents) || priceCents <= 0) {
      setError('Name and a valid price are required.');
      return;
    }
    setSaving(true);
    try {
      const isNew = editing === 'new';
      const url = isNew ? '/api/menu' : `/api/menu/${editing.id}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, price: priceCents }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Save failed');
      }
      const saved = await res.json();
      setItems(prev => isNew ? [...prev, saved] : prev.map(i => i.id === saved.id ? saved : i));
      setEditing(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleAvailable(item) {
    const res = await fetch(`/api/menu/${item.id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ available: !item.available }),
    });
    if (res.ok) {
      const updated = await res.json();
      setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
    }
  }

  const categories = [...new Set(items.map(i => i.category))].sort();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-brand-600 text-white px-4 py-3 flex items-center justify-between safe-top">
        <h1 className="text-lg font-bold">Admin — Menu</h1>
        <div className="flex items-center gap-3">
          <Link to="/cashier" className="text-sm bg-white/20 px-3 py-1 rounded-lg">Cashier</Link>
          <Link to="/kitchen" className="text-sm bg-white/20 px-3 py-1 rounded-lg">Kitchen</Link>
          <button onClick={async () => { await logout(); navigate('/login'); }} className="text-sm bg-white/20 px-3 py-1 rounded-lg">
            Sign out
          </button>
        </div>
      </header>

      <div className="flex-1 p-4 max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Menu Items</h2>
          <button onClick={openNew} className="bg-brand-500 text-white text-sm font-semibold px-4 py-2 rounded-xl active:scale-95 transition">
            + Add item
          </button>
        </div>

        {categories.map(cat => (
          <div key={cat} className="mb-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{cat ?? 'Other'}</h3>
            <div className="space-y-2">
              {items.filter(i => i.category === cat).map(item => (
                <div key={item.id} className={`bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3 border ${item.available ? 'border-gray-100' : 'border-gray-200 opacity-50'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{item.name}</p>
                    {item.description && <p className="text-xs text-gray-400 truncate">{item.description}</p>}
                    <p className="text-brand-600 font-bold text-sm mt-0.5">{formatPrice(item.price)} €</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => toggleAvailable(item)}
                      className={`text-xs px-2 py-1 rounded-lg font-medium ${item.available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {item.available ? 'On' : 'Off'}
                    </button>
                    <button
                      onClick={() => openEdit(item)}
                      className="text-xs px-3 py-1 rounded-lg bg-gray-100 text-gray-700 font-medium"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Edit / New sheet */}
      {editing !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl p-6 space-y-4 safe-bottom">
            <h2 className="text-lg font-bold">{editing === 'new' ? 'Add menu item' : 'Edit menu item'}</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (€)</label>
                <input type="number" step="0.01" min="0" value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>
            {editing !== 'new' && (
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.available}
                  onChange={e => setForm(f => ({ ...f, available: e.target.checked }))}
                  className="w-5 h-5 rounded" />
                <span className="text-sm font-medium">Available on menu</span>
              </label>
            )}

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button onClick={() => setEditing(null)} className="flex-1 py-3 rounded-xl border border-gray-300 text-sm font-semibold text-gray-600">
                Cancel
              </button>
              <button onClick={save} disabled={saving} className="flex-1 py-3 rounded-xl bg-brand-500 text-white text-sm font-bold disabled:opacity-50 active:scale-95 transition">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
