import React, { useEffect } from "react";
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
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

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

  const formSchema = z.object({
    title: z.string().min(1, { message: "Title is required" }),
    mainAssignee: z.string().min(1, { message: "Main assignee is required" }),
    supportingAssignees: z.array(z.string()).optional(),
    completed: z.boolean().optional(),
    scheduleMode: z.enum(["countdown", "due", "none"]).optional(),
    cdHours: z.string().optional(),
    cdMinutes: z.string().optional(),
    dueAt: z.string().optional(),
    dueWeekday: z.string().optional(),
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      mainAssignee: "",
      supportingAssignees: [],
      completed: false,
      scheduleMode: "none",
      cdHours: "",
      cdMinutes: "",
      dueAt: "",
      dueWeekday: "0",
    },
  });

  useEffect(() => {
    if (open) {
      const sch = editingSubtask?.schedule || {};
      const total = sch.countdownSeconds ?? 0;

      form.reset({
        title: editingSubtask?.title || "",
        mainAssignee: editingSubtask?.mainAssignee
          ? String(editingSubtask.mainAssignee)
          : "",
        supportingAssignees: editingSubtask?.supportingAssignees?.map(String) || [],
        completed: editingSubtask?.completed || false,
        scheduleMode: sch.mode || "none",
        cdHours: sch.mode === "countdown" ? String(Math.floor(total / 3600)) : "",
        cdMinutes: sch.mode === "countdown" ? String(Math.floor((total % 3600) / 60)) : "",
        dueAt: sch.dueAt || "",
        dueWeekday: sch.dueWeekday?.toString() || "0",
      });
    }
  }, [open, editingSubtask, form]);

  const handleSubmit = (values) => {
    let schedule = null;

    if (values.scheduleMode === "countdown") {
      const totalSeconds =
        Math.max(0, parseInt(values.cdHours || "0", 10)) * 3600 +
        Math.max(0, parseInt(values.cdMinutes || "0", 10)) * 60;

      if (totalSeconds > 0) {
        schedule = {
          mode: "countdown",
          countdownSeconds: totalSeconds,
          countdownStartAt: new Date().toISOString(),
        };
      }
    } else if (values.scheduleMode === "due") {
      schedule = {
        mode: "due",
        dueAt: values.dueAt || null,
        dueWeekday: values.dueWeekday ? Number(values.dueWeekday) : null,
      };
    }

    const subtaskData = {
      id: editingSubtask?.id || Date.now(),
      title: values.title,
      completed: values.completed,
      mainAssignee: Number(values.mainAssignee),
      supportingAssignees: values.supportingAssignees.map(Number),
      schedule,
    };

    if (isEditMode) {
      onUpdate(parentTask.id, subtaskData);
    } else {
      onAdd(parentTask.id, subtaskData);
    }

    handleClose();
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(openState) => {
        if (!openState) {
          handleClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-center">
            {isEditMode ? "Edit Subtask" : `Add Subtask to "${parentTask?.title}"`}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
          {/* Title Input */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Enter subtask title"
              {...form.register("title")}
              className={form.formState.errors.title ? "border-red-500" : ""}
              required
            />
          </div>

          {/* Main Assignee Select */}
          <div className="space-y-2">
            <Label htmlFor="mainAssignee">Main Assignee *</Label>
            <Controller
              name="mainAssignee"
              control={form.control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} required>
                  <SelectTrigger id="mainAssignee">
                    <SelectValue placeholder="Select main assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={String(user.id)}>
                        {user.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Supporting Assignees */}
          <div className="space-y-2">
            <Label>Supporting Assignees</Label>
            <Controller
              name="supportingAssignees"
              control={form.control}
              render={({ field }) => (
                <div className="grid gap-2 max-h-40 overflow-y-auto p-3 border rounded-md">
                  {users.map((user) => (
                    <div key={user.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`supporting-${user.id}`}
                        checked={field.value.includes(String(user.id))}
                        onCheckedChange={(checked) => {
                          field.onChange(
                            checked
                              ? [...field.value, String(user.id)]
                              : field.value.filter((id) => id !== String(user.id))
                          );
                        }}
                      />
                      <label
                        htmlFor={`supporting-${user.id}`}
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        {user.fullName}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            />
          </div>

          {/* Schedule Mode */}
          <div className="space-y-2">
            <Label>Schedule</Label>
            <Controller
              name="scheduleMode"
              control={form.control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="countdown">Countdown</SelectItem>
                    <SelectItem value="due">Due Date</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Countdown Fields */}
          {form.watch("scheduleMode") === "countdown" && (
            <div>
              <Label className="text-xs block mb-1">Countdown (Hours / Minutes)</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  min={0}
                  placeholder="Hours"
                  {...form.register("cdHours")}
                />
                <Input
                  type="number"
                  min={0}
                  max={59}
                  placeholder="Minutes"
                  {...form.register("cdMinutes")}
                />
              </div>
            </div>
          )}

          {/* Due Date + Weekly Repeat side by side */}
          {form.watch("scheduleMode") === "due" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="dueAt">Due Date</Label>
                <Input id="dueAt" type="date" {...form.register("dueAt")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueWeekday">Weekly Repeat</Label>
                <Controller
                  name="dueWeekday"
                  control={form.control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select weekday" />
                      </SelectTrigger>
                      <SelectContent>
                        {WEEKDAYS.map((day, idx) => (
                          <SelectItem key={idx} value={String(idx)}>
                            {day}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          )}

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
              className="w-full sm:w-auto"
              disabled={!form.formState.isValid}
            >
              {isEditMode ? "Update Subtask" : "Add Subtask"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
