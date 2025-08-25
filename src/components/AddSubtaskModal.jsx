import React, { useState, useEffect } from "react";
import users from "../data/users";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

export default function AddSubtaskModal({
  open,
  onClose,
  onAdd,
  onUpdate,
  parentTask,
  editingSubtask = null
}) {
  const isEditMode = Boolean(editingSubtask);
  const [title, setTitle] = useState("");
  const [mainAssignee, setMainAssignee] = useState("");
  const [supportingAssignees, setSupportingAssignees] = useState([]);
  const [isMounted, setIsMounted] = useState(false);

  // Initialize form
  useEffect(() => {
    setIsMounted(true);
    
    if (editingSubtask) {
      setTitle(editingSubtask.title || "");
      setMainAssignee(String(editingSubtask.mainAssignee || ""));
      setSupportingAssignees(editingSubtask.supportingAssignees || []);
    } else {
      setTitle("");
      setMainAssignee("");
      setSupportingAssignees([]);
    }
  }, [editingSubtask, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Subtask form submitted");
    
    if (!title.trim() || !mainAssignee) {
      console.log("Validation failed - missing title or main assignee");
      return;
    }

    const subtaskData = {
      id: editingSubtask?.id || Date.now(),
      title: title.trim(),
      completed: editingSubtask?.completed || false,
      mainAssignee: Number(mainAssignee),
      supportingAssignees: supportingAssignees.map(Number),
    };

    console.log("Subtask data:", subtaskData);

    if (isEditMode) {
      console.log("Updating subtask");
      onUpdate(parentTask.id, subtaskData);
    } else {
      console.log("Adding new subtask");
      onAdd(parentTask.id, subtaskData);
    }

    handleClose();
  };

  const handleClose = () => {
    console.log("Closing modal");
    setTitle("");
    setMainAssignee("");
    setSupportingAssignees([]);
    onClose();
  };

  const toggleSupporting = (userId) => {
    setSupportingAssignees(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  if (!isMounted) return null;

  return (
    <Dialog open={open} onOpenChange={(openState) => {
      console.log("Dialog open change:", openState);
      if (!openState) {
        handleClose();
      }
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-center">
            {isEditMode ? "Edit Subtask" : `Add Subtask to "${parentTask?.title}"`}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* Title Input */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-right">
              Title *
            </Label>
            <Input
              id="title"
              placeholder="Enter subtask title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full"
              required
            />
          </div>

          {/* Main Assignee Select */}
          <div className="space-y-2">
            <Label htmlFor="mainAssignee" className="text-right">
              Main Assignee *
            </Label>
            <Select 
              value={mainAssignee} 
              onValueChange={setMainAssignee}
              required
            >
              <SelectTrigger id="mainAssignee" className="w-full">
                <SelectValue placeholder="Select main assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Select an assignee</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={String(user.id)}>
                    {user.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Supporting Assignees */}
          <div className="space-y-2">
            <Label className="text-right">Supporting Assignees</Label>
            <div className="grid gap-2 max-h-40 overflow-y-auto p-3 border rounded-md">
              {users.map((user) => (
                <div key={user.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`supporting-${user.id}`}
                    checked={supportingAssignees.includes(user.id)}
                    onCheckedChange={() => toggleSupporting(user.id)}
                  />
                  <label
                    htmlFor={`supporting-${user.id}`}
                    className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {user.fullName}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || !mainAssignee}
              className="w-full sm:w-auto"
            >
              {isEditMode ? "Update Subtask" : "Add Subtask"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}