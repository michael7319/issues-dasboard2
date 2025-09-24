import React, { useEffect, useState } from "react";
import TaskCard from "./TaskCard";
import AddTaskModal from "./AddTaskModal";
import AddSubtaskModal from "./AddSubtaskModal";
import users from "../data/users";

const API_BASE = "http://localhost:8080";

export default function TaskView({ theme, tasks, setTasks, onCreate, onEdit, onDelete, onArchive }) {
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
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
      const response = await fetch(`${API_BASE}/tasks/${taskId}/subtasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subtaskData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
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

  const handleUnifiedFilterChange = (value) => {
    if (value === "all") {
      setPriorityFilter("all");
      setAssigneeFilter("all");
    } else if (value.startsWith("priority:")) {
      setPriorityFilter(value.split(":")[1]);
      setAssigneeFilter("all");
    } else if (value.startsWith("assignee:")) {
      setAssigneeFilter(value.split(":")[1]);
      setPriorityFilter("all");
    }
  };

  const filterTask = (task) => {
    const matchesPriority =
      priorityFilter === "all" || task.priority === priorityFilter;
    const matchesAssignee =
      assigneeFilter === "all" ||
      Number(task.main_assignee_id) === Number(assigneeFilter) ||
      (task.supporting_assignees && JSON.parse(task.supporting_assignees).includes(Number(assigneeFilter)));
    const matchesSearch = task.title
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    return matchesPriority && matchesAssignee && matchesSearch;
  };

  const gapClass = {
    tight: "gap-[6px]",
    medium: "gap-[12px]",
    loose: "gap-[24px]",
  };

  const filteredTasks = tasks.filter(filterTask);

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
        <select
          value={
            priorityFilter !== "all"
              ? `priority:${priorityFilter}`
              : assigneeFilter !== "all"
              ? `assignee:${assigneeFilter}`
              : "all"
          }
          onChange={(e) => handleUnifiedFilterChange(e.target.value)}
          className="relative p-2 pr-8 text-sm text-black bg-yellow-200 border border-blue-300 rounded appearance-none"
          disabled={loading}
        >
          <option value="all" className="bg-blue-200">
            All Tasks
          </option>
          <optgroup label="Priority">
            <option value="priority:High" className="bg-blue-200">
              High
            </option>
            <option value="priority:Medium" className="bg-blue-200">
              Medium
            </option>
            <option value="priority:Low" className="bg-blue-200">
              Low
            </option>
          </optgroup>
          <optgroup label="Assignee">
            {users.map((u) => (
              <option
                key={u.id}
                value={`assignee:${u.id}`}
                className="bg-blue-200"
              >
                {u.initials} — {u.fullName}
              </option>
            ))}
          </optgroup>
        </select>

        {/* Search bar */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-200">Search:</span>
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
          <div className={`flex gap-2 flex-wrap ${gapClass.medium}`}>
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className="transition-all duration-300 hover:scale-[1.01]"
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