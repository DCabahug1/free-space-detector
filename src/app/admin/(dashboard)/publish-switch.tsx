"use client";

import { useId, useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { setRoomPublished } from "@/app/admin/actions";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface PublishSwitchProps {
  roomId: string;
  published: boolean;
  size?: "sm" | "lg";
}

export function PublishSwitch({ roomId, published, size = "sm" }: PublishSwitchProps) {
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(published);

  function onChange(next: boolean) {
    startTransition(async () => {
      setOptimistic(next);
      const result = await setRoomPublished(roomId, next);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(next ? "Room is live on the public map." : "Room hidden from the public map.");
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Switch
        id={id}
        checked={optimistic}
        onCheckedChange={onChange}
        disabled={pending}
      />
      <Label
        htmlFor={id}
        className={size === "lg" ? "text-base" : "text-sm text-muted-foreground"}
      >
        {optimistic ? "Published" : "Not published"}
      </Label>
    </div>
  );
}
