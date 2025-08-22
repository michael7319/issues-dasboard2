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

  // ✅ Subtask modal state
  const [showSubtaskModal, setShowSubtaskModal] = useState(false);
  const [taskToSubtask, setTaskToSubtask] = useState(null);

  // Spacing variant state
  const [spacingVariant, setSpacingVariant] = useState("medium");

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

  const handleAddOrEditTask = (newTask) => {
    setTasks((prev) => {
      const exists = prev.find((t) => t.id === newTask.id);
      if (exists) return prev.map((t) => (t.id === newTask.id ? newTask : t));
      return [newTask, ...prev];
    });

    // Close the modal after adding/editing and reset editing state
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

  // ✅ Delete main task
  const handleDeleteTask = (taskId) => {
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
  };

  // ✅ Delete subtask
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

  // ✅ Update subtask
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

  const timeframes = ["all", "daily", "weekly", "project", "custom"];
  const groups = { daily: [], weekly: [], project: [], custom: [] };
  tasks.forEach((task) => {
    if (groups[task.type]) groups[task.type].push(task);
    else groups.custom.push(task);
  });

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
    `relative px-4 py-2 rounded-full text-sm font-medium transition-all duration-300
     ${
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
    return matchesPriority && matchesAssignee;
  };

  // Tighter spacing values
  const gapClass = {
    tight: "gap-[2px]",
    medium: "gap-[6px]",
    loose: "gap-[12px]",
  };

  return (
    <div className="relative flex flex-col p-3 gap-4">
      {/* Filters & spacing controls */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 p-3 rounded-lg shadow bg-gray-900/80 backdrop-blur-sm">
        <div className="flex gap-2 overflow-x-auto">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => setSelectedTimeframe(tf)}
              className={tabClass(tf)}
            >
              <span className="flex items-center gap-2">
                {tf === "all"
                  ? "All"
                  : `${getIcon(tf)} ${tf.charAt(0).toUpperCase() + tf.slice(1)}`}
                {tf !== "all" && (
                  <span className="bg-black/30 px-2 py-0.5 rounded-full text-xs font-semibold">
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
          className="relative p-2 pr-8 text-sm text-black bg-orange-300 border border-blue-300 rounded appearance-none"
        >
          <option value="all">All Tasks</option>
          <optgroup label="Priority">
            <option value="priority:High">🔥 High</option>
            <option value="priority:Medium">⚠️ Medium</option>
            <option value="priority:Low">✅ Low</option>
          </optgroup>
          <optgroup label="Assignee">
            {users.map((u) => (
              <option key={u.id} value={`assignee:${u.id}`}>
                {u.initials} — {u.fullName}
              </option>
            ))}
          </optgroup>
        </select>

        {/* Spacing selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-200">Spacing:</span>
          <select
            value={spacingVariant}
            onChange={(e) => setSpacingVariant(e.target.value)}
            className="p-1 text-sm rounded bg-gray-800 text-white"
          >
            <option value="tight">Tight</option>
            <option value="medium">Medium</option>
            <option value="loose">Loose</option>
          </select>
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
            <h2 className="flex items-center gap-2 mb-3 text-lg font-semibold capitalize">
              {getIcon(type)} {type.charAt(0).toUpperCase() + type.slice(1)}{" "}
              Tasks
            </h2>

            {filtered.length > 0 ? (
              <div
                className={`flex gap-2 flex-wrap ${gapClass[spacingVariant]}`}
              >
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
                      updateTask={handleUpdateTask}
                      onAddSubtask={() => {
                        setTaskToSubtask(task);
                        setShowSubtaskModal(true);
                      }}
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
        onClick={() => {
          setEditingTask(null);
          setIsModalOpen(true);
        }}
        className="fixed z-50 px-6 py-3 text-sm font-bold text-white bg-blue-600 rounded-full shadow-lg bottom-6 right-6 hover:bg-blue-700"
      >
        + Add Task
      </button>

      {/* ✅ Add/Edit Task Modal (shadcn/Dialog version) */}
      <AddTaskModal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTask(null);
        }}
        onAdd={handleAddOrEditTask}
        taskToEdit={editingTask}
      />

      {/* ✅ The only Add Subtask Modal */}
      {showSubtaskModal && taskToSubtask && (
        <AddSubtaskModal
          isOpen={showSubtaskModal}
          onClose={() => setShowSubtaskModal(false)}
          onAdd={(taskId, subtask) => {
            setTasks((prev) =>
              prev.map((task) =>
                task.id === taskId
                  ? { ...task, subtasks: [...(task.subtasks || []), subtask] }
                  : task
              )
            );
            setShowSubtaskModal(false);
          }}
          parentTask={taskToSubtask}
        />
      )}
    </div>
  );
}