import { useState, useEffect } from "react";
import useLocalStorageTasks from "./hooks/use-tasks";
import Sidebar from "./components/Sidebar";
import TimeframeView from "./components/TimeframeView";
import KanbanView from "./components/KanbanView";
import TaskView from "./components/TaskView";
import ArchivedTasks from "./components/ArchivedTasks"; // ✅ New import

function App() {
  const [view, setView] = useState("task");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { tasks, setTasks, clearAllTasks } = useLocalStorageTasks("tasks");

  // Handle sidebar toggle for layout
  useEffect(() => {
    const handleSidebarToggle = (event) => {
      setIsSidebarCollapsed(event.detail.isCollapsed);
    };
    window.addEventListener("sidebarToggle", handleSidebarToggle);
    return () =>
      window.removeEventListener("sidebarToggle", handleSidebarToggle);
  }, []);

  // Switch view for addTask if in KanbanView
  useEffect(() => {
    const handleAddTask = () => {
      if (view === "kanban") {
        setView("task");
      }
    };
    window.addEventListener("addTask", handleAddTask);
    return () => window.removeEventListener("addTask", handleAddTask);
  }, [view]);

  // Debug navigation events
  useEffect(() => {
    const handleNavigate = (event) => {
      console.log("Navigate event:", event.detail.view);
    };
    window.addEventListener("navigate", handleNavigate);
    return () => window.removeEventListener("navigate", handleNavigate);
  }, []);

  const clearTasks = () => {
    clearAllTasks();
    window.location.reload();
  };

  // Edit, delete, and archive handlers
  const handleEdit = (taskId, updatedData) => {
    setTasks(
      tasks.map((task) =>
        task.id === taskId ? { ...task, ...updatedData } : task
      )
    );
  };

  const handleDelete = (taskId) => {
    setTasks(tasks.filter((task) => task.id !== taskId));
  };

  const handleArchive = (taskId) => {
    setTasks(
      tasks.map((task) =>
        task.id === taskId ? { ...task, archived: !task.archived } : task
      )
    );
  };

  // Get recent tasks (last 5, not archived, sorted by createdAt)
  const recentTasks = tasks
    .filter((task) => !task.archived)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  return (
    <div className="flex min-h-screen bg-white dark:bg-gray-950 text-gray-800 dark:text-gray-200">
      <Sidebar currentView={view} setView={setView} recentTasks={recentTasks} />
      <main
        className={`flex-grow p-6 overflow-y-auto transition-all duration-300 ${
          isSidebarCollapsed ? "ml-16" : "ml-64"
        } bg-gray-800 dark:bg-gray-950`}
      >
        {view === "task" ? (
          <TaskView
            tasks={tasks}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onArchive={handleArchive}
          />
        ) : view === "timeframe" ? (
          <TimeframeView
            tasks={tasks}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onArchive={handleArchive}
          />
        ) : view === "kanban" ? (
          <KanbanView
            tasks={tasks}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onArchive={handleArchive}
          />
        ) : view === "archived" ? (
          <ArchivedTasks
            tasks={tasks}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onArchive={handleArchive}
          />
        ) : null}
      </main>
      <button
        type="button"
        onClick={clearTasks}
        className="fixed bottom-4 left-4 bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded shadow-lg z-50"
      >
        Clear All Tasks
      </button>
    </div>
  );
}

export default App;
