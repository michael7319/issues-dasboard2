import React, { useEffect, useState } from "react";
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import AddTaskModal from "./AddTaskModal";
import AddSubtaskModal from "./AddSubtaskModal";
import TaskCard from "./TaskCard";
import defaultTasks from "../data/tasks";

export default function KanbanView({ theme }) {
  const [tasks, setTasks] = useState([]);
  const [showSubtaskModal, setShowSubtaskModal] = useState(false);
  const [taskToSubtask, setTaskToSubtask] = useState(null);
  const [editingSubtask, setEditingSubtask] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [error, setError] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  useEffect(() => {
    try {
      const stored = localStorage.getItem("tasks");
      const parsedTasks = stored ? JSON.parse(stored) : defaultTasks;
      const validTasks = parsedTasks.filter(
        (task) => task.id !== undefined && task.id !== null
      );
      if (validTasks.length !== parsedTasks.length) {
        console.warn("Filtered out invalid tasks:", parsedTasks);
        localStorage.setItem("tasks", JSON.stringify(validTasks));
      }
      setTasks(validTasks);
      console.log("Loaded tasks:", validTasks);
    } catch (err) {
      console.error("Error loading tasks:", err);
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("tasks", JSON.stringify(tasks));
    } catch (err) {
      console.error("Error saving tasks:", err);
      setError(err.message);
    }
  }, [tasks]);

  useEffect(() => {
    const handleAddTaskEvent = () => {
      setEditingTask(null);
      setIsModalOpen(true);
    };
    window.addEventListener("addTask", handleAddTaskEvent);
    return () => window.removeEventListener("addTask", handleAddTaskEvent);
  }, []);

  const handleAddOrEditTask = (newTask) => {
    try {
      if (!newTask.id) {
        throw new Error("Task missing ID");
      }
      setTasks((prev) => {
        const exists = prev.find((t) => t.id === newTask.id);
        if (exists) {
          return prev.map((t) => (t.id === newTask.id ? newTask : t));
        }
        return [newTask, ...prev];
      });
      window.dispatchEvent(new CustomEvent("taskAdded", { detail: { task: newTask } }));
      setEditingTask(null);
      setIsModalOpen(false);
    } catch (err) {
      console.error("Error adding/editing task:", err);
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

  const handleDragEnd = (event) => {
    try {
      const { active, over } = event;
      if (!over) return;

      const activeId = active.id;
      const overContainer = over.data.current?.sortable.containerId;

      if (!overContainer) return;

      const newCompletedStatus = overContainer === "Done";
      setTasks((prev) =>
        prev.map((task) =>
          task.id === activeId
            ? {
                ...task,
                completed: newCompletedStatus,
                subtasks: (task.subtasks || []).map((subtask) => ({
                  ...subtask,
                  completed: newCompletedStatus,
                })),
              }
            : task
        )
      );
    } catch (err) {
      console.error("Error in drag-and-drop:", err);
      setError(err.message);
    }
  };

  const SortableTask = ({ task, index, ...props }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: task.id,
      data: { task },
    });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.75 : 1,
      scale: isDragging ? 1.05 : 1,
    };

    return (
      <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="w-full">
        <TaskCard task={task} {...props} />
      </div>
    );
  };

  const splitTasks = (taskList) => {
    const middle = Math.ceil(taskList.length / 2);
    return [taskList.slice(0, middle), taskList.slice(middle)];
  };

  const columns = {
    Todo: tasks.filter(
      (t) => !t.completed || (t.subtasks && t.subtasks.some((s) => !s.completed))
    ),
    Done: tasks.filter(
      (t) => t.completed && (!t.subtasks || t.subtasks.every((s) => s.completed))
    ),
  };

  if (error) {
    return (
      <div className="p-4 bg-red-100 text-red-800 rounded-lg">
        <h2 className="text-lg font-bold">Something went wrong.</h2>
        <p>{error}</p>
        <button
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={() => {
            setError(null);
            setTasks(defaultTasks);
            localStorage.setItem("tasks", JSON.stringify(defaultTasks));
          }}
        >
          Reset Tasks
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col p-4 ${theme === "light" ? "bg-gray-300" : "bg-gray-800"} rounded-lg shadow-lg`}>
      <button
        type="button"
        onClick={() => {
          setEditingTask(null);
          setIsModalOpen(true);
        }}
        className="fixed z-50 px-6 py-3 mb-4 text-sm font-bold text-white bg-blue-600 rounded-full shadow-lg bottom-6 right-6 hover:bg-blue-700 transition-all duration-300"
      >
        + Add Task
      </button>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 w-full">
          {Object.entries(columns).map(([status, taskList]) => {
            const [firstColumn, secondColumn] = splitTasks(taskList);
            return (
              <div
                key={status}
                className={`flex-1 min-w-[400px] p-4 rounded-xl shadow-lg ${theme === "light" ? "bg-gray-300" : "bg-gray-700"} transition-all duration-300`}
              >
                <h2 className={`mb-4 text-xl font-bold flex items-center gap-2 ${theme === "light" ? "text-black" : "text-white"}`}>
                  {status === "Todo" ? "📋" : "✅"} {status}
                  <span className={`ml-2 text-sm ${theme === "light" ? "text-black" : "text-gray-300"}`}> ({taskList.length})</span>
                </h2>
                <SortableContext id={status} items={taskList.map((task) => task.id)} strategy={verticalListSortingStrategy}>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      {firstColumn.map((task, index) =>
                        task.id ? (
                          <SortableTask
                            key={task.id}
                            task={task}
                            index={index}
                            onEdit={(task) => {
                              setEditingTask(task);
                              setIsModalOpen(true);
                            }}
                            onDelete={(taskId) => setTasks(tasks.filter((t) => t.id !== taskId))}
                            onAddSubtask={() => handleAddSubtask(task)}
                            onEditSubtask={(subtask) => handleEditSubtask(task, subtask)}
                            onComplete={(taskId, completed) =>
                              setTasks(tasks.map((t) => (t.id === taskId ? { ...t, completed } : t)))
                            }
                            onDeleteSubtask={(taskId, subtaskId) =>
                              setTasks(
                                tasks.map((t) =>
                                  t.id === taskId
                                    ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) }
                                    : t
                                )
                              )
                            }
                            onUpdateSubtask={(taskId, subtaskId, updates) =>
                              setTasks(
                                tasks.map((t) =>
                                  t.id === taskId
                                    ? {
                                        ...t,
                                        subtasks: t.subtasks.map((s) =>
                                          s.id === subtaskId ? { ...s, ...updates } : s
                                        ),
                                      }
                                    : t
                                )
                              )
                            }
                          />
                        ) : null
                      )}
                    </div>
                    <div className="space-y-2">
                      {secondColumn.map((task, index) =>
                        task.id ? (
                          <SortableTask
                            key={task.id}
                            task={task}
                            index={firstColumn.length + index}
                            onEdit={(task) => {
                              setEditingTask(task);
                              setIsModalOpen(true);
                            }}
                            onDelete={(taskId) => setTasks(tasks.filter((t) => t.id !== taskId))}
                            onAddSubtask={() => handleAddSubtask(task)}
                            onEditSubtask={(subtask) => handleEditSubtask(task, subtask)}
                            onComplete={(taskId, completed) =>
                              setTasks(tasks.map((t) => (t.id === taskId ? { ...t, completed } : t)))
                            }
                            onDeleteSubtask={(taskId, subtaskId) =>
                              setTasks(
                                tasks.map((t) =>
                                  t.id === taskId
                                    ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) }
                                    : t
                                )
                              )
                            }
                            onUpdateSubtask={(taskId, subtaskId, updates) =>
                              setTasks(
                                tasks.map((t) =>
                                  t.id === taskId
                                    ? {
                                        ...t,
                                        subtasks: t.subtasks.map((s) =>
                                          s.id === subtaskId ? { ...s, ...updates } : s
                                        ),
                                      }
                                    : t
                                )
                              )
                            }
                          />
                        ) : null
                      )}
                    </div>
                  </div>
                </SortableContext>
              </div>
            );
          })}
        </div>
      </DndContext>

      <AddTaskModal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTask(null);
        }}
        onAdd={handleAddOrEditTask}
        taskToEdit={editingTask}
      />

      <AddSubtaskModal
        open={showSubtaskModal}
        onClose={() => {
          setShowSubtaskModal(false);
          setTaskToSubtask(null);
          setEditingSubtask(null);
        }}
        onAdd={(taskId, subtask) =>
          setTasks(
            tasks.map((t) =>
              t.id === taskId ? { ...t, subtasks: [...(t.subtasks || [], subtask)] } : t
            )
          )
        }
        onUpdate={(taskId, subtask) =>
          setTasks(
            tasks.map((t) =>
              t.id === taskId
                ? { ...t, subtasks: t.subtasks.map((s) => (s.id === subtask.id ? subtask : s)) }
                : t
            )
          )
        }
        parentTask={taskToSubtask}
        editingSubtask={editingSubtask}
      />
    </div>
  );
}