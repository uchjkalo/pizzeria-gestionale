"use client";
/* ═══════════════════════════════════════════════════════
   PREPARAZIONE — zona task di preparazione a freddo.
   Riceve task auto-generate dalla cucina quando avvia
   la preparazione di un ordine (affettati, fritti, etc.)
   più task manuali.
═══════════════════════════════════════════════════════ */
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { subscribeToTasks, subscribeToAllTasks, createKitchenTask, completeTask, uncompleteTask, deleteTask, updateTaskDescription } from "@/lib/kitchen";
import { KitchenTask } from "@/types";

const formatTime = (d: Date) => d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

/* Preset tipici per la zona preparazione */
const PRESET_PREP = [
  "🥩 San Daniele", "🥩 Prosciutto cotto", "🥩 Mortadella", "🥩 Pitina",
  "🥩 Porchetta", "🥩 Speck", "🥩 Pancetta", "🥩 Guanciale",
  "🌶️ Nduja", "🥩 Salsiccia", "🌿 Friarielli", "🍟 Patatine fritte",
  "🍟 Cono patatine", "🍗 Nuggets di pollo", "🌭 Wurstel",
  "🥩 Cotoletta + 🍟 Patatine", "🧀 Frico",
];

export default function PreparazioneZone() {
  const { loading } = useAuth();
  const [tasks, setTasks]        = useState<KitchenTask[]>([]);
  const [allTasks, setAllTasks]  = useState<KitchenTask[]>([]);
  const [showAll, setShowAll]    = useState(false);
  const [newTask, setNewTask]    = useState("");
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  useEffect(() => subscribeToTasks("preparazione", setTasks), []);
  useEffect(() => subscribeToAllTasks("preparazione", setAllTasks), []);

  const addTask = async (text: string) => {
    const t = text.trim(); if (!t) return;
    await createKitchenTask({ orderId: "manuale", description: t, zone: "preparazione", completed: false });
    setNewTask("");
  };

  const saveEdit = async () => {
    if (!editingId || !editingText.trim()) return;
    await updateTaskDescription(editingId, editingText.trim());
    setEditingId(null); setEditingText("");
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-white">Caricamento...</p></div>;

  const completed = allTasks.filter(t => t.completed);

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col gap-0 overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div>
          <h1 className="text-white text-xl md:text-2xl font-bold">🍕 Preparazione</h1>
          <p className="text-gray-600 text-xs mt-0.5">Affettati · Fritti · Ingredienti speciali</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-sm font-bold ${tasks.length > 0 ? "bg-orange-500 text-white" : "bg-gray-700 text-gray-400"}`}>
            {tasks.length} da fare
          </span>
          {completed.length > 0 && (
            <span className="bg-green-800 text-green-200 px-3 py-1 rounded-full text-sm font-bold">
              {completed.length} ✓
            </span>
          )}
        </div>
      </div>

      {/* Input + preset */}
      <div className="shrink-0 space-y-2 mb-3">
        <div className="flex gap-2">
          <input value={newTask} onChange={e => setNewTask(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addTask(newTask)}
            placeholder="Aggiungi task manuale..."
            className="flex-1 bg-gray-800 text-white rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-500 border border-gray-700/50" />
          <button onClick={() => addTask(newTask)} className="bg-orange-500 hover:bg-orange-400 text-white rounded-2xl px-4 font-bold text-xl transition-colors">+</button>
        </div>

        {/* Preset rapidi */}
        <div className="flex flex-wrap gap-1.5">
          {PRESET_PREP.map(p => (
            <button key={p} onClick={() => addTask(p)}
              className="bg-gray-800 hover:bg-gray-700 active:bg-orange-500/20 border border-gray-700/40 text-gray-300 text-xs px-2.5 py-1.5 rounded-xl transition-colors font-medium">
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Task attive */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-gray-600">
            <p className="text-5xl mb-3">✅</p>
            <p className="font-medium">Nessun task in preparazione</p>
            <p className="text-sm mt-1 text-gray-700">Le task arrivano dalla cucina quando inizia la preparazione</p>
          </div>
        )}

        {/* Raggruppamento per ordine */}
        {tasks.map(task => (
          <div key={task.id} className="bg-gray-800 rounded-2xl border border-gray-700/50 group">
            {editingId === task.id ? (
              <div className="flex gap-2 p-3">
                <input autoFocus value={editingText} onChange={e => setEditingText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingId(null); }}
                  className="flex-1 bg-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500" />
                <button onClick={saveEdit} className="text-green-400 font-bold px-2">✓</button>
                <button onClick={() => setEditingId(null)} className="text-gray-500 px-2">✗</button>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3">
                {/* Checkbox grande, mobile-friendly */}
                <button onClick={() => completeTask(task.id)}
                  className="w-10 h-10 rounded-full border-2 border-gray-500 hover:border-green-400 active:bg-green-400/20 flex items-center justify-center shrink-0 transition-all">
                  <span className="text-green-400 font-bold opacity-0 group-hover:opacity-60 text-lg">✓</span>
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium ${task.description.startsWith("  ") ? "text-gray-400 text-sm pl-2" : "text-white"}`}>
                    {task.description}
                  </p>
                  <p className="text-gray-600 text-xs mt-0.5">{formatTime(task.createdAt)}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => { setEditingId(task.id); setEditingText(task.description); }}
                    className="w-9 h-9 text-gray-600 hover:text-blue-400 flex items-center justify-center text-sm transition-colors">✏️</button>
                  <button onClick={() => deleteTask(task.id)}
                    className="w-9 h-9 text-gray-600 hover:text-red-400 flex items-center justify-center text-xl transition-colors">×</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Completate (collassabili) */}
      <div className="border-t border-gray-700/40 mt-2 shrink-0">
        <button onClick={() => setShowAll(s => !s)}
          className="w-full px-4 py-3 text-gray-500 text-sm flex items-center justify-between hover:text-gray-300 transition-colors">
          <span>✅ Completate ({completed.length})</span>
          <span>{showAll ? "▲" : "▼"}</span>
        </button>
        {showAll && (
          <div className="max-h-48 overflow-y-auto px-3 pb-3 space-y-1.5">
            {completed.map(t => (
              <div key={t.id} className="flex items-center gap-3 bg-gray-800/50 rounded-xl px-3 py-2">
                <button onClick={() => uncompleteTask(t.id)}
                  className="w-7 h-7 rounded-full bg-green-800/40 border border-green-700/50 flex items-center justify-center shrink-0 text-green-500 text-sm">✓</button>
                <span className="text-gray-600 text-xs flex-1 line-through truncate">{t.description}</span>
                <span className="text-gray-700 text-[10px] shrink-0">{formatTime(t.createdAt)}</span>
                <button onClick={() => deleteTask(t.id)} className="text-gray-700 hover:text-red-400 text-base w-6 h-6 flex items-center justify-center">×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
