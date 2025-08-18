import React, { useState } from "react";
import useLocalStorageTasks from "../hooks/use-tasks";
import users from "../data/users";

export default function AddTaskModal({ onClose, onAdd, taskToEdit }) {
	const { saveTask } = useLocalStorageTasks("tasks");
	const isEditMode = Boolean(taskToEdit);

	const [title, setTitle] = useState(taskToEdit?.title || "");
	const [description, setDescription] = useState(taskToEdit?.description || "");
	const [priority, setPriority] = useState(taskToEdit?.priority || "Medium");
	const [type, setType] = useState(taskToEdit?.type || "daily");
	const [mainAssignee, setMainAssignee] = useState(
		taskToEdit?.mainAssignee || "",
	);
	const [supportingAssignees, setSupportingAssignees] = useState(
		taskToEdit?.supportingAssignees || [],
	);

	const handleSubmit = () => {
		if (!title.trim() || !mainAssignee) return;

		const taskData = {
			id: taskToEdit?.id || Date.now(),
			title: title.trim(),
			description: description.trim(),
			priority,
			type,
			mainAssignee: Number(mainAssignee),
			supportingAssignees: supportingAssignees.map(Number),
			completed: taskToEdit?.completed || false,
			subtasks: taskToEdit?.subtasks || [],
			createdAt: taskToEdit?.createdAt || new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		if (isEditMode) {
			saveTask(taskData, taskToEdit.id);
		} else {
			saveTask(taskData);
		}

		onAdd(taskData);
		onClose();
	};

	const toggleSupporting = (id) => {
		setSupportingAssignees((prev) =>
			prev.includes(id) ? prev.filter((uid) => uid !== id) : [...prev, id],
		);
	};

	return (
		<div className="fixed inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-50">
			<div className="bg-gray-200 w-full max-w-lg p-6 rounded shadow-lg space-y-4">
				<h2 className="text-xl font-bold text-gray-800">
					{isEditMode ? "Edit Task" : "Add New Task"}
				</h2>

				<input
					type="text"
					placeholder="Title"
					className="w-full p-2 border rounded text-black"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
				/>

				<textarea
					placeholder="Description"
					className="w-full p-2 border rounded text-black"
					rows={3}
					value={description}
					onChange={(e) => setDescription(e.target.value)}
				/>

				<div className="flex gap-2">
					<select
						className="flex-1 p-2 border rounded text-black"
						value={priority}
						onChange={(e) => setPriority(e.target.value)}
					>
						<option value="High">🔥 High</option>
						<option value="Medium">⚠️ Medium</option>
						<option value="Low">✅ Low</option>
					</select>

					<select
						className="flex-1 p-2 border rounded text-black"
						value={type}
						onChange={(e) => setType(e.target.value)}
					>
						<option value="daily">🕒 Daily</option>
						<option value="weekly">🗓️ Weekly</option>
						<option value="project">🛠️ Project</option>
						<option value="custom">✏️ Custom</option>
					</select>
				</div>

				<div>
					<label
						htmlFor="main-assignee"
						className="block text-sm font-medium text-gray-700 mb-1"
					>
						Main Assignee
					</label>
					<select
						id="main-assignee"
						className="w-full p-2 border rounded text-black"
						value={mainAssignee}
						onChange={(e) => setMainAssignee(e.target.value)}
					>
						<option value="">Select</option>
						{users.map((u) => (
							<option key={u.id} value={u.id}>
								{u.initials} — {u.fullName}
							</option>
						))}
					</select>
				</div>

				<div>
					<span className="block text-sm font-medium text-gray-700 mb-1">
						Supporting Assignees
					</span>
					<div className="flex flex-wrap gap-2">
						{users.map((u) => (
							<label key={u.id} className="text-sm flex items-center gap-1">
								<input
									type="checkbox"
									id={`supporting-${u.id}`}
									value={u.id}
									checked={supportingAssignees.includes(u.id)}
									onChange={() => toggleSupporting(u.id)}
								/>
								<span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-bold">
									{u.initials}
								</span>
							</label>
						))}
					</div>
				</div>

				<div className="flex justify-end gap-2">
					<button
						type="button"
						onClick={onClose}
						className="px-4 py-2 bg-red-500 rounded hover:bg-red-600"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={handleSubmit}
						className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
					>
						{isEditMode ? "Save Changes" : "Add Task"}
					</button>
				</div>
			</div>
		</div>
	);
}
