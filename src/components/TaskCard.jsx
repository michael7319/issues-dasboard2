import React, { useState, useEffect } from "react";
import useLocalStorageTasks from "../hooks/use-tasks";
import users from "../data/users";
import { Pencil, Trash2, Plus } from "lucide-react";

const priorityBorderColors = {
	High: "border-red-500 text-red-600",
	Medium: "border-yellow-500 text-yellow-600",
	Low: "border-green-500 text-green-600",
};

export default function TaskCard({
	task,
	onEdit,
	onDelete,
	onAddSubtask,
	onComplete,
}) {
	const { saveTask } = useLocalStorageTasks("tasks");
	const [isCompleted, setIsCompleted] = useState(task.completed || false);

	useEffect(() => {
		setIsCompleted(task.completed || false);
	}, [task.completed]);

	const main = users.find((u) => Number(u.id) === Number(task.mainAssignee));
	const supporting = users.filter(
		(u) =>
			task.supportingAssignees?.includes(Number(u.id)) &&
			Number(u.id) !== Number(task.mainAssignee),
	);

	const handleToggle = () => {
		const newStatus = !isCompleted;
		setIsCompleted(newStatus);
		onComplete(task.id, newStatus);
	};

	const handleSubtaskToggle = (index) => {
		const updatedSubtasks = task.subtasks.map((sub, i) =>
			i === index ? { ...sub, completed: !sub.completed } : sub,
		);
		const updatedTask = { ...task, subtasks: updatedSubtasks };
		saveTask(updatedTask, task.id);
	};

	const handleEditSubtask = (index) => {
		const updatedTask = { ...task, editSubtaskIndex: index };
		onEdit(updatedTask, { type: "edit-subtask" });
	};

	const handleDeleteSubtask = (index) => {
		const updatedSubtasks = task.subtasks.filter((_, i) => i !== index);
		const updatedTask = { ...task, subtasks: updatedSubtasks };
		saveTask(updatedTask, task.id);
	};

	return (
		<div className="p-4 border border-gray-700 dark:border-gray-500 bg-gray-900 text-white rounded-xl space-y-3 shadow-sm">
			{/* Main Task Block */}
			<div className="p-3 border border-gray-600 rounded-lg bg-gray-800 text-sm space-y-3 relative">
				<div className="mb-1">
					<h3 className="text-base font-semibold">{task.title}</h3>
					<p className="text-sm text-gray-300">{task.description}</p>
				</div>

				<div className="absolute top-2 right-2 flex gap-2">
					<button type="button" onClick={() => onEdit(task)} title="Edit">
						<Pencil size={16} className="text-gray-400 hover:text-blue-400" />
					</button>
					<button
						type="button"
						onClick={() => onDelete(task.id)}
						title="Delete"
					>
						<Trash2 size={16} className="text-gray-400 hover:text-red-400" />
					</button>
				</div>

				<div className="flex justify-between items-end pt-1">
					<div className="flex flex-col items-start gap-2">
						<span
							className={`text-xs font-semibold px-2 py-1 rounded-full border ${
								priorityBorderColors[task.priority] ||
								"border-gray-400 text-gray-200"
							}`}
						>
							{task.priority}
						</span>

						<label className="flex items-center gap-2 text-sm cursor-pointer">
							<input
								type="checkbox"
								checked={isCompleted}
								onChange={handleToggle}
								className="accent-green-500 w-4 h-4"
							/>
							<span
								className={isCompleted ? "text-green-400" : "text-yellow-400"}
							>
								{isCompleted ? "Task Complete" : "Pending"}
							</span>
						</label>
					</div>

					<div className="flex flex-col items-end gap-2">
						<div className="flex flex-wrap justify-end gap-1">
							{main && (
								<span
									title={main.fullName}
									className="text-xs font-semibold bg-blue-500 text-white px-2 py-1 rounded-full shadow"
								>
									{main.initials}
								</span>
							)}
							{supporting.map((user) => (
								<span
									key={user.id}
									title={user.fullName}
									className="text-xs bg-yellow-400 text-black px-2 py-1 rounded-full"
								>
									{user.initials}
								</span>
							))}
						</div>

						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								onAddSubtask(task);
							}}
							className="p-1 text-white bg-blue-600 hover:bg-blue-700 rounded-full"
							title="Add Subtask"
						>
							<Plus size={16} />
						</button>
					</div>
				</div>
			</div>

			{/* Subtasks */}
			{task.subtasks?.length > 0 &&
				task.subtasks.map((sub, idx) => {
					const mainSubAssignee = users.find((u) => u.id === sub.mainAssignee);
					const supportingSubAssignees = users.filter(
						(u) =>
							sub.supportingAssignees?.includes(u.id) &&
							u.id !== sub.mainAssignee,
					);

					return (
						<div
							key={`subtask-${task.id}-${sub.id || idx}`}
							className="p-3 border border-gray-600 rounded-lg bg-gray-800 text-sm relative"
						>
							<div className="absolute top-1 right-1 flex gap-2">
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										handleEditSubtask(idx);
									}}
									title="Edit Subtask"
								>
									<Pencil
										size={14}
										className="text-gray-400 hover:text-blue-400"
									/>
								</button>
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										handleDeleteSubtask(idx);
									}}
									title="Delete Subtask"
								>
									<Trash2
										size={14}
										className="text-gray-400 hover:text-red-400"
									/>
								</button>
							</div>

							<div className="pt-2 space-y-2">
								<label className="flex items-center gap-2 cursor-pointer pr-10">
									<input
										type="checkbox"
										checked={sub.completed}
										onChange={(e) => {
											e.stopPropagation();
											handleSubtaskToggle(idx);
										}}
										className="accent-green-500 w-4 h-4"
									/>
									<span
										className={
											sub.completed ? "line-through text-gray-400" : ""
										}
									>
										{sub.title}
									</span>
								</label>

								<div className="flex gap-1 flex-wrap justify-end">
									{mainSubAssignee && (
										<span
											title={mainSubAssignee.fullName}
											className="text-xs font-semibold bg-blue-500 text-white px-2 py-1 rounded-full shadow"
										>
											{mainSubAssignee.initials}
										</span>
									)}
									{supportingSubAssignees.map((user) => (
										<span
											key={user.id}
											title={user.fullName}
											className="text-xs bg-yellow-400 text-black px-2 py-1 rounded-full"
										>
											{user.initials}
										</span>
									))}
								</div>
							</div>
						</div>
					);
				})}
		</div>
	);
}
