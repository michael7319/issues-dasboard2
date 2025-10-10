import React, { useEffect, useState, useRef } from "react";
import FilterDropdown from "./ui/FilterDropdown";
import TaskCard from "./TaskCard";
import AddTaskModal from "./AddTaskModal";
import AddSubtaskModal from "./AddSubtaskModal";
import users from "../data/users";

const API_BASE = "http://localhost:8080";

export default function TaskView({ theme, tasks, setTasks, onCreate, onEdit, onDelete, onArchive }) {
  const [highlightedTaskId, setHighlightedTaskId] = useState(null);

  // Listen for highlightTask event from Sidebar
  useEffect(() => {
    const handleHighlightTask = (e) => {
      if (e.detail?.taskId) {
        setHighlightedTaskId(e.detail.taskId);
        // Optionally scroll to the task
        setTimeout(() => {
          const el = document.getElementById(`task-${e.detail.taskId}`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
        // Remove highlight after 3 seconds
        setTimeout(() => {
          setHighlightedTaskId(null);
        }, 3000);
      }
    };
    window.addEventListener("highlightTask", handleHighlightTask);
    return () => window.removeEventListener("highlightTask", handleHighlightTask);
  }, []);
  // Support multi-select filters for priority and assignees
  const [priorityFilter, setPriorityFilter] = useState([]);
  const [assigneeFilter, setAssigneeFilter] = useState([]);
  const [statusFilter, setStatusFilter] = useState([]); // e.g. ['done','pending']
  const [showFilter, setShowFilter] = useState(false);
  const filterButtonRef = useRef(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  // Subtask modal state
  const [showSubtaskModal, setShowSubtaskModal] = useState(false);
  const [taskToSubtask, setTaskToSubtask] = useState(null);
  const [editingSubtask, setEditingSubtask] = useState(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Listen for addTask event from Sidebar
  useEffect(() => {
    const handleAddTaskEvent = () => {
      setEditingTask(null);
      setIsModalOpen(true);
    };
    window.addEventListener("addTask", handleAddTaskEvent);
    return () => window.removeEventListener("addTask", handleAddTaskEvent);
  }, []);

  // Build full backend-compatible subtask payload (snake_case + serialized strings)
  const buildSubtaskPayload = (subtask, overrides = {}) => {
    const mainAssigneeId =
      subtask.mainAssigneeId || subtask.mainAssignee || subtask.main_assignee_id || null;

    let supporting = subtask.supportingAssignees || subtask.supporting_assignees || [];
    if (typeof supporting === "string") {
      try { supporting = JSON.parse(supporting); } catch { supporting = []; }
    }
    if (!Array.isArray(supporting)) supporting = [];

    const schedule =
      typeof subtask.schedule === "string"
        ? subtask.schedule
        : subtask.schedule
        ? JSON.stringify(subtask.schedule)
        : null;

    return {
      title: subtask.title || "",
      completed:
        typeof overrides.completed === "boolean" ? overrides.completed : !!subtask.completed,
      main_assignee_id:
        mainAssigneeId === null || mainAssigneeId === undefined
          ? null
          : Number(mainAssigneeId) || null,
      supporting_assignees: JSON.stringify(supporting.map(Number)),
      schedule,
    };
  };

  // API call to create a subtask
  const createSubtask = async (taskId, subtaskData) => {
    try {
      setLoading(true);
      console.log("Creating subtask for task:", taskId, "with data:", subtaskData);
      
      const response = await fetch(`${API_BASE}/tasks/${taskId}/subtasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subtaskData)
      });
      
      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage += ` - ${errorData.error || errorData.message || 'Unknown error'}`;
        } catch (parseErr) {
          // If we can't parse the error response, use the status text
          errorMessage += ` - ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      const newSubtask = await response.json();
      return newSubtask;
    } catch (err) {
      console.error("Error creating subtask:", err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // API call to update a subtask
  const updateSubtask = async (taskId, subtaskId, subtaskData) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subtaskData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const updatedSubtask = await response.json();
      return updatedSubtask;
    } catch (err) {
      console.error("Error updating subtask:", err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // API call to delete a subtask
  const deleteSubtask = async (taskId, subtaskId) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (err) {
      console.error("Error deleting subtask:", err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleAddOrEditTask = async (newTask) => {
    try {
      if (editingTask) {
        // Update existing task
        await onEdit(editingTask.id, newTask);
      } else {
        // Create new task
        const createdTask = await onCreate(newTask);
        
        // Dispatch event for sidebar
        window.dispatchEvent(new CustomEvent("taskAdded", { detail: { task: createdTask } }));
      }
      
      setEditingTask(null);
      setIsModalOpen(false);
    } catch (err) {
      console.error("Error in handleAddOrEditTask:", err);
      setError(err.message);
    }
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await onDelete(taskId);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleArchiveTask = async (taskId) => {
    try {
      await onArchive(taskId);
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePinTask = async (taskId) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        const updatedTask = { ...task, pinned: !task.pinned };
        await onEdit(taskId, updatedTask);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteSubtask = async (taskId, subtaskId) => {
    try {
      await deleteSubtask(taskId, subtaskId);
      setTasks(prev =>
        prev.map(task =>
          task.id === taskId
            ? {
                ...task,
                subtasks: (task.subtasks || []).filter(s => s.id !== subtaskId),
              }
            : task
        )
      );
    } catch (err) {
      // Error already handled in API function
    }
  };

  const handleUpdateSubtask = async (taskId, subtaskId, updates) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      const subtask = task?.subtasks?.find(s => s.id === subtaskId);
      
      if (subtask) {
        // Build backend-compatible payload to avoid wiping fields
        const payload = buildSubtaskPayload({ ...subtask, ...updates }, updates);
        const updatedSubtask = await updateSubtask(taskId, subtaskId, payload);
        setTasks(prev =>
          prev.map(t =>
            t.id === taskId
              ? {
                  ...t,
                  subtasks: (t.subtasks || []).map(s =>
                    s.id === subtaskId ? updatedSubtask : s
                  ),
                }
              : t
          )
        );

        // Dispatch event to notify sidebar to refresh recent tasks
        window.dispatchEvent(new CustomEvent("taskUpdated"));
      }
    } catch (err) {
      // Error already handled in API function
    }
  };

  const handleMarkComplete = async (taskId, completed) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        await onEdit(taskId, { ...task, completed });
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddSubtask = (task) => {
    setTaskToSubtask(task);
    setEditingSubtask(null);
    setShowSubtaskModal(true);
  };

  const handleEditSubtask = (task, subtask) => {
    setTaskToSubtask(task);
    setEditingSubtask(subtask);
    setShowSubtaskModal(true);
  };

  const handleSubtaskAdd = async (taskId, subtask) => {
    try {
      const newSubtask = await createSubtask(taskId, subtask);
      setTasks(prev =>
        prev.map(t =>
          t.id === taskId ? { ...t, subtasks: [...(t.subtasks || []), newSubtask] } : t
        )
      );
    } catch (err) {
      // Error already handled in API function
    }
  };

  const handleSubtaskUpdate = async (taskId, subtask) => {
    try {
      // Normalize entire subtask before sending
      const payload = buildSubtaskPayload(subtask);
      const updatedSubtask = await updateSubtask(taskId, subtask.id, payload);
      setTasks(prev =>
        prev.map(t =>
          t.id === taskId
            ? { ...t, subtasks: (t.subtasks || []).map(s => s.id === subtask.id ? updatedSubtask : s) }
            : t
        )
      );
    } catch (err) {
      // Error already handled in API function
    }
  };

  const handleAddTask = () => {
    setEditingTask(null);
    setIsModalOpen(true);
  };

  // helpers to toggle multi-select values
  const togglePriority = (p) => {
    setPriorityFilter(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };
  const toggleAssignee = (id) => {
    setAssigneeFilter(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleStatus = (s) => {
    setStatusFilter(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const clearFilters = () => {
    setPriorityFilter([]);
    setAssigneeFilter([]);
    setStatusFilter([]);
  };

  // FIXED: Filter function with proper field name handling
  const filterTask = (task) => {
    const matchesPriority =
      priorityFilter.length === 0 || (task.priority && priorityFilter.includes(task.priority));

    // Main task assignees
    const mainAssigneeId = task.mainAssigneeId || task.mainAssignee || task.main_assignee_id;
    const supportingAssignees = task.supportingAssignees || task.supporting_assignees;
    let supportingIds = [];
    if (supportingAssignees) {
      if (typeof supportingAssignees === 'string') {
        try {
          supportingIds = JSON.parse(supportingAssignees);
        } catch (e) {
          console.warn("Failed to parse supporting assignees:", supportingAssignees);
        }
      } else if (Array.isArray(supportingAssignees)) {
        supportingIds = supportingAssignees;
      }
    }

    // Subtask assignees
    let subtaskHasAssignee = false;
    if (Array.isArray(task.subtasks)) {
      for (const sub of task.subtasks) {
        const subMainId = sub.mainAssigneeId || sub.mainAssignee || sub.main_assignee_id;
        let subSupporting = sub.supportingAssignees || sub.supporting_assignees;
        let subSupportingIds = [];
        if (subSupporting) {
          if (typeof subSupporting === 'string') {
            try {
              subSupportingIds = JSON.parse(subSupporting);
            } catch (e) {
              // ignore
            }
          } else if (Array.isArray(subSupporting)) {
            subSupportingIds = subSupporting;
          }
        }
        if (
          Number(subMainId) === Number(assigneeFilter) ||
          subSupportingIds.includes(Number(assigneeFilter))
        ) {
          subtaskHasAssignee = true;
          break;
        }
      }
    }

    const matchesAssignee =
      assigneeFilter.length === 0 ||
      assigneeFilter.some(a => Number(mainAssigneeId) === Number(a)) ||
      assigneeFilter.some(a => supportingIds.includes(Number(a))) ||
      subtaskHasAssignee;

    const matchesStatus =
      statusFilter.length === 0 ||
      (statusFilter.includes("done") && task.completed) ||
      (statusFilter.includes("pending") && !task.completed);

    const matchesSearch = task.title
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    return matchesPriority && matchesAssignee && matchesStatus && matchesSearch;
  };

  const gapClass = {
    tight: "gap-[6px]",
    medium: "gap-[12px]",
    loose: "gap-[24px]",
  };

  // Filter out archived tasks and apply filters, then sort by pinned status
  const filteredTasks = tasks
    .filter((t) => !t.archived)
    .filter(filterTask)
    .sort((a, b) => {
      // Pinned tasks first, then by creation date (most recent first)
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

  return (
    <div className="relative flex flex-col p-3 gap-4">
      {error && (
        <div className="p-4 bg-red-100 text-red-800 rounded-lg mb-4">
          <p>{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filters & search controls */}
      <div
        className={`sticky top-0 z-10 flex flex-wrap items-center gap-3 p-3 rounded-lg shadow ${
          theme === "dark" ? "bg-blue-950" : "bg-gray-900/80"
        } backdrop-blur-sm ${loading ? 'opacity-75' : ''}`}
      >
        {/* Filters dropdown: portal-based to avoid z-index issues */}
        <div className="relative inline-block">
          <button 
            ref={filterButtonRef} 
            className="relative p-2 pr-8 text-sm text-blue-900 bg-yellow-300 border border-blue-600 rounded shadow-sm" 
            onClick={() => setShowFilter(!showFilter)}
          >
            Task Filter
            {(priorityFilter.length + assigneeFilter.length + statusFilter.length) > 0 && (
              <span className="absolute -top-2 -right-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-blue-600 rounded-full">
                {priorityFilter.length + assigneeFilter.length + statusFilter.length}
              </span>
            )}
          </button>

          <FilterDropdown 
            buttonRef={filterButtonRef} 
            isOpen={showFilter} 
            onClose={() => setShowFilter(false)}
          >
            <div className="p-3 pointer-events-auto">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-blue-700">Priority</div>
                <button onClick={clearFilters} className="text-white bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-xs">
                  Clear
                </button>
              </div>
              <div className="flex gap-2 mb-3">
                {['High','Medium','Low'].map(p => (
                  <label key={p} className="flex items-center gap-2">
                    <input type="checkbox" checked={priorityFilter.includes(p)} onChange={() => togglePriority(p)} />
                    <span className="text-sm">{p}</span>
                  </label>
                ))}
              </div>
              <div className="mb-2 font-semibold text-blue-700">Assignee</div>
              <div className="max-h-32 overflow-y-auto mb-3 border-l-2 border-yellow-400 pl-2">
                {users.map(u => (
                  <label key={u.id} className="flex items-center gap-2 p-1">
                    <input type="checkbox" checked={assigneeFilter.includes(u.id)} onChange={() => toggleAssignee(u.id)} />
                    <span className="text-sm">{u.initials} — {u.fullName}</span>
                  </label>
                ))}
              </div>
              <div className="mb-2 font-semibold text-blue-700">Status</div>
              <div className="flex gap-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={statusFilter.includes('pending')} onChange={() => toggleStatus('pending')} />
                  <span className="text-sm">Pending</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={statusFilter.includes('done')} onChange={() => toggleStatus('done')} />
                  <span className="text-sm">Done</span>
                </label>
              </div>
            </div>
          </FilterDropdown>
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            className="p-1 text-sm rounded bg-gray-800 text-white placeholder-white focus:text-gray-500"
            disabled={loading}
          />
        </div>

        {loading && (
          <div className="ml-auto">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
          </div>
        )}
      </div>

      {/* Task List */}
      <div
        className={`p-3 rounded-lg shadow-md ${
          theme === "light" ? "bg-gray-300" : "bg-white/10"
        } animate-fadeIn`}
      >
        {filteredTasks.length > 0 ? (
          <div className="flex flex-wrap gap-3 justify-start">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                id={`task-${task.id}`}
                className={`transition-all duration-300 hover:scale-[1.02] ${highlightedTaskId === task.id ? "ring-4 ring-blue-900 ring-offset-2" : ""}`}
              >
                <TaskCard
                  task={task}
                  onEdit={handleEditTask}
                  onDelete={handleDeleteTask}
                  onComplete={handleMarkComplete}
                  onAddSubtask={() => handleAddSubtask(task)}
                  onEditSubtask={(subtask) => handleEditSubtask(task, subtask)}
                  onDeleteSubtask={handleDeleteSubtask}
                  onUpdateSubtask={handleUpdateSubtask}
                  onArchive={handleArchiveTask}
                  onPin={handlePinTask}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm italic text-gray-300">No tasks to show.</p>
        )}
      </div>

      {/* Global Add Task Button */}
      <button
        type="button"
        onClick={handleAddTask}
        disabled={loading}
        className="fixed z-50 px-6 py-3 text-sm font-bold text-white bg-blue-600 rounded-full shadow-lg bottom-6 right-6 hover:bg-blue-700 disabled:opacity-50"
      >
        + Add Task
      </button>

      {/* Add/Edit Task Modal */}
      <AddTaskModal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTask(null);
        }}
        onAdd={handleAddOrEditTask}
        taskToEdit={editingTask}
      />

      {/* Add/Edit Subtask Modal */}
      <AddSubtaskModal
        open={showSubtaskModal}
        onClose={() => {
          setShowSubtaskModal(false);
          setTaskToSubtask(null);
          setEditingSubtask(null);
        }}
        onAdd={handleSubtaskAdd}
        onUpdate={handleSubtaskUpdate}
        parentTask={taskToSubtask}
        editingSubtask={editingSubtask}
      />
    </div>
  );
}