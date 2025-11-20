import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Calendar, LayoutDashboard } from "lucide-react";
import EmployeeManagement from "@/components/EmployeeManagement";
import DailyPlanning from "@/components/DailyPlanning";
import Dashboard from "@/components/Dashboard";

import Navbar from "@/components/Navbar";

const Index = () => {
  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gradient-to-br from-background via-white to-background pt-24">
        <div className="container mx-auto px-4 py-8">

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3 bg-card shadow-sm">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="employees" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Medarbetare
            </TabsTrigger>
            <TabsTrigger value="planning" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Dagsplanering
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <Dashboard />
          </TabsContent>

          <TabsContent value="employees" className="space-y-6">
            <EmployeeManagement />
          </TabsContent>

          <TabsContent value="planning" className="space-y-6">
            <DailyPlanning />
          </TabsContent>
        </Tabs>
      </div>
    </div></>
  );
};

export default Index;
