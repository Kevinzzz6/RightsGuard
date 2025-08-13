"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { 
  LayoutDashboard, 
  User, 
  Library, 
  Settings,
  Shield,
  Menu
} from "lucide-react";

interface SidebarProps {
  activePage: string;
  setActivePage: (page: string) => void;
}

const sidebarNavItems = [
  {
    title: "主界面",
    href: "dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "个人档案",
    href: "profile",
    icon: User,
  },
  {
    title: "IP资产库",
    href: "ip-assets",
    icon: Library,
  },
  {
    title: "设置",
    href: "settings",
    icon: Settings,
  },
];

export function Sidebar({ activePage, setActivePage }: SidebarProps) {
  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:bg-card md:border-r">
        <div className="flex flex-col flex-grow pt-6 pb-4 overflow-y-auto bg-card">
          <div className="flex items-center flex-shrink-0 px-4">
            <Shield className="h-8 w-8 text-primary mr-2" />
            <div>
              <h2 className="font-bold text-lg">RightsGuard</h2>
              <p className="text-xs text-muted-foreground">版权申诉工具</p>
            </div>
          </div>
          <nav className="mt-8 flex-1 px-3 space-y-1">
            {sidebarNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.href}
                  variant={activePage === item.href ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setActivePage(item.href)}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {item.title}
                </Button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Mobile Sidebar */}
      <div className="md:hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center">
            <Shield className="h-6 w-6 text-primary mr-2" />
            <div>
              <h2 className="font-bold text-base">RightsGuard</h2>
              <p className="text-xs text-muted-foreground">版权申诉工具</p>
            </div>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex flex-col h-full">
                <div className="flex items-center p-6 border-b">
                  <Shield className="h-8 w-8 text-primary mr-2" />
                  <div>
                    <h2 className="font-bold text-lg">RightsGuard</h2>
                    <p className="text-xs text-muted-foreground">版权申诉工具</p>
                  </div>
                </div>
                <nav className="flex-1 px-3 py-4 space-y-1">
                  {sidebarNavItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Button
                        key={item.href}
                        variant={activePage === item.href ? "secondary" : "ghost"}
                        className="w-full justify-start"
                        onClick={() => {
                          setActivePage(item.href);
                          // Close sheet after selection (client-side only)
                          if (typeof document !== 'undefined') {
                            document.querySelector('[data-state="open"]')?.setAttribute('data-state', 'closed');
                          }
                        }}
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        {item.title}
                      </Button>
                    );
                  })}
                </nav>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </>
  );
}