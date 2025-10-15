import React, { useEffect, useState, useRef } from "react";
import FilterDropdown from "./ui/FilterDropdown";
import TaskCard from "./TaskCard";
import AddTaskModal from "./AddTaskModal";
import AddSubtaskModal from "./AddSubtaskModal";
import users from "../data/users";

// Dynamic API base URL - uses current host for network access
const API_BASE = `http://${window.location.hostname}:8080`;

export default function TimeframeView({ theme, tasks, setTasks, onCreate, onEdit, onDelete, onArchive, onTaskClick }) {
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

  // Listen for openEditModal event from TaskViewModal
  useEffect(() => {
    const handleOpenEditModal = (e) => {
      if (e.detail?.task) {
        setEditingTask(e.detail.task);
        setIsModalOpen(true);
      }
    };
    window.addEventListener("openEditModal", handleOpenEditModal);
    return () => window.removeEventListener("openEditModal", handleOpenEditModal);
  }, []);

  const [selectedTimeframe, setSelectedTimeframe] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState([]);
  const [assigneeFilter, setAssigneeFilter] = useState([]);
  const [statusFilter, setStatusFilter] = useState([]);
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

  // Helper: safe parse JSON
  const safeParse = (value, fallback) => {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  };

  // Helper: build full backend-compatible subtask payload (snake_case + serialized strings)
  const buildSubtaskPayload = (subtask, overrides = {}) => {
    const mainAssigneeId =
      subtask.mainAssigneeId || subtask.mainAssignee || subtask.main_assignee_id || null;

    let supporting = subtask.supportingAssignees || subtask.supporting_assignees || [];
    if (typeof supporting === "string") {
      supporting = safeParse(supporting, []);
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
        await onCreate(newTask);
      }
      
      setEditingTask(null);
      setIsModalOpen(false);
    } catch (err) {
      console.error("Error in handleAddOrEditTask:", err);
    }
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleArchiveTask = async (taskId) => {
    try {
      await onArchive(taskId);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleMarkComplete = async (taskId, completed) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        const updatedTaskData = { 
          ...task, 
          completed,
        };
        await onEdit(taskId, updatedTaskData);
      }
    } catch (err) {
      console.error("Error completing task:", err);
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

  const handleDeleteSubtask = async (taskId, subtaskId) => {
    try {
      await deleteSubtask(taskId, subtaskId);
      setTasks(prev =>
        prev.map(t =>
          t.id === taskId
            ? { ...t, subtasks: (t.subtasks || []).filter(s => s.id !== subtaskId) }
            : t
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
        const updatedSubtaskData = { ...subtask, ...updates };
        const payload = buildSubtaskPayload(updatedSubtaskData, updates);
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

  const handleAddTask = () => {
    setEditingTask(null);
    setIsModalOpen(true);
  };

  const timeframes = ["all", "daily", "weekly", "project", "custom"];
  
  // Filter out archived tasks first, then group by type
  const nonArchivedTasks = tasks.filter(task => !task.archived);
  const groups = { daily: [], weekly: [], project: [], custom: [] };
  
  for (const task of nonArchivedTasks) {
    if (groups[task.type]) groups[task.type].push(task);
    else groups.custom.push(task);
  }

  const getIcon = (type) => {
    switch (type) {
      case "daily":
        return "🕒";
      case "weekly":
        return "🗓️";
      case "project":
        return "🛠️";
      default:
        return "✏️";
    }
  };

  const tabClass = (timeframe) =>
    `relative px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
      selectedTimeframe === timeframe
        ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg"
        : "border border-gray-700 text-gray-300 hover:border-blue-500 hover:text-white"
    }`;

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

  const filterTask = (task) => {
    const matchesPriority =
      priorityFilter.length === 0 || (task.priority && priorityFilter.includes(task.priority));

    // Main task assignees
    const mainAssigneeId = task.mainAssigneeId || task.mainAssignee || task.main_assignee_id;
    let supportingIds = [];
    let supportingAssignees = task.supportingAssignees || task.supporting_assignees;
    if (supportingAssignees) {
      if (typeof supportingAssignees === 'string') {
        try {
          supportingIds = JSON.parse(supportingAssignees);
        } catch (e) {
          // ignore
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

  if (error) {
    return (
      <div className="p-4 bg-red-100 text-red-800 rounded-lg">
        <h2 className="text-lg font-bold">Something went wrong.</h2>
        <p>{error}</p>
        <button
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={() => setError(null)}
        >
          Dismiss Error
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col p-3 gap-4">
      {loading && (
        <div className="absolute top-4 right-4 z-40">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
        </div>
      )}

      {/* Filters & search controls */}
      <div className={`sticky top-0 z-10 flex flex-wrap items-center gap-3 p-3 rounded-lg shadow ${theme === "dark" ? "bg-blue-950" : "bg-gray-900/80"} backdrop-blur-sm`}>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-200">Timeframe:</span>
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => setSelectedTimeframe(tf)}
              className={tabClass(tf)}
            >
              <span className="text-sm font-bold">
                {tf.charAt(0).toUpperCase() + tf.slice(1)}
              </span>
              {tf !== "all" && (
                <span className="bg-black/30 px-2 py-1 rounded-full text-xs font-semibold">
                  {groups[tf].length}
                </span>
              )}
            </button>
          ))}
        </div>

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
          />
        </div>
      </div>

      {/* Task Groups */}
      {Object.entries(groups).map(([type, taskList]) => {
        if (selectedTimeframe !== "all" && selectedTimeframe !== type)
          return null;
        const filtered = taskList.filter(filterTask);

        return (
          <div
            key={type}
            className={`p-3 rounded-lg shadow-md ${theme === "light" ? "bg-gray-300" : "bg-white/10"} animate-fadeIn`}
          >
            <h2 className={`flex items-center gap-2 mb-3 text-lg font-semibold capitalize ${theme === "light" ? "text-black" : "text-white"}`}>
              {getIcon(type)} {type.charAt(0).toUpperCase() + type.slice(1)}{" "}
              Tasks
            </h2>

            {filtered.length > 0 ? (
              <div className="flex flex-wrap gap-3 justify-start">
                {filtered.map((task) => (
                  <div
                    key={task.id}
                    id={`task-${task.id}`}
                    className={`transition-all duration-300 hover:scale-[1.02] ${highlightedTaskId === task.id ? "ring-4 ring-blue-900 ring-offset-2" : ""}`}
                  >
                    <TaskCard
                      task={task}
                      onEdit={handleEditTask}
                      onDelete={onDelete}
                      onComplete={handleMarkComplete}
                      onAddSubtask={() => handleAddSubtask(task)}
                      onEditSubtask={(subtask) =>
                        handleEditSubtask(task, subtask)
                      }
                      onDeleteSubtask={handleDeleteSubtask}
                      onUpdateSubtask={handleUpdateSubtask}
                      onArchive={handleArchiveTask}
                      onTaskClick={onTaskClick}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm italic text-gray-300">No tasks to show.</p>
            )}
          </div>
        );
      })}

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