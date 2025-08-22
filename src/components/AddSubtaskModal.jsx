import React, { useState, useEffect } from "react";
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

export default function AddSubtaskModal({
  open,
  onClose,
  onAdd,
  parentTask,
  subtaskToEdit,
}) {
  const isEditMode = Boolean(subtaskToEdit);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [mainAssignee, setMainAssignee] = useState("");
  const [supportingAssignees, setSupportingAssignees] = useState([]);

  // Reset form when modal opens or subtaskToEdit changes
  useEffect(() => {
    if (subtaskToEdit) {
      setTitle(subtaskToEdit.title || "");
      setDescription(subtaskToEdit.description || "");
      setPriority(subtaskToEdit.priority || "Medium");
      setMainAssignee(subtaskToEdit.mainAssignee || "");
      setSupportingAssignees(subtaskToEdit.supportingAssignees || []);
    } else {
      setTitle("");
      setDescription("");
      setPriority("Medium");
      setMainAssignee("");
      setSupportingAssignees([]);
    }
  }, [subtaskToEdit, open]);

  const handleSubmit = () => {
    if (!title.trim() || !mainAssignee) return;

    const subtaskData = {
      id: subtaskToEdit?.id || Date.now(),
      title: title.trim(),
      description: description.trim(),
      priority,
      mainAssignee: Number(mainAssignee),
      supportingAssignees: supportingAssignees.map(Number),
      completed: subtaskToEdit?.completed || false,
      createdAt: subtaskToEdit?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onAdd(parentTask.id, subtaskData);
    onClose();
  };

  const toggleSupporting = (id) => {
    setSupportingAssignees((prev) =>
      prev.includes(id) ? prev.filter((uid) => uid !== id) : [...prev, id]
    );
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Subtask" : "Add New Subtask"}
          </DialogTitle>
        </DialogHeader>

        {/* Title */}
        <div>
          <Label htmlFor="subtask-title">Title</Label>
          <Input
            id="subtask-title"
            placeholder="Subtask title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* Description */}
        <div>
          <Label htmlFor="subtask-description">Description</Label>
          <Textarea
            id="subtask-description"
            placeholder="Subtask description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Priority */}
        <div>
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

        {/* Main Assignee */}
        <div>
          <Label htmlFor="subtask-main-assignee">Main Assignee</Label>
          <select
            id="subtask-main-assignee"
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
            {isEditMode ? "Save Changes" : "Add Subtask"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
