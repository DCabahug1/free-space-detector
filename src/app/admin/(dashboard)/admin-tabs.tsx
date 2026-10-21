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

const bandTab =
  "h-[42px] flex-none rounded-none border-0 border-b-[3px] border-transparent px-3.5 text-sm font-medium text-band-muted shadow-none after:hidden hover:text-band-foreground dark:text-band-muted dark:hover:text-band-foreground data-[state=active]:border-band-accent data-[state=active]:bg-transparent data-[state=active]:text-band-foreground dark:data-[state=active]:bg-transparent dark:data-[state=active]:text-band-foreground";

// Areas and Camera units as two tabs on the header band. The tab is kept in
// the URL (?tab=) so a reload and the QR link (?code=) land on the right one.
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
    <Tabs value={tab} onValueChange={onChange} className="gap-0">
      <AdminHeader>
        <TabsList variant="line" className="h-auto gap-1 rounded-none p-0">
          <TabsTrigger value="rooms" className={bandTab}>
            Areas
          </TabsTrigger>
          <TabsTrigger value="camera-units" className={bandTab}>
            Camera units
          </TabsTrigger>
        </TabsList>
      </AdminHeader>
      <main className="mx-auto w-full max-w-[1120px] px-4 pt-6 pb-12">
        <TabsContent value="rooms">{rooms}</TabsContent>
        <TabsContent value="camera-units">{units}</TabsContent>
      </main>
    </Tabs>
  );
}
