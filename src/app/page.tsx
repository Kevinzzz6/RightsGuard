"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { DashboardPage } from "@/components/pages/dashboard";
import { ProfilePage } from "@/components/pages/profile";
import { IpAssetsPage } from "@/components/pages/ip-assets";
import { SettingsPage } from "@/components/pages/settings";

export default function Home() {
  const [activePage, setActivePage] = useState("dashboard");

  const renderPage = () => {
    switch (activePage) {
      case "dashboard":
        return <DashboardPage />;
      case "profile":
        return <ProfilePage />;
      case "ip-assets":
        return <IpAssetsPage />;
      case "settings":
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      
      {/* Main content area */}
      <main className="flex-1 md:ml-64 overflow-auto">
        {renderPage()}
      </main>
    </div>
  );
}