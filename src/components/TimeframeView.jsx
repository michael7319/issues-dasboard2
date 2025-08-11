import React, { useState, useMemo } from "react";
import TaskCard from "./TaskCard";
import AddTaskModal from "./AddTaskModal";
import AddSubtaskModal from "./AddSubtaskModal";
import useLocalStorageTasks from "../hooks/use-tasks";
import users from "../data/users";
import defaultTasks from "../data/tasks";

export default function TimeframeView() {
	const { tasks, loading, error, saveTask, deleteTask, updateMultipleTasks } =
		useLocalStorageTasks("tasks");

	const [selectedTimeframe, setSelectedTimeframe] = useState("all");
	const [priorityFilter, setPriorityFilter] = useState("all");
	const [assigneeFilter, setAssigneeFilter] = useState("all");
	const [showModal, setShowModal] = useState(false);
	const [editingTask, setEditingTask] = useState(null);
	const [showSubtaskModal, setShowSubtaskModal] = useState(false);
	const [taskToSubtask, setTaskToSubtask] = useState(null);

	// Initialize with default tasks if no tasks exist
	React.useEffect(() => {
		if (tasks.length === 0 && !loading) {
			console.log("No tasks found, initializing with defaults:", defaultTasks);
			updateMultipleTasks(() => defaultTasks);
		}
	}, [tasks.length, loading, updateMultipleTasks]);

	const handleAddOrEditTask = (newTask) => {
		if (editingTask) {
			saveTask(newTask, editingTask.id);
		} else {
			saveTask(newTask);
		}
		setEditingTask(null);
		setShowModal(false);
	};

	const handleEditTask = (task) => {
		setEditingTask(task);
		setShowModal(true);
	};

	const handleUpdateTask = (taskId, taskData) => {
		saveTask(taskData, taskId);
	};

	const handleDeleteTask = (taskId) => {
		deleteTask(taskId);
	};

	const handleMarkComplete = (taskId, completed) => {
		const task = tasks.find((t) => t.id === taskId);
		if (task) {
			saveTask({ ...task, completed }, taskId);
		}
	};

	const timeframes = ["all", "daily", "weekly", "project", "custom"];

	// Use useMemo to recalculate groups when tasks change
	const groups = useMemo(() => {
		const groupMap = {
			daily: [],
			weekly: [],
			project: [],
			custom: [],
		};

		for (const task of tasks) {
			if (groupMap[task.type]) {
				groupMap[task.type].push(task);
			} else {
				groupMap.custom.push(task);
			}
		}

		return groupMap;
	}, [tasks]);

	const getIcon = (type) => {
		switch (type) {
			case "daily":
				return "🕒";
			case "weekly":
				return "🗓️";
			case "project":
				return "🛠️";
			case "custom":
				return "✏️";
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

	// Show loading state
	if (loading) {
		return (
			<div className="p-4 flex items-center justify-center min-h-[400px]">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
					<p className="text-gray-300">Loading tasks...</p>
				</div>
			</div>
		);
	}

	// Show error state
	if (error) {
		return (
			<div className="p-4 flex items-center justify-center min-h-[400px]">
				<div className="text-center">
					<div className="text-red-500 text-6xl mb-4">⚠️</div>
					<p className="text-red-400 mb-2">Error loading tasks</p>
					<p className="text-gray-400 text-sm">{error}</p>
				</div>
			</div>
		);
	}

	return (
		<div className="p-4 flex flex-col gap-6 relative">
			{/* Filters */}
			<div className="sticky top-0 z-10 bg-gray-900/80 backdrop-blur-sm p-3 rounded-lg shadow flex flex-wrap gap-3 items-center">
				<div className="flex gap-2 overflow-x-auto">
					{timeframes.map((tf) => (
						<button
							type="button"
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
					className="p-2 pr-8 rounded border bg-orange-300 text-black border-blue-300 text-sm appearance-none relative"
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
			</div>

			{/* Task Groups */}
			{Object.entries(groups).map(([type, taskList]) => {
				if (selectedTimeframe !== "all" && selectedTimeframe !== type)
					return null;
				const filtered = taskList.filter(filterTask);

				return (
					<div
						key={type}
						className="bg-white/10 p-4 rounded-lg shadow-md animate-fadeIn"
					>
						<h2 className="text-xl font-semibold capitalize mb-4 flex items-center gap-2">
							{getIcon(type)} {type.charAt(0).toUpperCase() + type.slice(1)}{" "}
							Tasks
						</h2>

						{filtered.length > 0 ? (
							<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
								{filtered.map((task) => (
									<div
										key={task.id}
										className="transition-transform duration-300 hover:scale-[1.02]"
									>
										<TaskCard
											task={task}
											onEdit={handleEditTask}
											onDelete={handleDeleteTask}
											onComplete={handleMarkComplete}
											onAddSubtask={() => {
												setTaskToSubtask(task);
												setShowSubtaskModal(true);
											}}
										/>
									</div>
								))}
							</div>
						) : (
							<p className="text-sm text-gray-300 italic">No tasks to show.</p>
						)}
					</div>
				);
			})}

			{/* Global Add Task Button */}
			<button
				type="button"
				onClick={() => {
					setEditingTask(null);
					setShowModal(true);
				}}
				className="fixed bottom-6 right-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-full shadow-lg z-50"
			>
				+ Add Task
			</button>

			{/* Add/Edit Modal */}
			{showModal && (
				<AddTaskModal
					onClose={() => {
						setShowModal(false);
						setEditingTask(null);
					}}
					onAdd={handleAddOrEditTask}
					taskToEdit={editingTask}
				/>
			)}

			{/* AddSubtaskModal */}
			<AddSubtaskModal
				isOpen={showSubtaskModal}
				onClose={() => setShowSubtaskModal(false)}
				onAdd={() => {}} // No longer needed as modal handles data directly
				parentTask={taskToSubtask}
			/>
		</div>
	);
}
