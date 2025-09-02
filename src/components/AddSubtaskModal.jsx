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
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      mainAssignee: "",
      supportingAssignees: [],
      completed: false,
    },
  });

  useEffect(() => {
    console.log("Modal opened with editingSubtask:", editingSubtask);
    if (open) {
      form.reset({
        title: editingSubtask?.title || "",
        mainAssignee: editingSubtask?.mainAssignee ? String(editingSubtask.mainAssignee) : "",
        supportingAssignees: editingSubtask?.supportingAssignees?.map(String) || [],
        completed: editingSubtask?.completed || false,
      });
    }
  }, [open, editingSubtask, form]);

  const handleSubmit = (values) => {
    const subtaskData = {
      id: editingSubtask?.id || Date.now(),
      title: values.title,
      completed: values.completed,
      mainAssignee: Number(values.mainAssignee),
      supportingAssignees: values.supportingAssignees.map(Number),
    };

    console.log("Submitting subtask data:", subtaskData);

    if (isEditMode) {
      onUpdate(parentTask.id, subtaskData);
    } else {
      onAdd(parentTask.id, subtaskData);
    }

    handleClose();
  };

  const handleClose = () => {
    console.log("Closing modal");
    form.reset();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(openState) => {
        console.log("Dialog open change:", openState);
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
            <Label htmlFor="title" className="text-right">
              Title *
            </Label>
            <Input
              id="title"
              placeholder="Enter subtask title"
              {...form.register("title")}
              className={form.formState.errors.title ? "border-red-500" : ""}
              required
            />
            {form.formState.errors.title && (
              <p className="text-red-500 text-xs">{form.formState.errors.title.message}</p>
            )}
          </div>

          {/* Main Assignee Select */}
          <div className="space-y-2">
            <Label htmlFor="mainAssignee" className="text-right">
              Main Assignee *
            </Label>
            <Controller
              name="mainAssignee"
              control={form.control}
              render={({ field }) => (
                <Select 
                  value={field.value} 
                  onValueChange={field.onChange}
                  required
                >
                  <SelectTrigger 
                    id="mainAssignee" 
                    className={form.formState.errors.mainAssignee ? "border-red-500" : ""}
                  >
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
            {form.formState.errors.mainAssignee && (
              <p className="text-red-500 text-xs">{form.formState.errors.mainAssignee.message}</p>
            )}
          </div>

          {/* Supporting Assignees */}
          <div className="space-y-2">
            <Label className="text-right">Supporting Assignees</Label>
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
                        className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {user.fullName}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            />
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