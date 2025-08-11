export default function Sidebar({ currentView, setView }) {
  return (
    <aside className="w-64 bg-orange-300 p-6 shadow-md">
      <div className="flex flex-col justify-center h-full">
        <h2 className="text-2xl font-bold mb-6 text-center">Dashboard</h2>
        <nav className="space-y-3">
          <button
            onClick={() => setView("timeframe")}
            className={`w-full text-left px-4 py-2 rounded-lg ${
              currentView === "timeframe"
                ? "bg-white text-blue-900 font-semibold"
                : "hover:bg-blue-200"
            }`}
          >
            🗓️ Timeframe View
          </button>
          <button
            onClick={() => setView("kanban")}
            className={`w-full text-left px-4 py-2 rounded-lg ${
              currentView === "kanban"
                ? "bg-white text-blue-900 font-semibold"
                : "hover:bg-blue-200"
            }`}
          >
            👥 Kanban View
          </button>
        </nav>
      </div>
    </aside>
  );
}
