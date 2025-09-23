import React, { useEffect, useState } from "react";
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor, useDroppable, DragOverlay } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import AddTaskModal from "./AddTaskModal";
import AddSubtaskModal from "./AddSubtaskModal";
import TaskCard from "./TaskCard";

const API_BASE = "http://localhost:8080";

export default function KanbanView({ theme, tasks, setTasks, onEdit, onDelete, onArchive }) {
  const [showSubtaskModal, setShowSubtaskModal] = useState(false);
  const [taskToSubtask, setTaskToSubtask] = useState(null);
  const [editingSubtask, setEditingSubtask] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [error, setError] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [activeTask, setActiveTask] = useState(null);
  const [loading, setLoading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Listen for add task events from other components
  useEffect(() => {
    const handleAddTaskEvent = () => {
      setEditingTask(null);
      setIsModalOpen(true);
    };
    window.addEventListener("addTask", handleAddTaskEvent);
    return () => window.removeEventListener("addTask", handleAddTaskEvent);
  }, []);

  // API call to create a new task
  const createTask = async (taskData) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...taskData,
          archived: false,
          created_at: new Date().toISOString()
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const newTask = await response.json();
      return newTask;
    } catch (err) {
      console.error("Error creating task:", err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // API call to update a task
  const updateTask = async (taskId, taskData) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const updatedTask = await response.json();
      return updatedTask;
    } catch (err) {
      console.error("Error updating task:", err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
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
        const updatedTask = await updateTask(editingTask.id, newTask);
        setTasks(prev => prev.map(t => t.id === editingTask.id ? updatedTask : t));
      } else {
        // Create new task
        const createdTask = await createTask(newTask);
        setTasks(prev => [createdTask, ...prev]);
      }
      
      window.dispatchEvent(new CustomEvent("taskAdded", { detail: { task: newTask } }));
      setEditingTask(null);
      setIsModalOpen(false);
    } catch (err) {
      // Error already handled in API functions
      console.error("Error in handleAddOrEditTask:", err);
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
      const updatedSubtask = await updateSubtask(taskId, subtask.id, subtask);
      setTasks(prev =>
        prev.map(t =>
          t.id === taskId
            ? { ...t, subtasks: t.subtasks.map(s => s.id === subtask.id ? updatedSubtask : s) }
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
            ? { ...t, subtasks: t.subtasks.filter(s => s.id !== subtaskId) }
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
        const updatedSubtask = await updateSubtask(taskId, subtaskId, updatedSubtaskData);
        setTasks(prev =>
          prev.map(t =>
            t.id === taskId
              ? {
                  ...t,
                  subtasks: t.subtasks.map(s =>
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

  const handleCompleteTask = async (taskId, completed) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        const updatedTaskData = { 
          ...task, 
          completed,
          // If marking as complete, also complete all subtasks
          // If marking as incomplete, leave subtasks as they are
        };
        
        const updatedTask = await updateTask(taskId, updatedTaskData);
        
        // If we have subtasks and we're completing the task, update them too
        if (completed && task.subtasks && task.subtasks.length > 0) {
          const subtaskUpdatePromises = task.subtasks.map(subtask =>
            updateSubtask(taskId, subtask.id, { ...subtask, completed: true })
          );
          await Promise.all(subtaskUpdatePromises);
        }
        
        setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
      }
    } catch (err) {
      // Error already handled in API functions
    }
  };

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
    const task = tasks.find(t => t.id === event.active.id);
    setActiveTask(task);
  };

  const handleDragOver = (event) => {
    const { active, over } = event;
    
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    // Determine what we're over
    const overData = over.data?.current;
    let overContainer = null;

    if (overData?.type === 'container') {
      overContainer = overId; // "Todo" or "Done"
    } else if (overData?.sortable?.containerId) {
      overContainer = overData.sortable.containerId;
    } else {
      // Check if we're over a task and determine its container
      const overTask = tasks.find(t => t.id === overId);
      if (overTask) {
        overContainer = getTaskContainer(overTask);
      }
    }

    if (!overContainer) return;

    const activeTask = tasks.find(t => t.id === activeId);
    const activeContainer = getTaskContainer(activeTask);

    if (activeContainer === overContainer) return;

    // Move task between containers (optimistic update)
    setTasks((prev) => {
      const activeIndex = prev.findIndex(t => t.id === activeId);
      const overIndex = prev.findIndex(t => t.id === overId);
      
      if (activeIndex === -1) return prev;

      const newTasks = [...prev];
      const [movedTask] = newTasks.splice(activeIndex, 1);
      
      // Update completion status based on target container
      const newCompleted = overContainer === "Done";
      movedTask.completed = newCompleted;
      if (movedTask.subtasks) {
        movedTask.subtasks = movedTask.subtasks.map(sub => ({
          ...sub,
          completed: newCompleted
        }));
      }

      // Insert at appropriate position
      if (overIndex >= 0 && overIndex !== activeIndex) {
        const adjustedIndex = overIndex > activeIndex ? overIndex - 1 : overIndex;
        newTasks.splice(adjustedIndex, 0, movedTask);
      } else {
        // Add to end of target container
        const targetTasks = newTasks.filter(t => getTaskContainer(t) === overContainer);
        const lastTargetIndex = newTasks.lastIndexOf(targetTasks[targetTasks.length - 1]);
        newTasks.splice(lastTargetIndex + 1, 0, movedTask);
      }

      return newTasks;
    });
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    
    setActiveId(null);
    setActiveTask(null);
    
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const activeTask = tasks.find(t => t.id === activeId);
    if (!activeTask) return;

    // Determine the target container
    const overData = over.data?.current;
    let overContainer = null;

    if (overData?.type === 'container') {
      overContainer = overId;
    } else {
      const overTask = tasks.find(t => t.id === overId);
      if (overTask) {
        overContainer = getTaskContainer(overTask);
      }
    }

    if (overContainer && overContainer !== getTaskContainer(activeTask)) {
      // Task moved to different container - update in backend
      const newCompleted = overContainer === "Done";
      
      try {
        const updatedTaskData = {
          ...activeTask,
          completed: newCompleted
        };

        await updateTask(activeId, updatedTaskData);

        // Update subtasks if needed
        if (activeTask.subtasks && activeTask.subtasks.length > 0) {
          const subtaskUpdatePromises = activeTask.subtasks.map(subtask =>
            updateSubtask(activeId, subtask.id, { ...subtask, completed: newCompleted })
          );
          await Promise.all(subtaskUpdatePromises);
        }
      } catch (err) {
        // Revert optimistic update on error
        setTasks(prev => prev.map(t => t.id === activeId ? activeTask : t));
      }
    }

    // Handle reordering within the same container if needed
    const activeIndex = tasks.findIndex(t => t.id === activeId);
    const overIndex = tasks.findIndex(t => t.id === overId);
    
    if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
      const activeContainer = getTaskContainer(activeTask);
      const overTask = tasks.find(t => t.id === overId);
      const overContainer = getTaskContainer(overTask);

      if (activeContainer === overContainer) {
        // Same container reorder - update local state
        setTasks((prev) => {
          const newTasks = [...prev];
          const [movedTask] = newTasks.splice(activeIndex, 1);
          newTasks.splice(overIndex, 0, movedTask);
          return newTasks;
        });
      }
    }
  };

  const getTaskContainer = (task) => {
    if (!task) return null;
    const isCompleted = task.completed && (!task.subtasks || task.subtasks.every(s => s.completed));
    return isCompleted ? "Done" : "Todo";
  };

  // Droppable container component
  const DroppableContainer = ({ id, children }) => {
    const { setNodeRef } = useDroppable({
      id,
      data: {
        type: 'container',
      },
    });

    return (
      <div ref={setNodeRef} className="min-h-[200px] w-full">
        {children}
      </div>
    );
  };

  const SortableTask = ({ task, index, ...props }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: task.id,
    });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
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

  const todoTasks = tasks.filter(
    (t) => !t.completed || (t.subtasks && t.subtasks.some((s) => !s.completed))
  );
  const doneTasks = tasks.filter(
    (t) => t.completed && (!t.subtasks || t.subtasks.every((s) => s.completed))
  );

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
    <div className={`flex flex-col p-4 ${theme === "light" ? "bg-gray-500" : "bg-gray-800"} rounded-lg shadow-lg ${loading ? 'opacity-75' : ''}`}>
      <button
        type="button"
        onClick={() => {
          setEditingTask(null);
          setIsModalOpen(true);
        }}
        disabled={loading}
        className="fixed z-50 px-6 py-3 mb-4 text-sm font-bold text-white bg-blue-600 rounded-full shadow-lg bottom-6 right-6 hover:bg-blue-700 transition-all duration-300 disabled:opacity-50"
      >
        + Add Task
      </button>

      {loading && (
        <div className="absolute top-4 right-4 z-40">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
        </div>
      )}

      <DndContext 
        sensors={sensors} 
        collisionDetection={closestCenter} 
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 w-full">
          {[
            { status: "Todo", taskList: todoTasks },
            { status: "Done", taskList: doneTasks }
          ].map(({ status, taskList }) => {
            const [firstColumn, secondColumn] = splitTasks(taskList);
            return (
              <DroppableContainer key={status} id={status}>
                <div className={`flex-1 min-w-[400px] p-4 rounded-xl shadow-lg ${theme === "light" ? "bg-gray-300" : "bg-gray-700"} transition-all duration-300`}>
                  <h2 className={`mb-4 text-xl font-bold flex items-center gap-2 ${theme === "light" ? "text-black" : "text-white"}`}>
                    {status === "Todo" ? "📋" : "✅"} {status}
                    <span className={`ml-2 text-sm ${theme === "light" ? "text-black" : "text-gray-300"}`}> ({taskList.length})</span>
                  </h2>
                  <SortableContext items={taskList.map((task) => task.id)} strategy={verticalListSortingStrategy}>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        {firstColumn.map((task, index) =>
                          task.id ? (
                            <SortableTask
                              key={`${status}-first-${task.id}`}
                              task={task}
                              index={index}
                              onEdit={(task) => {
                                setEditingTask(task);
                                setIsModalOpen(true);
                              }}
                              onDelete={onDelete}
                              onAddSubtask={() => handleAddSubtask(task)}
                              onEditSubtask={(subtask) => handleEditSubtask(task, subtask)}
                              onComplete={handleCompleteTask}
                              onDeleteSubtask={handleDeleteSubtask}
                              onUpdateSubtask={handleUpdateSubtask}
                            />
                          ) : null
                        )}
                      </div>
                      <div className="space-y-2">
                        {secondColumn.map((task, index) =>
                          task.id ? (
                            <SortableTask
                              key={`${status}-second-${task.id}`}
                              task={task}
                              index={firstColumn.length + index}
                              onEdit={(task) => {
                                setEditingTask(task);
                                setIsModalOpen(true);
                              }}
                              onDelete={onDelete}
                              onAddSubtask={() => handleAddSubtask(task)}
                              onEditSubtask={(subtask) => handleEditSubtask(task, subtask)}
                              onComplete={handleCompleteTask}
                              onDeleteSubtask={handleDeleteSubtask}
                              onUpdateSubtask={handleUpdateSubtask}
                            />
                          ) : null
                        )}
                      </div>
                    </div>
                  </SortableContext>
                </div>
              </DroppableContainer>
            );
          })}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="opacity-90 rotate-3 scale-105">
              <TaskCard task={activeTask} />
            </div>
          ) : null}
        </DragOverlay>
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
        onAdd={handleSubtaskAdd}
        onUpdate={handleSubtaskUpdate}
        parentTask={taskToSubtask}
        editingSubtask={editingSubtask}
      />
    </div>
  );
}