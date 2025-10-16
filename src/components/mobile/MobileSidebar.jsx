import React, { useState, useCallback, useEffect } from "react";
import {
  Calendar,
  Kanban,
  List,
  Archive,
  Plus,
  X,
} from "lucide-react";

export default function MobileSidebar({ currentView, setView, isOpen, onClose }) {
  const [recentTasks, setRecentTasks] = useState([]);

  const handleNavigation = useCallback(
    (view) => {
      setView(view);
      onClose(); // Close sidebar after navigation on mobile
      window.dispatchEvent(new CustomEvent("navigate", { detail: { view } }));
    },
    [setView, onClose]
  );

  const handleAddTask = useCallback(() => {
    window.dispatchEvent(new CustomEvent("addTask"));
    onClose(); // Close sidebar after action
  }, [onClose]);

  // Fetch recent tasks from backend
  const fetchRecentTasks = useCallback(async () => {
    try {
      const res = await fetch(`http://${window.location.hostname}:8080/tasks/recent`);
      if (res.ok) {
        const data = await res.json();
        setRecentTasks(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch recent tasks:", err);
      setRecentTasks([]);
    }
  }, []);

  useEffect(() => {
    fetchRecentTasks();
  }, [fetchRecentTasks]);

  useEffect(() => {
    const handleTaskChange = () => {
      setTimeout(fetchRecentTasks, 200);
    };

    window.addEventListener("taskAdded", handleTaskChange);
    window.addEventListener("taskUpdated", handleTaskChange);
    window.addEventListener("taskDeleted", handleTaskChange);
    window.addEventListener("taskArchived", handleTaskChange);
    
    return () => {
      window.removeEventListener("taskAdded", handleTaskChange);
      window.removeEventListener("taskUpdated", handleTaskChange);
      window.removeEventListener("taskDeleted", handleTaskChange);
      window.removeEventListener("taskArchived", handleTaskChange);
    };
  }, [fetchRecentTasks]);

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-gradient-to-b from-gray-900 to-gray-800 text-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">I</span>
            </div>
            <div>
              <h2 className="text-lg font-bold">Issues Dashboard</h2>
              <p className="text-[10px] text-gray-400">Manage your tasks</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Add Task Button */}
        <button
          onClick={handleAddTask}
          className="flex items-center gap-3 mx-4 my-4 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg font-semibold shadow-lg transition-all active:scale-95"
        >
          <Plus size={20} />
          <span>Add Task</span>
        </button>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 px-4">
          <button
            onClick={() => handleNavigation("task")}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
              currentView === "task"
                ? "bg-blue-600 text-white shadow-lg"
                : "text-gray-300 hover:bg-gray-700"
            }`}
          >
            <List size={20} />
            <span>Tasks</span>
          </button>

          <button
            onClick={() => handleNavigation("timeframe")}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
              currentView === "timeframe"
                ? "bg-blue-600 text-white shadow-lg"
                : "text-gray-300 hover:bg-gray-700"
            }`}
          >
            <Calendar size={20} />
            <span>Timeframe</span>
          </button>

          <button
            onClick={() => handleNavigation("kanban")}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
              currentView === "kanban"
                ? "bg-blue-600 text-white shadow-lg"
                : "text-gray-300 hover:bg-gray-700"
            }`}
          >
            <Kanban size={20} />
            <span>Kanban</span>
          </button>

          <button
            onClick={() => handleNavigation("archived")}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
              currentView === "archived"
                ? "bg-blue-600 text-white shadow-lg"
                : "text-gray-300 hover:bg-gray-700"
            }`}
          >
            <Archive size={20} />
            <span>Archived</span>
          </button>
        </nav>

        {/* Recently Added Section */}
        <div className="flex-1 overflow-hidden flex flex-col mt-4 px-4">
          <h3 className="text-sm font-semibold text-gray-400 mb-2">
            Recently Added
          </h3>
          <div className="flex-1 overflow-y-auto space-y-1" style={{ scrollbarWidth: "none" }}>
            {recentTasks.length > 0 ? (
              recentTasks.map((task) => (
                <div
                  key={task.id}
                  className="p-2 bg-gray-800 hover:bg-gray-700 rounded cursor-pointer transition-colors text-sm"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("openTask", { detail: { taskId: task.id } })
                    );
                    onClose();
                  }}
                >
                  <div className="font-medium truncate">{task.title}</div>
                  <div className="text-[10px] text-gray-400">
                    {new Date(task.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs text-gray-500 italic">No recent tasks</div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
