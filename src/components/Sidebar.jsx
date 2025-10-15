import React, { useState, useCallback, useEffect } from "react";
import {
  Calendar,
  Kanban,
  ChevronLeft,
  ChevronRight,
  List,
  Archive,
  Plus,
} from "lucide-react";
import useLocalStorageTasks from "../hooks/use-tasks";
import users from "../data/users";

export default function Sidebar({ currentView, setView, theme }) {

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [recentTasks, setRecentTasks] = useState([]);
  const [localTheme, setLocalTheme] = useState(theme); // Local theme state

  // Sync local theme with prop
  useEffect(() => {
    setLocalTheme(theme);
    console.log("Sidebar theme received:", theme);
  }, [theme]);

  const toggleSidebar = useCallback(() => {
    setIsCollapsed((prev) => {
      const newState = !prev;
      window.dispatchEvent(
        new CustomEvent("sidebarToggle", { detail: { isCollapsed: newState } })
      );
      return newState;
    });
  }, []);

  const handleNavigation = useCallback(
    (view) => {
      setView(view);
      window.dispatchEvent(new CustomEvent("navigate", { detail: { view } }));
    },
    [setView]
  );

  const handleAddTask = useCallback(() => {
    window.dispatchEvent(new CustomEvent("addTask"));
  }, []);

  // Fetch recent tasks from backend - simplified version
  const fetchRecentTasks = useCallback(async () => {
    try {
      const res = await fetch(`http://${window.location.hostname}:8080/tasks/recent`);
      if (res.ok) {
        const data = await res.json();
        setRecentTasks(Array.isArray(data) ? data : []);
        console.log("Fetched recent tasks:", data);
      }
    } catch (err) {
      console.error("Failed to fetch recent tasks:", err);
      setRecentTasks([]);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchRecentTasks();
  }, [fetchRecentTasks]);

  // Refetch when tasks are added or updated
  useEffect(() => {
    const handleTaskChange = () => {
      // Add a small delay to ensure backend has processed the change
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
    <aside
      key={localTheme}
      className={`fixed top-0 left-0 h-full overflow-y-auto transition-all duration-300 ease-in-out ${
        isCollapsed ? "w-16" : "w-64"
      } ${localTheme === "light" ? "bg-gradient-to-b from-gray-700 to-gray-800" : "bg-gradient-to-b from-blue-100 to-blue-200 bg-blue-200/80"} p-6 shadow-md flex flex-col z-50 border-r border-sidebar-border`}
      role="navigation"
      aria-label="Main navigation"
      style={{ scrollbarWidth: "none" }}
    >
      {/* Header */}
      <div className={`${isCollapsed ? "mb-4" : "mb-8"}`}>
        {!isCollapsed && (
          <div className={`text-center border-2 rounded-xl shadow-lg px-3 py-2.5 mb-3 transition-all duration-300
            ${localTheme === "light" 
              ? "bg-gradient-to-r from-yellow-100 via-blue-100 to-blue-200 border-blue-400" 
              : "bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 border-blue-400"}`}
          >
            <img src="/BBC Logo.png" alt="Logo" className="mx-auto mb-1.5 h-12 w-auto" />
            <h2 className={`text-xl font-bold mb-0.5 transition-colors duration-300 ${localTheme === "dark" ? "text-yellow-300" : "text-blue-900"}`}>
              Issues Dashboard
            </h2>
            <p className={`text-xs font-medium transition-colors duration-300 ${localTheme === "dark" ? "text-blue-200" : "text-blue-700"}`}>
              Manage your tasks
            </p>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className={`w-full px-4 py-3 rounded-lg shadow-md transition-colors flex items-center justify-center ${
            isCollapsed 
              ? localTheme === "light" 
                ? "bg-gray-600 hover:bg-gray-500 text-white" 
                : "bg-blue-600 hover:bg-blue-700 text-white"
              : localTheme === "light" 
                ? "hover:bg-blue-300/30 text-gray-300 hover:text-white" 
                : "hover:bg-blue-300/50 text-blue-800 hover:text-blue-900"
          }`}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight size={20} strokeWidth={2.5} className="text-white flex-shrink-0" />
          ) : (
            <ChevronLeft size={20} className="flex-shrink-0" />
          )}
        </button>
      </div>

      {/* Add Task Button */}
      <button
        onClick={handleAddTask}
        className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-3 rounded-lg shadow-md transition-colors flex items-center justify-center gap-2 mb-8 overflow-visible`}
        aria-label="Add new task"
      >
        <Plus
          size={isCollapsed ? 20 : 20}
          className="text-white flex-shrink-0"
          strokeWidth={2}
        />
        {!isCollapsed && <span>Add New Task</span>}
      </button>

      {/* Navigation */}
      <nav className="flex flex-col gap-2">
        <button
          onClick={() => handleNavigation("task")}
          className={`w-full px-4 py-3 rounded-lg transition-colors flex items-center ${
            currentView === "task"
              ? "bg-blue-700 text-white font-semibold shadow-md"
              : "bg-white text-blue-800 hover:bg-blue-100"
          } ${isCollapsed ? "justify-center" : "justify-start"}`}
          aria-label="Task View"
        >
          <List size={20} className={`flex-shrink-0 ${currentView === "task" ? "text-white" : "text-blue-800"}`} />
          {!isCollapsed && <span className="ml-2 text-sm font-medium">Task View</span>}
        </button>

        <button
          onClick={() => handleNavigation("timeframe")}
          className={`w-full px-4 py-3 rounded-lg transition-colors flex items-center ${
            currentView === "timeframe"
              ? "bg-blue-700 text-white font-semibold shadow-md"
              : "bg-white text-blue-800 hover:bg-blue-100"
          } ${isCollapsed ? "justify-center" : "justify-start"}`}
          aria-label="Timeframe View"
        >
          <Calendar size={20} className={`flex-shrink-0 ${currentView === "timeframe" ? "text-white" : "text-blue-800"}`} />
          {!isCollapsed && <span className="ml-2 text-sm font-medium">Timeframe View</span>}
        </button>

        <button
          onClick={() => handleNavigation("kanban")}
          className={`w-full px-4 py-3 rounded-lg transition-colors flex items-center ${
            currentView === "kanban"
              ? "bg-blue-700 text-white font-semibold shadow-md"
              : "bg-white text-blue-800 hover:bg-blue-100"
          } ${isCollapsed ? "justify-center" : "justify-start"}`}
          aria-label="Kanban View"
        >
          <Kanban size={20} className={`flex-shrink-0 ${currentView === "kanban" ? "text-white" : "text-blue-800"}`} />
          {!isCollapsed && <span className="ml-2 text-sm font-medium">Kanban View</span>}
        </button>

        <button
          onClick={() => handleNavigation("archived")}
          className={`w-full px-4 py-3 rounded-lg transition-colors flex items-center ${
            currentView === "archived"
              ? "bg-blue-700 text-white font-semibold shadow-md"
              : "bg-white text-blue-800 hover:bg-blue-100"
          } ${isCollapsed ? "justify-center" : "justify-start"}`}
          aria-label="Archived Tasks"
        >
          <Archive size={20} className={`flex-shrink-0 ${currentView === "archived" ? "text-white" : "text-blue-800"}`} />
          {!isCollapsed && <span className="ml-2 text-sm font-medium">Archived Tasks</span>}
        </button>
      </nav>

      {/* Recently Added Tasks Section */}
      <div className="mt-4"> {/* Added space with mt-4 */}
        {!isCollapsed && (
          <>
            <h3 className={`font-semibold mb-3 text-lg flex items-center gap-2 ${localTheme === "light" ? "text-blue-500" : "text-blue-800"}`}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
                style={{ color: localTheme === "light" ? "#3B82F6" : "#1e3a8a" }}
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                  clipRule="evenodd"
                />
              </svg>
              Recently Added
            </h3>
            {recentTasks.length > 0 ? (
              <div
                className="space-y-2 max-h-64 overflow-y-auto pr-2"
                style={{ scrollbarWidth: "none" }} // Hide scrollbar for Firefox
              >
                {recentTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`p-3 rounded-lg shadow-sm border-l-4 hover:shadow-md transition-shadow cursor-pointer
                      ${localTheme === "light" ? "bg-blue-50 border-blue-300" : "bg-white bg-opacity-10 border-blue-500"}`}
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent("highlightTask", { detail: { taskId: task.id } }));
                    }}
                  >
                    <h4 className="font-medium text-gray-900 text-sm truncate">
                      {task.title}
                    </h4>
                    <div className="flex justify-between items-center mt-2">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          (task?.priority || "") === "High"
                            ? "bg-red-100 text-red-800"
                            : (task?.priority || "") === "Medium"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {task?.priority || "None"}
                      </span>
                      <span className="text-xs text-gray-500">
                        {task?.created_at ? new Date(task.created_at).toLocaleDateString() : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-sm italic">No recent tasks</p>
            )}
          </>
        )}
      </div>
    </aside>
  );
}