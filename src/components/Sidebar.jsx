import React, { useState, useCallback, useEffect } from "react";
import { Calendar, Kanban, ChevronLeft, ChevronRight, List } from "lucide-react";
import useLocalStorageTasks from "../hooks/use-tasks";
import users from "../data/users";

export default function Sidebar({ currentView, setView, recentTasks }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [localRecentTasks, setLocalRecentTasks] = useState(recentTasks || []);
  const { saveTask } = useLocalStorageTasks("tasks");

  // Sync localRecentTasks with localStorage changes
  useEffect(() => {
    const handleStorageChange = () => {
      const stored = JSON.parse(localStorage.getItem("tasks") || "[]");
      setLocalRecentTasks(
        stored
          .filter((task) => !task.completed)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 5)
      );
    };

    // Initial load
    handleStorageChange();

    // Listen for storage changes (e.g., from other components)
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

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

  const handleAddOrEditTask = useCallback(
    (newTask) => {
      saveTask(newTask, newTask.id);
      setLocalRecentTasks((prev) => {
        const exists = prev.find((t) => t.id === newTask.id);
        if (exists) {
          return prev.map((t) => (t.id === newTask.id ? newTask : t));
        }
        const updatedTasks = [newTask, ...prev.filter((t) => !t.completed)];
        return updatedTasks
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 5);
      });
    },
    [saveTask]
  );

  // Listen for task updates from other components
  useEffect(() => {
    const handleTaskAdded = (event) => {
      if (event.detail?.task) {
        handleAddOrEditTask(event.detail.task);
      }
    };
    window.addEventListener("taskAdded", handleTaskAdded);
    return () => window.removeEventListener("taskAdded", handleTaskAdded);
  }, [handleAddOrEditTask]);

  return (
    <aside
      className={`fixed top-0 left-0 h-full transition-all duration-300 ease-in-out ${
        isCollapsed ? "w-16" : "w-64"
      } bg-gradient-to-b from-blue-100 to-blue-200 p-6 shadow-md flex flex-col z-50 border-r border-sidebar-border`}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        {!isCollapsed && (
          <div className="text-center">
            <h2 className="text-2xl font-bold text-yellow-600">Issues Dashboard</h2>
            <p className="text-orange-600 text-sm">Manage your tasks</p>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-full hover:bg-blue-300/50 focus:outline-none focus:ring-2 focus:ring-sidebar-primary transition-colors duration-200"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight size={20} className="text-blue-800" />
          ) : (
            <ChevronLeft size={20} className="text-blue-800" />
          )}
        </button>
      </div>

      {/* Add Task Button */}
      <button
        onClick={handleAddTask}
        className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-3 rounded-lg shadow-md transition-colors flex items-center ${
          isCollapsed ? "justify-center" : "justify-center"
        } gap-2 mb-8`}
        aria-label="Add new task"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
            clipRule="evenodd"
          />
        </svg>
        {!isCollapsed && <span>Add New Task</span>}
      </button>

      {/* Navigation */}
      <nav className="flex flex-col gap-2">
        <button
          onClick={() => handleNavigation("task")}
          className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center ${
            currentView === "task"
              ? "bg-blue-700 text-white font-semibold shadow-md"
              : "bg-white text-blue-800 hover:bg-blue-100"
          } ${isCollapsed ? "justify-center" : ""}`}
          aria-label="Task View"
        >
          <List size={20} className={isCollapsed ? "" : "mr-2"} />
          {isCollapsed ? (
            <span className="text-xs font-medium">Task</span>
          ) : (
            <span className="text-sm font-medium">Task View</span>
          )}
        </button>
        
        <button
          onClick={() => handleNavigation("timeframe")}
          className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center ${
            currentView === "timeframe"
              ? "bg-blue-700 text-white font-semibold shadow-md"
              : "bg-white text-blue-800 hover:bg-blue-100"
          } ${isCollapsed ? "justify-center" : ""}`}
          aria-label="Timeframe View"
        >
          <Calendar size={20} className={isCollapsed ? "" : "mr-2"} />
          {isCollapsed ? (
            <span className="text-xs font-medium">Time</span>
          ) : (
            <span className="text-sm font-medium">Timeframe View</span>
          )}
        </button>
        
        <button
          onClick={() => handleNavigation("kanban")}
          className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center ${
            currentView === "kanban"
              ? "bg-blue-700 text-white font-semibold shadow-md"
              : "bg-white text-blue-800 hover:bg-blue-100"
          } ${isCollapsed ? "justify-center" : ""}`}
          aria-label="Kanban View"
        >
          <Kanban size={20} className={isCollapsed ? "" : "mr-2"} />
          {isCollapsed ? (
            <span className="text-xs font-medium">Kanban</span>
          ) : (
            <span className="text-sm font-medium">Kanban View</span>
          )}
        </button>
      </nav>

      {/* Recently Added Tasks Section with Scroll Wheel */}
      <div className="mt-auto">
        {!isCollapsed && (
          <>
            <h3 className="font-semibold text-blue-800 mb-3 text-lg flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                  clipRule="evenodd"
                />
              </svg>
              Recently Added
            </h3>
            {localRecentTasks.length > 0 ? (
              <div 
                className="space-y-2 max-h-64 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-blue-400 scrollbar-track-blue-100 scrollbar-thumb-rounded-full"
                style={{ scrollbarWidth: 'thin' }}
              >
                {localRecentTasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-white p-3 rounded-lg shadow-sm border-l-4 border-blue-500 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => {
                      console.log("Task clicked:", task.id);
                    }}
                  >
                    <h4 className="font-medium text-gray-900 text-sm truncate">
                      {task.title}
                    </h4>
                    <div className="flex justify-between items-center mt-2">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          task.priority === "High"
                            ? "bg-red-100 text-red-800"
                            : task.priority === "Medium"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {task.priority}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(task.createdAt).toLocaleDateString()}
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