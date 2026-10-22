"use client";

import { useState } from "react";
import { AdminHeader } from "@/components/admin-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type AdminTab = "rooms" | "camera-units";

interface AdminTabsProps {
  initialTab: AdminTab;
  rooms: React.ReactNode;
  units: React.ReactNode;
}

// Buildings and Camera units as two tabs at the top of the page. The tab is kept
// in the URL (?tab=) so a reload and the QR link (?code=) land on the right one.
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
    <>
      <AdminHeader />
      <main className="mx-auto w-full max-w-[1120px] px-4 pt-6 pb-12">
        <Tabs value={tab} onValueChange={onChange} className="gap-6">
          <TabsList>
            <TabsTrigger value="rooms">Buildings</TabsTrigger>
            <TabsTrigger value="camera-units">Camera units</TabsTrigger>
          </TabsList>
          <TabsContent value="rooms">{rooms}</TabsContent>
          <TabsContent value="camera-units">{units}</TabsContent>
        </Tabs>
      </main>
    </>
  );
}
