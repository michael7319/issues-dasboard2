import { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import TimeframeView from "./components/TimeframeView";
import KanbanView from "./components/KanbanView";
import TaskView from "./components/TaskView";
import ArchivedTasks from "./components/ArchivedTasks";

const API_BASE = "http://localhost:8080";

const toSnakeCase = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map(toSnakeCase);
  }
  if (obj && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      acc[snakeKey] = toSnakeCase(obj[key]);
      return acc;
    }, {});
  }
  return obj;
};

const toCamelCase = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map(toCamelCase);
  }
  if (obj && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = key.replace(/_[a-z]/g, (match) => match[1].toUpperCase());
      acc[camelKey] = toCamelCase(obj[key]);
      return acc;
    }, {});
  }
  return obj;
};

function App() {
  const [view, setView] = useState("task");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [theme, setTheme] = useState("light");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch tasks from backend on mount
  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/tasks`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log("Fetched tasks:", data); // Debug log
      setTasks(toCamelCase(data));
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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

  const clearTasks = async () => {
    try {
      const response = await fetch(`${API_BASE}/tasks/clear`, {
        method: 'POST'
      });
      if (response.ok) {
        setTasks([]);
        // Refetch to ensure consistency
        await fetchTasks();
      }
    } catch (err) {
      console.error("Failed to clear tasks:", err);
      setError(err.message);
    }
  };

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  };

  // Create task
  const handleCreate = async (taskData) => {
    try {
      let bodyData = { ...taskData };
      delete bodyData.id;
      if (bodyData.createdAt) delete bodyData.createdAt;
      if (bodyData.updatedAt) delete bodyData.updatedAt;
      bodyData.archived = false;
      bodyData.created_at = new Date().toISOString();
      bodyData.updated_at = new Date().toISOString();
      const snakeData = toSnakeCase(bodyData);
      const response = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snakeData)
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const newTaskSnake = await response.json();
      const newTask = toCamelCase(newTaskSnake);
      setTasks(prev => [newTask, ...prev]);
      
      // Dispatch event to notify sidebar to refresh recent tasks
      window.dispatchEvent(new CustomEvent("taskAdded"));
      
      return newTask;
    } catch (err) {
      console.error("Failed to create task:", err);
      setError(err.message);
      throw err;
    }
  };

  // Edit task
  const handleEdit = async (taskId, updatedData) => {
    try {
      const snakeData = toSnakeCase(updatedData);
      const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snakeData)
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const updatedTaskSnake = await response.json();
      const updatedTask = toCamelCase(updatedTaskSnake);
      
      // Preserve existing subtasks when updating main task
      setTasks(tasks.map((task) => {
        if (task.id === taskId) {
          return {
            ...updatedTask,
            subtasks: task.subtasks || [] // Preserve existing subtasks
          };
        }
        return task;
      }));

      // Dispatch event to notify sidebar to refresh recent tasks
      window.dispatchEvent(new CustomEvent("taskUpdated"));
      
      return updatedTask;
    } catch (err) {
      console.error("Failed to update task:", err);
      setError(err.message);
      throw err;
    }
  };

  // Delete task
  const handleDelete = async (taskId) => {
    try {
      const response = await fetch(`${API_BASE}/tasks/${taskId}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      setTasks(tasks.filter((task) => task.id !== taskId));
      
      // Dispatch event to notify sidebar to refresh recent tasks
      window.dispatchEvent(new CustomEvent("taskDeleted"));
    } catch (err) {
      console.error("Failed to delete task:", err);
      setError(err.message);
    }
  };

  // Archive/unarchive task
  const handleArchive = async (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const updatedTask = { ...task, archived: !task.archived };
    try {
      const snakeData = toSnakeCase(updatedTask);
      const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snakeData)
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const dataSnake = await response.json();
      const data = toCamelCase(dataSnake);
      setTasks(tasks.map(t => t.id === taskId ? data : t));
      
      // Dispatch event to notify sidebar to refresh recent tasks
      window.dispatchEvent(new CustomEvent("taskArchived"));
    } catch (err) {
      console.error("Failed to archive task:", err);
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <p>Loading tasks...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="text-center">
          <h2 className="text-lg font-bold text-red-600 mb-2">Error</h2>
          <p>{error}</p>
          <button
            onClick={fetchTasks}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex min-h-screen ${theme === "light" ? "bg-white text-gray-800" : "bg-gray-950 text-gray-200"}`}>
      <Sidebar currentView={view} setView={setView} theme={theme} />
      <main
        className={`flex-grow p-6 overflow-y-auto transition-all duration-300 ${isSidebarCollapsed ? "ml-16" : "ml-64"} ${theme === "light" ? "bg-gray-100" : "bg-gray-900"}`}
      >
        {view === "task" ? (
          <TaskView 
            theme={theme} 
            tasks={tasks} 
            setTasks={setTasks}
            onCreate={handleCreate}
            onEdit={handleEdit} 
            onDelete={handleDelete} 
            onArchive={handleArchive} 
          />
        ) : view === "timeframe" ? (
          <TimeframeView 
            theme={theme}
            tasks={tasks}
            setTasks={setTasks}
            onCreate={handleCreate}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onArchive={handleArchive}
          />
        ) : view === "kanban" ? (
          <KanbanView 
            theme={theme}
            tasks={tasks}
            setTasks={setTasks}
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
      {/* <button
        type="button"
        onClick={clearTasks}
        className="fixed bottom-4 left-4 bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded shadow-lg z-50"
      >
        Clear All Tasks
      </button> */}
      <button
        type="button"
        onClick={toggleTheme}
        className={`fixed top-4 right-4 p-2 rounded-full shadow-lg z-50 transition-all duration-300 ${theme === "light" ? "bg-yellow-200 hover:bg-yellow-300 text-gray-800" : "bg-gray-700 hover:bg-gray-600 text-gray-200"}`}
      >
        {theme === "light" ? "🌞" : "🌙"}
      </button>
    </div>
  );
}

export default App;