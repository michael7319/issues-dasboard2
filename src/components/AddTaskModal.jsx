import React, { useState, useEffect } from "react";
import useLocalStorageTasks from "../hooks/use-tasks";
import users from "../data/users";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

export default function AddTaskModal({ open, onClose, onAdd, taskToEdit }) {
  const { saveTask } = useLocalStorageTasks("tasks");
  const isEditMode = Boolean(taskToEdit);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [type, setType] = useState("daily");
  const [mainAssignee, setMainAssignee] = useState("");
  const [supportingAssignees, setSupportingAssignees] = useState([]);

  // Reset form when modal opens or taskToEdit changes
  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title || "");
      setDescription(taskToEdit.description || "");
      setPriority(taskToEdit.priority || "Medium");
      setType(taskToEdit.type || "daily");
      setMainAssignee(taskToEdit.mainAssignee || "");
      setSupportingAssignees(taskToEdit.supportingAssignees || []);
    } else {
      setTitle("");
      setDescription("");
      setPriority("Medium");
      setType("daily");
      setMainAssignee("");
      setSupportingAssignees([]);
    }
  }, [taskToEdit, open]);

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
      prev.includes(id) ? prev.filter((uid) => uid !== id) : [...prev, id]
    );
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        onClose();
      }
    }}>
      <DialogContent className="max-w-lg" showClose={false}>
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Task" : "Add New Task"}
          </DialogTitle>
        </DialogHeader>

        {/* Title */}
        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            placeholder="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* Description */}
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="Task description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Priority & Type */}
        <div className="flex gap-2">
          <div className="flex-1">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="High">🔥 High</SelectItem>
                <SelectItem value="Medium">⚠️ Medium</SelectItem>
                <SelectItem value="Low">✅ Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">🕒 Daily</SelectItem>
                <SelectItem value="weekly">🗓️ Weekly</SelectItem>
                <SelectItem value="project">🛠️ Project</SelectItem>
                <SelectItem value="custom">✏️ Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Main Assignee */}
        <div>
          <Label htmlFor="main-assignee">Main Assignee</Label>
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

        {/* Supporting Assignees */}
        <div>
          <Label>Supporting Assignees</Label>
          <div className="flex flex-wrap gap-2 mt-1">
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

        {/* Footer */}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="destructive">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSubmit}>
            {isEditMode ? "Save Changes" : "Add Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}