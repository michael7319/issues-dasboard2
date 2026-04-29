import { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "./components/Sidebar";
import TimeframeView from "./components/TimeframeView";
import KanbanView from "./components/KanbanView";
import TaskView from "./components/TaskView";
import ArchivedTasks from "./components/ArchivedTasks";
import TaskViewModal from "./components/TaskViewModal";
import users from "./data/users";

// Dynamic API base URL - uses current host for network access
const API_BASE = `http://${window.location.hostname}:8080`;

// Upload a single attachment to the backend.
// File-type attachments are sent as multipart; links as JSON.
const uploadAttachment = async (taskId, att) => {
  if (att.type === "file" && att._file) {
    const form = new FormData();
    form.append("type", "file");
    form.append("name", att.name || att._file.name);
    form.append("mime_type", att._file.type || "application/octet-stream");
    form.append("size", String(att._file.size));
    form.append("file", att._file, att._file.name);
    const res = await fetch(`${API_BASE}/tasks/${taskId}/attachments`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      let serverMsg = "";
      try { const b = await res.json(); serverMsg = b.error || ""; } catch {}
      throw new Error(`Attachment upload failed (${res.status})${serverMsg ? ": " + serverMsg : ""}`);
    }
    return await res.json();
  }
  // Link type — plain JSON
  const { _file, ...cleanAtt } = att;
  const res = await fetch(`${API_BASE}/tasks/${taskId}/attachments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toSnakeCase(cleanAtt)),
  });
  if (!res.ok) {
    let serverMsg = "";
    try { const b = await res.json(); serverMsg = b.error || ""; } catch {}
    throw new Error(`Attachment upload failed (${res.status})${serverMsg ? ": " + serverMsg : ""}`);
  }
  return await res.json();
};

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
  const [theme, setTheme] = useState(() => {
    // Load theme from localStorage, default to 'light'
    const savedTheme = localStorage.getItem('theme');
    return savedTheme || 'light';
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewedTask, setViewedTask] = useState(null);
  
  // PERFORMANCE: Cache for attachment URLs loaded on-demand (refs = stable, no re-render needed)
  const attachmentCacheRef = useRef(new Map());
  const loadingAttachmentsRef = useRef(new Set());

  // Scroll to top when view changes
  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      // Scroll both window and the main content area
      window.scrollTo({ top: 0, behavior: 'instant' });
      const mainElement = document.querySelector('main');
      if (mainElement) {
        mainElement.scrollTop = 0;
      }
    });
  }, [view]);

  const [fallbackAlerts, setFallbackAlerts] = useState([]);

  useEffect(() => {
    const handleFallbackAlert = (event) => {
      const items = event?.detail?.items || [];
      if (!Array.isArray(items) || items.length === 0) return;

      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const taskId = items.length === 1 ? items[0].id : null;
      const message =
        items.length > 1
          ? `${items.length} tasks are nearing their deadline.`
          : `"${items[0].title}" is nearing its deadline.`;

      setFallbackAlerts((prev) => [...prev, { id, message, taskId }]);

      setTimeout(() => {
        setFallbackAlerts((prev) => prev.filter((alert) => alert.id !== id));
      }, 60000);
    };

    window.addEventListener("taskNotificationFallback", handleFallbackAlert);
    return () => window.removeEventListener("taskNotificationFallback", handleFallbackAlert);
  }, []);

  // Fetch tasks from backend on mount
  useEffect(() => {
    fetchTasks();
  }, []);

  // Save theme to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('theme', theme);
  }, [theme]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/tasks`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log("Fetched tasks:", data);
      
      // CRITICAL PERFORMANCE FIX: Strip large base64 URLs from attachments
      // Keep attachment metadata for UI, but remove heavy data
      const tasksWithLightAttachments = data.map(task => ({
        ...task,
        attachments: task.attachments ? task.attachments.map(att => ({
          ...att,
          url: att.url && att.url.length > 1000 ? '' : att.url // Strip legacy base64, keep short paths/URLs
        })) : []
      }));
      
      setTasks(toCamelCase(tasksWithLightAttachments));
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // PERFORMANCE: Load attachments for a task on-demand with caching
  // useCallback with stable deps so TaskCard's useEffect doesn't loop
  const loadTaskAttachments = useCallback(async (taskId) => {
    const cacheKey = `task-${taskId}`;
    
    // Check cache first
    if (attachmentCacheRef.current.has(cacheKey)) {
      const cached = attachmentCacheRef.current.get(cacheKey);
      setTasks(prevTasks =>
        prevTasks.map(t => t.id === taskId ? { ...t, attachments: cached } : t)
      );
      return cached;
    }
    
    // Prevent duplicate requests
    if (loadingAttachmentsRef.current.has(taskId)) return [];
    loadingAttachmentsRef.current.add(taskId);
    
    try {
      const response = await fetch(`${API_BASE}/tasks/${taskId}/attachments`);
      if (response.ok) {
        const attachments = await response.json();
        const camelAttachments = toCamelCase(attachments);
        attachmentCacheRef.current.set(cacheKey, camelAttachments);
        setTasks(prevTasks =>
          prevTasks.map(t => t.id === taskId ? { ...t, attachments: camelAttachments } : t)
        );
        return camelAttachments;
      }
    } catch (err) {
      console.error(`Failed to load attachments for task ${taskId}:`, err);
    } finally {
      loadingAttachmentsRef.current.delete(taskId);
    }
    return [];
  }, [setTasks]);

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

  const navigateToTask = (taskId) => {
    setView("task");
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("highlightTask", { detail: { taskId } }));
    }, 100);
  };

  // Create task
  const handleCreate = async (taskData) => {
    try {
      let bodyData = { ...taskData };
      const attachments = bodyData.attachments || [];
      delete bodyData.attachments; // Remove from task creation
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
      
      // Add attachments if any
      const createUploadErrors = [];
      if (attachments.length > 0) {
        for (const att of attachments) {
          try {
            await uploadAttachment(newTask.id, att);
          } catch (attErr) {
            console.error("Failed to add attachment:", attErr);
            createUploadErrors.push(`"${att.name || att._file?.name || "file"}": ${attErr.message}`);
          }
        }
        // Fetch attachments for the new task
        const attRes = await fetch(`${API_BASE}/tasks/${newTask.id}/attachments`);
        if (attRes.ok) {
          const attData = await attRes.json();
          newTask.attachments = toCamelCase(attData);
        }
      } else {
        newTask.attachments = [];
      }
      
      setTasks(prev => [newTask, ...prev]);
      
      // Dispatch event to notify sidebar to refresh recent tasks
      window.dispatchEvent(new CustomEvent("taskAdded"));

      if (createUploadErrors.length > 0) {
        throw new Error(
          `Task created, but failed to upload attachment(s):\n${createUploadErrors.join("\n")}\n\nPlease re-add the attachment and save again.`
        );
      }
      
      return newTask;
    } catch (err) {
      console.error("Failed to create task:", err);
      if (!err.message?.startsWith("Task created, but")) {
        setError(err.message);
      }
      throw err;
    }
  };

  // Edit task
  const handleEdit = async (taskId, updatedData) => {
    try {
      const attachments = updatedData.attachments || [];
      const existingTask = tasks.find(t => t.id === taskId);
      const existingAttachments = existingTask?.attachments || [];
      
      // Separate attachments from task data
      const taskUpdateData = { ...updatedData };
      delete taskUpdateData.attachments;
      
      const snakeData = toSnakeCase(taskUpdateData);
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
      
      // Handle attachment changes
      // Remove deleted attachments
      for (const existingAtt of existingAttachments) {
        const stillExists = attachments.find(att => att.id === existingAtt.id);
        if (!stillExists && existingAtt.id) {
          try {
            await fetch(`${API_BASE}/tasks/${taskId}/attachments/${existingAtt.id}`, {
              method: 'DELETE'
            });
          } catch (delErr) {
            console.error("Failed to delete attachment:", delErr);
          }
        }
      }
      
      // Add new attachments (those without an id)
      const uploadErrors = [];
      for (const att of attachments) {
        if (!att.id) {
          try {
            await uploadAttachment(taskId, att);
          } catch (attErr) {
            console.error("Failed to add attachment:", attErr);
            uploadErrors.push(`"${att.name || att._file?.name || "file"}": ${attErr.message}`);
          }
        }
      }
      
      // Fetch updated attachments
      const attRes = await fetch(`${API_BASE}/tasks/${taskId}/attachments`);
      if (attRes.ok) {
        const attData = await attRes.json();
        updatedTask.attachments = toCamelCase(attData);
        // Bust cache so next modal open sees fresh data
        attachmentCacheRef.current.delete(`task-${taskId}`);
      } else {
        updatedTask.attachments = [];
      }
      
      // Preserve existing subtasks when updating main task
      setTasks(prev => prev.map((task) => {
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

      // Surface attachment upload errors AFTER the task has been saved
      if (uploadErrors.length > 0) {
        throw new Error(
          `Task saved, but failed to upload attachment(s):\n${uploadErrors.join("\n")}\n\nPlease re-add the attachment and save again.`
        );
      }
      
      return updatedTask;
    } catch (err) {
      console.error("Failed to update task:", err);
      // Only show full-screen error for task-save failures, not attachment failures
      if (!err.message?.startsWith("Task saved, but")) {
        setError(err.message);
      }
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
      
      // Close view modal if it's the task being deleted
      if (viewedTask?.id === taskId) {
        setViewedTask(null);
      }
      
      // Dispatch event to notify sidebar to refresh recent tasks
      window.dispatchEvent(new CustomEvent("taskDeleted"));
    } catch (err) {
      console.error("Failed to delete task:", err);
      setError(err.message);
    }
  };

  // Handle task click to open view modal
  const handleTaskClick = async (task) => {
    setViewedTask(task);
    
    // Always reload attachments when opening the modal to get fresh data
    const loaded = await loadTaskAttachments(task.id);
    if (loaded && loaded.length > 0) {
      setViewedTask(prev => prev?.id === task.id ? { ...prev, attachments: loaded } : prev);
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
        className={`flex-grow p-3 sm:p-6 overflow-y-auto transition-all duration-300 ${isSidebarCollapsed ? "ml-16" : "ml-16 lg:ml-64"} ${theme === "light" ? "bg-gray-100" : "bg-gray-900"}`}
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
            onTaskClick={handleTaskClick}
            onLoadAttachments={loadTaskAttachments}
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
            onTaskClick={handleTaskClick}
          />
        ) : view === "kanban" ? (
          <KanbanView 
            theme={theme}
            tasks={tasks}
            setTasks={setTasks}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onArchive={handleArchive}
            onTaskClick={handleTaskClick}
          />
        ) : view === "archived" ? (
          <ArchivedTasks
            theme={theme}
            tasks={tasks}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onArchive={handleArchive}
            onTaskClick={handleTaskClick}
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

      {fallbackAlerts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[80] flex flex-col gap-2 max-w-sm">
          {fallbackAlerts.map((alert) => (
            <div
              key={alert.id}
              className="rounded-lg border border-amber-300 bg-amber-100 px-4 py-3 text-sm text-amber-900 shadow-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  className={alert.taskId ? "cursor-pointer hover:underline" : ""}
                  onClick={() => alert.taskId && navigateToTask(alert.taskId)}
                >
                  <p className="font-semibold">⏰ Task ending soon</p>
                  <p>
                    {alert.message}
                    {alert.taskId && <span className="ml-1 text-amber-700 text-xs">→ Go to task</span>}
                  </p>
                </div>
                <button
                  onClick={() => setFallbackAlerts((prev) => prev.filter((a) => a.id !== alert.id))}
                  className="shrink-0 text-amber-700 hover:text-amber-900 font-bold text-base leading-none"
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Task View Modal */}
      <TaskViewModal
        task={viewedTask}
        users={users}
        isOpen={!!viewedTask}
        onClose={() => setViewedTask(null)}
        onEdit={(task) => {
          setViewedTask(null);
          // Dispatch custom event to notify view components to open edit modal
          window.dispatchEvent(new CustomEvent("openEditModal", { detail: { task } }));
        }}
        onDelete={handleDelete}
        onTaskUpdate={(updatedTask) => {
          // Update the task in the local state
          setTasks(tasks.map(t => t.id === updatedTask.id ? updatedTask : t));
          // Update the viewed task so the modal reflects changes
          setViewedTask(updatedTask);
        }}
      />
    </div>
  );
}

export default App;