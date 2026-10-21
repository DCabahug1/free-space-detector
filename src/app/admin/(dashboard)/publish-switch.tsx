"use client";

import { useId, useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { setRoomPublished } from "@/app/admin/actions";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface PublishSwitchProps {
  roomId: string;
  published: boolean;
}

// Flips locally first, then reconciles with the server.
export function PublishSwitch({ roomId, published }: PublishSwitchProps) {
  const id = useId();
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(published);

  function onChange(next: boolean) {
    startTransition(async () => {
      setOptimistic(next);
      const result = await setRoomPublished(roomId, next);
      if (result.error) toast(result.error);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Switch id={id} checked={optimistic} onCheckedChange={onChange} />
      <Label htmlFor={id} className="text-sm">
        {optimistic ? "Published" : "Draft"}
      </Label>
    </div>
  );
}
