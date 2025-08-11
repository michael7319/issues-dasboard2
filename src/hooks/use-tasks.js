import { useState, useEffect, useCallback } from "react";

const useLocalStorageTasks = (storageKey = "tasks") => {
	const [tasks, setTasks] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	// Load tasks from localStorage on mount
	useEffect(() => {
		try {
			const storedTasks = localStorage.getItem(storageKey);
			if (storedTasks) {
				const parsedTasks = JSON.parse(storedTasks);
				setTasks(Array.isArray(parsedTasks) ? parsedTasks : []);
			}
		} catch (err) {
			console.error("Error loading tasks from localStorage:", err);
			setError("Failed to load tasks");
			setTasks([]);
		} finally {
			setLoading(false);
		}
	}, [storageKey]);

	const handleSaveTasks = useCallback(() => {
		if (!loading) {
			try {
				console.log("Saving tasks to localStorage:", tasks);
				localStorage.setItem(storageKey, JSON.stringify(tasks));
				setError(null);
			} catch (err) {
				console.error("Error saving tasks to localStorage:", err);
				setError("Failed to save tasks");
			}
		}
	}, [tasks, storageKey, loading]);

	// Generate unique ID for new tasks
	const generateId = useCallback(() => {
		return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}, []);

	// Create or update a task
	const saveTask = useCallback(
		(taskData, taskId = null) => {
			setTasks((prevTasks) => {
				if (taskId) {
					// Update existing task
					const taskIndex = prevTasks.findIndex((task) => task.id === taskId);
					if (taskIndex !== -1) {
						const updatedTasks = [...prevTasks];
						updatedTasks[taskIndex] = {
							...updatedTasks[taskIndex],
							...taskData,
							id: taskId,
							updatedAt: new Date().toISOString(),
						};
						return updatedTasks;
					}
					console.warn(`Task with ID ${taskId} not found for update`);
					return prevTasks;
				}
				// Create new task
				const newTask = {
					id: generateId(),
					...taskData,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				};
				return [...prevTasks, newTask];
			});
			handleSaveTasks();
		},
		[generateId, handleSaveTasks],
	);

	// Delete a task
	const deleteTask = useCallback(
		(taskId) => {
			setTasks((prevTasks) => prevTasks.filter((task) => task.id !== taskId));
			handleSaveTasks();
		},
		[handleSaveTasks],
	);

	// Get a specific task by ID
	const getTask = useCallback(
		(taskId) => {
			return tasks.find((task) => task.id === taskId) || null;
		},
		[tasks],
	);

	// Clear all tasks
	const clearAllTasks = useCallback(() => {
		setTasks([]);
		handleSaveTasks();
	}, [handleSaveTasks]);

	// Update multiple tasks at once
	const updateMultipleTasks = useCallback(
		(updateFunction) => {
			setTasks((prevTasks) => {
				const updatedTasks = updateFunction(prevTasks);
				return Array.isArray(updatedTasks) ? updatedTasks : prevTasks;
			});
			handleSaveTasks();
		},
		[handleSaveTasks],
	);

	return {
		tasks,
		loading,
		error,
		saveTask, // (taskData, taskId?) => void - Create new or update existing
		deleteTask, // (taskId) => void
		getTask, // (taskId) => task | null
		clearAllTasks, // () => void
		updateMultipleTasks, // (updateFn) => void
		tasksCount: tasks.length,
	};
};

export default useLocalStorageTasks;

/* 
USAGE EXAMPLES:

// In your component
const TaskManager = () => {
    const { 
        tasks, 
        loading, 
        error, 
        saveTask, 
        deleteTask, 
        getTask 
    } = useLocalStorageTasks('myTasks');

    // Create a new task
    const handleCreateTask = () => {
        saveTask({
            title: 'New Task',
            description: 'Task description',
            completed: false,
            priority: 'medium'
        });
    };

    // Update existing task
    const handleUpdateTask = (taskId) => {
        saveTask({
            title: 'Updated Task Title',
            completed: true
        }, taskId);
    };

    // Delete task
    const handleDeleteTask = (taskId) => {
        deleteTask(taskId);
    };

    if (loading) return <div>Loading tasks...</div>;
    if (error) return <div>Error: {error}</div>;

    return (
        <div>
            <button onClick={handleCreateTask}>Add Task</button>
            {tasks.map(task => (
                <div key={task.id}>
                    <h3>{task.title}</h3>
                    <button onClick={() => handleUpdateTask(task.id)}>
                        Update
                    </button>
                    <button onClick={() => handleDeleteTask(task.id)}>
                        Delete
                    </button>
                </div>
            ))}
        </div>
    );
};
*/
