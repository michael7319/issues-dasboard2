import React, { useEffect, useState } from "react";
import TaskCard from "./TaskCard";
import AddTaskModal from "./AddTaskModal";
import AddSubtaskModal from "./AddSubtaskModal";
import users from "../data/users";
import defaultTasks from "../data/tasks";

export default function TimeframeView() {
  const [tasks, setTasks] = useState([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState("all");
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

  useEffect(() => {
    const stored = localStorage.getItem("tasks");
    if (!stored || stored === "[]" || stored === "null") {
      setTasks(defaultTasks);
      localStorage.setItem("tasks", JSON.stringify(defaultTasks));
    } else {
      setTasks(JSON.parse(stored));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("tasks", JSON.stringify(tasks));
  }, [tasks]);

  // Listen for addTask event from Sidebar
  useEffect(() => {
    const handleAddTaskEvent = () => {
      setEditingTask(null);
      setIsModalOpen(true);
    };
    window.addEventListener("addTask", handleAddTaskEvent);
    return () => window.removeEventListener("addTask", handleAddTaskEvent);
  }, []);

  const handleAddOrEditTask = (newTask) => {
    setTasks((prev) => {
      const exists = prev.find((t) => t.id === newTask.id);
      if (exists) {
        return prev.map((t) => (t.id === newTask.id ? newTask : t));
      }
      return [newTask, ...prev];
    });

    setEditingTask(null);
    setIsModalOpen(false);
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleUpdateTask = (updatedTask, task_id) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) => (task.id === task_id ? updatedTask : task))
    );
  };

  const handleDeleteTask = (taskId) => {
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
  };

  const handleDeleteSubtask = (taskId, subtaskId) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              subtasks: task.subtasks.filter((s) => s.id !== subtaskId),
            }
          : task
      )
    );
  };

  const handleUpdateSubtask = (taskId, subtaskId, updates) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              subtasks: task.subtasks.map((s) =>
                s.id === subtaskId ? { ...s, ...updates } : s
              ),
            }
          : task
      )
    );
  };

  const handleMarkComplete = (taskId, completed) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, completed } : task))
    );
  };

  const handleAddSubtask = (task) => {
    console.log("Adding subtask to task:", task.id);
    setTaskToSubtask(task);
    setEditingSubtask(null);
    setShowSubtaskModal(true);
  };

  const handleEditSubtask = (task, subtask) => {
    console.log("Editing subtask:", subtask.id);
    setTaskToSubtask(task);
    setEditingSubtask(subtask);
    setShowSubtaskModal(true);
  };

  const handleAddTask = () => {
    setEditingTask(null);
    setIsModalOpen(true);
  };

  const timeframes = ["all", "daily", "weekly", "project", "custom"];
  const groups = { daily: [], weekly: [], project: [], custom: [] };
  for (const task of tasks) {
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
      Number(task.mainAssignee) === Number(assigneeFilter) ||
      task.supportingAssignees.includes(Number(assigneeFilter));
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

  return (
    <div className="relative flex flex-col p-3 gap-4">
      {/* Filters & search controls */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 p-3 rounded-lg shadow bg-gray-900/80 backdrop-blur-sm">
        <div className="flex gap-2 overflow-x-auto">
          {timeframes.map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setSelectedTimeframe(tf)}
              className={tabClass(tf)}
            >
              <span className="flex items-center gap-2">
                {tf === "all"
                  ? "All"
                  : `${getIcon(tf)} ${
                      tf.charAt(0).toUpperCase() + tf.slice(1)
                    }`}
                {tf !== "all" && (
                  <span className="bg-black/30 px-2 py-1 rounded-full text-xs font-semibold">
                    {groups[tf].length}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>

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
        >
          <option value="all" className="bg-blue-200">
            All Tasks
          </option>
          <optgroup label="Priority">
            <option value="priority:High" className="bg-blue-200">
              🔥 High
            </option>
            <option value="priority:Medium" className="bg-blue-200">
              ⚠️ Medium
            </option>
            <option value="priority:Low" className="bg-blue-200">
              ✅ Low
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
            className="p-3 rounded-lg shadow-md bg-white/10 animate-fadeIn"
          >
            <h2 className="flex items-center gap-2 mb-3 text-lg font-semibold capitalize text-white">
              {getIcon(type)} {type.charAt(0).toUpperCase() + type.slice(1)}{" "}
              Tasks
            </h2>

            {filtered.length > 0 ? (
              <div className={`flex gap-2 flex-wrap ${gapClass.medium}`}>
                {filtered.map((task) => (
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
                      onEditSubtask={(subtask) =>
                        handleEditSubtask(task, subtask)
                      }
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
        );
      })}

      {/* Global Add Task Button */}
      <button
        type="button"
        onClick={handleAddTask}
        className="fixed z-50 px-6 py-3 text-sm font-bold text-white bg-blue-600 rounded-full shadow-lg bottom-6 right-6 hover:bg-blue-700"
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
        onAdd={(taskId, subtask) => {
          setTasks((prev) =>
            prev.map((task) =>
              task.id === taskId
                ? { ...task, subtasks: [...(task.subtasks || []), subtask] }
                : task
            )
          );
          setShowSubtaskModal(false);
          setTaskToSubtask(null);
        }}
        onUpdate={(taskId, subtask) => {
          setTasks((prev) =>
            prev.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    subtasks: task.subtasks.map((s) =>
                      s.id === subtask.id ? subtask : s
                    ),
                  }
                : task
            )
          );
          setShowSubtaskModal(false);
          setTaskToSubtask(null);
          setEditingSubtask(null);
        }}
        parentTask={taskToSubtask}
        editingSubtask={editingSubtask}
      />
    </div>
  );
}
