import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Calendar, LayoutDashboard } from "lucide-react";
import EmployeeManagement from "@/components/EmployeeManagement";
import DailyPlanning from "@/components/DailyPlanning";
import Dashboard from "@/components/Dashboard";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Arbetsplatsplanering
          </h1>
          <p className="text-muted-foreground mt-2">
            Hantera medarbetare och planera arbetsstationer effektivt
          </p>
        </header>

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
    </div>
  );
};

export default Index;
