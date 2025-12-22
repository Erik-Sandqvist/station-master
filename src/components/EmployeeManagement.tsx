import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmployeeDetailsDialog } from "@/components/EmployeeDetailsDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, UserCheck, UserX, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const STATIONS = [
  "Plock",
  "Auto Plock",
  "Pack",
  "Auto Pack",
  "KM",
  "Decating",
  "In/Ut",
  "Rep",
  "FL",
];

interface Employee {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  shift: string;
}

const EmployeeManagement = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [newEmployeeShift, setNewEmployeeShift] = useState("Skift 1");
  const [filterShift, setFilterShift] = useState("Alla");
  const [loading, setLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [recentWork, setRecentWork] = useState<{station: string, work_date: string}[]>([]);
  const [employeeStations, setEmployeeStations] = useState<string[]>([]);
  const [stationStats, setStationStats] = useState<Record<string, number>>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .order("name");

    if (error) {
      toast({
        title: "Fel",
        description: "Kunde inte hämta medarbetare",
        variant: "destructive",
      });
    } else {
      setEmployees(data || []);
    }
  };

  const addEmployee = async () => {
    if (!newEmployeeName.trim()) {
      toast({
        title: "Namn krävs",
        description: "Ange ett namn för medarbetaren",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from("employees")
      .insert([{ name: newEmployeeName.trim(), shift: newEmployeeShift }]);

    if (error) {
      toast({
        title: "Fel",
        description: "Kunde inte lägga till medarbetare",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Tillagd!",
        description: `${newEmployeeName} har lagts till`,
      });
      setNewEmployeeName("");
      setNewEmployeeShift("Skift 1");
      fetchEmployees();
    }
    setLoading(false);
  };

  const toggleEmployeeStatus = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("employees")
      .update({ is_active: !currentStatus })
      .eq("id", id);

    if (error) {
      toast({
        title: "Fel",
        description: "Kunde inte uppdatera status",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Uppdaterad!",
        description: "Status har ändrats",
      });
      fetchEmployees();
    }
  };

  const openEmployeeDetails = async (employee: Employee) => {
    setSelectedEmployee(employee);
    
    try {
      // Hämta medarbetarens stationer
      const { data: stationsData } = await supabase
        .from("employee_stations")
        .select("station")
        .eq("employee_id", employee.id);
      
      setEmployeeStations(stationsData?.map(d => d.station) || []);
  
      // Hämta statistik för senaste 6 månaderna
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const { data: historyData } = await supabase
        .from("work_history")
        .select("station, work_date")
        .eq("employee_id", employee.id)
        .gte("work_date", sixMonthsAgo.toISOString().split('T')[0])
        .order('work_date', { ascending: false });
      
      // Räkna antal gånger per station
      const stats: Record<string, number> = {};
      historyData?.forEach(record => {
        stats[record.station] = (stats[record.station] || 0) + 1;
      });
      setStationStats(stats);
  
      // Senaste 5 stationerna
      setRecentWork(historyData?.slice(0, 5) || []);
      
    } catch (error) {
      toast({
        title: "Fel",
        description: "Kunde inte hämta medarbetardata",
        variant: "destructive",
      });
    }
  };

  const toggleStation = async (station: string) => {
    if (!selectedEmployee) return;

    const hasStation = employeeStations.includes(station);
    
    if (hasStation) {
      // Ta bort station
      const { error } = await supabase
        .from("employee_stations")
        .delete()
        .eq("employee_id", selectedEmployee.id)
        .eq("station", station);

      if (error) {
        toast({
          title: "Fel",
          description: "Kunde inte ta bort station",
          variant: "destructive",
        });
      } else {
        setEmployeeStations(prev => prev.filter(s => s !== station));
      }
    } else {
      // Lägg till station
      const { error } = await supabase
        .from("employee_stations")
        .insert([{ employee_id: selectedEmployee.id, station }]);

      if (error) {
        toast({
          title: "Fel",
          description: "Kunde inte lägga till station",
          variant: "destructive",
        });
      } else {
        setEmployeeStations(prev => [...prev, station]);
      }
    }
  };

  const deleteEmployee = async (id: string, name: string) => {
    if (!confirm(`Är du säker på att du vill ta bort ${name}?`)) return;

    const { error } = await supabase.from("employees").delete().eq("id", id);

    if (error) {
      toast({
        title: "Fel",
        description: "Kunde inte ta bort medarbetare",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Borttagen!",
        description: `${name} har tagits bort`,
      });
      fetchEmployees();
    }
  };

  return (
    <Card className="shadow-lg border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="h-6 w-6" />
          Medarbetarhantering
        </CardTitle>
        <CardDescription>
          Lägg till och hantera medarbetare som kan tilldelas arbetsstationer
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-4">
          <div className="flex-1 space-y-2">
            <Label htmlFor="employee-name">Namn på medarbetare</Label>
            <Input
              className="bg-sidebar-input"
              id="employee-name"
              placeholder="Ange namn..."
              value={newEmployeeName}
              onChange={(e) => setNewEmployeeName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addEmployee()}
            />
          </div>
          <div className="w-40 space-y-2">
            <Label htmlFor="employee-shift" bg-sidebar-input>Skift</Label>
            <Select value={newEmployeeShift} onValueChange={setNewEmployeeShift}>
              <SelectTrigger id="employee-shift" className="bg-sidebar-input"> 
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="">
                <SelectItem value="Skift 1">Skift 1</SelectItem>
                <SelectItem value="Skift 2">Skift 2</SelectItem>
                <SelectItem value="Natt">Natt</SelectItem>
                <SelectItem value="Bemanningsföretag">Bemanningsföretag</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              onClick={addEmployee}
              disabled={loading}
              className="gap-2 bg-gradient-to-r from-primary to-secondary hover:opacity-80 transition-opacity"
            >
              <Plus className="h-4 w-4" />
              Lägg till
            </Button>
          </div>
        </div>
        <div className="border flex-col"><p>Här kan man kanske ha möjliget att kolla på de olika grupperna (Förslag)</p>
        <div className="border h-8 flex items-center pl-8">GruppNamn1 v</div>
        <div className="border h-8 flex items-center pl-8">Ängland v</div>
        <div className="border h-8 flex items-center pl-8">Solvinden v</div>
        <div className="border h-8 flex items-center pl-8">GruppNamn4 v</div>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">
              Medarbetare ({filterShift === "Alla" ? employees.length : employees.filter(e => e.shift === filterShift).length})
            </h3>
            <div className="w-48">
              <Select value={filterShift} onValueChange={setFilterShift}>
                <SelectTrigger className="bg-sidebar-input">
                  <SelectValue placeholder="Välj skift" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Alla">Alla skift</SelectItem>
                  <SelectItem value="Skift 1">Skift 1</SelectItem>
                  <SelectItem value="Skift 2">Skift 2</SelectItem>
                  <SelectItem value="Natt">Natt</SelectItem>
                  <SelectItem value="Bemanningsföretag">Bemanningsföretag</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            {(filterShift === "Alla" ? employees : employees.filter(e => e.shift === filterShift)).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {filterShift === "Alla" 
                  ? "Inga medarbetare än. Lägg till din första medarbetare ovan."
                  : `Inga medarbetare i ${filterShift}.`}
              </p>
            ) : (
              (filterShift === "Alla" ? employees : employees.filter(e => e.shift === filterShift)).map((employee) => (
                <Card
                  key={employee.id}
                  className="p-4 flex items-center justify-between hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => openEmployeeDetails(employee)}
                      className="font-medium hover:text-primary transition-colors cursor-pointer text-left"
                    >
                      {employee.name}
                    </button>
                    <Badge
                      variant={employee.is_active ? "default" : "secondary"}
                      className={
                        employee.is_active
                          ? "bg-success text-success-foreground"
                          : ""
                      }
                    >
                      {employee.is_active ? "Aktiv" : "Inaktiv"}
                    </Badge>
                    <Badge variant="outline">{employee.shift}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        toggleEmployeeStatus(employee.id, employee.is_active)
                      }
                      className="gap-2"
                    >
                      {employee.is_active ? (
                        <>
                          <UserX className="h-4 w-4" />
                          Inaktivera
                        </>
                      ) : (
                        <>
                          <UserCheck className="h-4 w-4" />
                          Aktivera
                        </>
                      )}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteEmployee(employee.id, employee.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </CardContent>

      <EmployeeDetailsDialog
  employee={selectedEmployee}
  onOpenChange={(open) => !open && setSelectedEmployee(null)}
  employeeStations={employeeStations}
  stationStats={stationStats}
  recentWork={recentWork}
  stations={STATIONS}
  onToggleStation={toggleStation}
/>
    </Card>
  );
};

export default EmployeeManagement;
