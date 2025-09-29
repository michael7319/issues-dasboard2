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

const WEEKDAYS = [
  "Sunday",
  "Monday", 
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default function AddSubtaskModal({
  open,
  onClose,
  onAdd,
  onUpdate,
  parentTask,
  editingSubtask = null,
}) {
  const isEditMode = editingSubtask !== null;

  // Core subtask fields - match backend structure
  const [title, setTitle] = useState("");
  const [mainAssigneeId, setMainAssigneeId] = useState("");
  const [supportingAssignees, setSupportingAssignees] = useState([]);
  const [completed, setCompleted] = useState(false);

  // Scheduling state
  const [scheduleMode, setScheduleMode] = useState("none");
  const [cdHours, setCdHours] = useState(0);
  const [cdMinutes, setCdMinutes] = useState(0);
  const [dueAt, setDueAt] = useState("");
  const [dueWeekday, setDueWeekday] = useState(0);

  // Form state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Populate on edit / reset on open
  useEffect(() => {
    if (editingSubtask) {
      setTitle(editingSubtask.title || "");
      
      // Handle both old and new field structures
      const mainAssigneeValue = editingSubtask.mainAssigneeId || editingSubtask.mainAssignee || editingSubtask.main_assignee_id;
      setMainAssigneeId(mainAssigneeValue ? String(mainAssigneeValue) : "");
      
      // Parse supporting assignees - could be JSON string or array
      let supportingIds = [];
      const supportingData = editingSubtask.supportingAssignees || editingSubtask.supporting_assignees;
      if (supportingData) {
        if (typeof supportingData === 'string') {
          try {
            supportingIds = JSON.parse(supportingData);
          } catch (e) {
            console.warn("Failed to parse supporting_assignees:", supportingData);
          }
        } else if (Array.isArray(supportingData)) {
          supportingIds = supportingData;
        }
      }
      setSupportingAssignees(supportingIds.map(String));
      
      setCompleted(editingSubtask.completed || false);

      // Parse schedule - could be JSON string or object
      let sch = {};
      if (editingSubtask.schedule) {
        if (typeof editingSubtask.schedule === 'string') {
          try {
            sch = JSON.parse(editingSubtask.schedule);
          } catch (e) {
            console.warn("Failed to parse schedule:", editingSubtask.schedule);
          }
        } else if (typeof editingSubtask.schedule === 'object') {
          sch = editingSubtask.schedule;
        }
      }

      setScheduleMode(sch.mode || "none");

      const total = sch.countdownSeconds ?? 0;
      setCdHours(Math.floor(total / 3600));
      setCdMinutes(Math.floor((total % 3600) / 60));

      setDueAt(sch.dueAt || "");
      setDueWeekday(typeof sch.dueWeekday === "number" ? sch.dueWeekday : 0);
    } else {
      // Reset form for new subtask
      setTitle("");
      setMainAssigneeId("");
      setSupportingAssignees([]);
      setCompleted(false);
      setScheduleMode("none");
      setCdHours(0);
      setCdMinutes(0);
      setDueAt("");
      setDueWeekday(0);
    }
    setError(null);
  }, [editingSubtask, open]);

  const toggleSupporting = (id) => {
    setSupportingAssignees((prev) =>
      prev.includes(id) ? prev.filter((uid) => uid !== id) : [...prev, id]
    );
  };

  const buildSchedule = () => {
    if (scheduleMode === "none") return null;

    if (scheduleMode === "countdown") {
      const totalSeconds =
        Math.max(0, parseInt(cdHours || 0, 10)) * 3600 +
        Math.max(0, parseInt(cdMinutes || 0, 10)) * 60;

      if (totalSeconds > 0) {
        return {
          mode: "countdown",
          countdownSeconds: totalSeconds,
          countdownStartAt: new Date().toISOString(),
        };
      }
    } else if (scheduleMode === "due") {
      const schedule = {
        mode: "due",
      };
      
      // Only add dueAt if it's a valid date string
      if (dueAt && dueAt.trim()) {
        schedule.dueAt = dueAt.trim();
      }
      
      // Only add dueWeekday if it's a valid number
      if (dueWeekday !== null && !isNaN(Number(dueWeekday))) {
        schedule.dueWeekday = Number(dueWeekday);
      }
      
      return schedule;
    }

    return null;
  };

  const handleSubmit = async () => {
    if (!title.trim() || !mainAssigneeId) {
      setError("Title and main assignee are required");
      return;
    }

    // Validate main assignee ID
    const mainAssigneeNum = Number(mainAssigneeId);
    if (isNaN(mainAssigneeNum) || mainAssigneeNum <= 0) {
      setError("Please select a valid main assignee");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const schedule = buildSchedule();

      // Validate and clean supporting assignees
      const cleanSupportingAssignees = supportingAssignees
        .map(Number)
        .filter(id => !isNaN(id) && id > 0 && id !== mainAssigneeNum); // Remove duplicates of main assignee

      // Structure data to match backend expectations
      const subtaskData = {
        // Use the ID if editing, let backend generate if new
        ...(editingSubtask?.id && { id: editingSubtask.id }),
        title: title.trim(), // Ensure max length
        completed: Boolean(completed),
        main_assignee_id: mainAssigneeNum,
        supporting_assignees: JSON.stringify(cleanSupportingAssignees),
        schedule: schedule ? JSON.stringify(schedule) : null,
      };

      console.log("Submitting subtask data:", subtaskData); // Debug log

      if (isEditMode) {
        await onUpdate(parentTask.id, subtaskData);
      } else {
        await onAdd(parentTask.id, subtaskData);
      }

      onClose();
    } catch (err) {
      console.error("Error submitting subtask:", err);
      setError(err.message || "Failed to save subtask. Please check your input and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const showCountdownInputs = scheduleMode === "countdown";
  const showDueInputs = scheduleMode === "due";

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg w-full max-h-[90vh] overflow-y-auto p-4">
        <DialogHeader className="mb-2">
          <DialogTitle className="text-lg">
            {isEditMode ? "Edit Subtask" : `Add Subtask to "${parentTask?.title}"`}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-red-100 text-red-800 rounded-lg mb-4">
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Description */}
        <div className="mb-3 text-sm">
          <Label htmlFor="title" className="mb-1 block">
            Description *
          </Label>
          <Textarea
            id="title"
            rows={3}
            placeholder="Enter subtask description"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="p-1 text-sm resize-none"
            disabled={isSubmitting}
            required
            maxLength={1000}
          />
        </div>

        {/* Main Assignee */}
        <div className="mb-3 text-sm">
          <Label htmlFor="main-assignee" className="mb-1 block">
            Main Assignee *
          </Label>
          <select
            id="main-assignee"
            className="w-full p-1 border rounded text-sm text-black disabled:opacity-50"
            value={mainAssigneeId}
            onChange={(e) => setMainAssigneeId(e.target.value)}
            disabled={isSubmitting}
            required
          >
            <option value="">Select main assignee</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.initials} — {u.fullName}
              </option>
            ))}
          </select>
        </div>

        {/* Supporting Assignees */}
        <div className="mb-3 text-sm">
          <Label className="mb-1 block">Supporting Assignees</Label>
          <div className="flex flex-wrap gap-2">
            {users.map((u) => (
              <label key={u.id} className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  value={u.id}
                  checked={supportingAssignees.includes(String(u.id))}
                  onChange={() => toggleSupporting(String(u.id))}
                  disabled={isSubmitting}
                />
                <span className="bg-yellow-100 text-yellow-800 px-1 py-0.5 rounded font-bold">
                  {u.initials}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Completed Checkbox (only in edit mode) */}
        {isEditMode && (
          <div className="mb-3 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={completed}
                onChange={(e) => setCompleted(e.target.checked)}
                disabled={isSubmitting}
              />
              <span>Mark as completed</span>
            </label>
          </div>
        )}

        {/* Schedule */}
        <div className="mb-3 text-sm">
          <Label className="font-medium block mb-1">Schedule</Label>
          
          {/* Schedule Mode selector */}
          <div className="flex gap-3 mb-2">
            <label className="flex items-center gap-1 text-xs">
              <input
                type="radio"
                checked={scheduleMode === "none"}
                onChange={() => setScheduleMode("none")}
                disabled={isSubmitting}
              />
              None
            </label>
            <label className="flex items-center gap-1 text-xs">
              <input
                type="radio"
                checked={scheduleMode === "countdown"}
                onChange={() => setScheduleMode("countdown")}
                disabled={isSubmitting}
              />
              Countdown
            </label>
            <label className="flex items-center gap-1 text-xs">
              <input
                type="radio"
                checked={scheduleMode === "due"}
                onChange={() => setScheduleMode("due")}
                disabled={isSubmitting}
              />
              Due Date
            </label>
          </div>

          {/* Countdown Fields */}
          {showCountdownInputs && (
            <div className="mb-2">
              <Label className="text-xs block mb-1">
                Countdown (Hours / Minutes)
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  min={0}
                  value={cdHours}
                  onChange={(e) =>
                    setCdHours(Math.max(0, parseInt(e.target.value || 0, 10)))
                  }
                  placeholder="Hours"
                  className="p-1 text-sm"
                  disabled={isSubmitting}
                />
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={cdMinutes}
                  onChange={(e) =>
                    setCdMinutes(
                      Math.min(59, Math.max(0, parseInt(e.target.value || 0, 10)))
                    )
                  }
                  placeholder="Minutes"
                  className="p-1 text-sm"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          )}

          {/* Due Date + Weekly Repeat */}
          {showDueInputs && (
            <div>
              <Label htmlFor="dueAt" className="text-xs block mb-1">
                Due Date
              </Label>
              <Input
                id="dueAt"
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                disabled={isSubmitting}
                className="p-1 text-sm"
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-end gap-2 mt-4">
          <DialogClose asChild>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              className="text-sm"
            >
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="text-sm"
          >
            {isSubmitting ? "Saving..." : isEditMode ? "Update Subtask" : "Add Subtask"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 