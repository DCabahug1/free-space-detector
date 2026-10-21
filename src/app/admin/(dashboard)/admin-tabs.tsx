"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type AdminTab = "rooms" | "camera-units";

interface AdminTabsProps {
  initialTab: AdminTab;
  rooms: React.ReactNode;
  units: React.ReactNode;
}

// Areas and Camera units as two tabs. The tab is kept in the URL (?tab=)
// so a reload and the QR link (?code=) land on the right one.
export function AdminTabs({ initialTab, rooms, units }: AdminTabsProps) {
  const [tab, setTab] = useState<AdminTab>(initialTab);

  function onChange(value: string) {
    const next = value as AdminTab;
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "rooms") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    url.searchParams.delete("code");
    window.history.replaceState(null, "", url);
  }

  return (
    <Tabs value={tab} onValueChange={onChange}>
      <TabsList>
        <TabsTrigger value="rooms">Areas</TabsTrigger>
        <TabsTrigger value="camera-units">Camera units</TabsTrigger>
      </TabsList>
      <TabsContent value="rooms" className="pt-4">
        {rooms}
      </TabsContent>
      <TabsContent value="camera-units" className="pt-4">
        {units}
      </TabsContent>
    </Tabs>
  );
}
