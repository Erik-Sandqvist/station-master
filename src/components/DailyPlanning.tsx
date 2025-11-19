import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Calendar, Users, Shuffle, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Employee {
  id: string;
  name: string;
  shift: string;
}

interface StationNeed {
  station: string;
  count: number;
}

interface Assignment {
  employeeId: string;
  employeeName: string;
  station: string;
  lane: number | null;
}

const STATIONS = [
  "Plock",
  "Autoplock",
  "Pack",
  "Auto pack",
  "KM",
  "Decating",
  "In/Ut",
  "Rep",
  "FL",
];

// Define which stations have lanes
const STATION_LANES: Record<string, number> = {
  "Pack": 11,
  "Auto pack": 6,
  "Autoplock": 6,
};

const DailyPlanning = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [stationNeeds, setStationNeeds] = useState<Record<string, number>>({});
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [flManual, setFlManual] = useState("");
  const [loading, setLoading] = useState(false);
  const [draggedEmployee, setDraggedEmployee] = useState<Assignment | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [shiftFilter, setShiftFilter] = useState<string>("Alla");
  const [warningDialog, setWarningDialog] = useState<{
    show: boolean;
    employeeName: string;
    toStation: string;
    count: number;
    onConfirm: () => void;
  } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchEmployees();
    loadTodayNeeds();
    loadTodayAssignments();
  }, []);

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from("employees")
      .select("id, name, shift")
      .eq("is_active", true)
      .order("name");

    setEmployees(data || []);
  };

  const loadTodayNeeds = async () => {
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("station_needs")
      .select("station, needed_count")
      .eq("need_date", today);

    if (data) {
      const needsMap: Record<string, number> = {};
      data.forEach((item) => {
        needsMap[item.station] = item.needed_count;
      });
      setStationNeeds(needsMap);
    }
  };

  const loadTodayAssignments = async () => {
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("daily_assignments")
      .select("employee_id, station, lane, employees(name)")
      .eq("assigned_date", today);

    if (data) {
      const assignmentsList: Assignment[] = data.map((item: any) => ({
        employeeId: item.employee_id,
        employeeName: item.employees.name,
        station: item.station,
        lane: item.lane,
      }));
      setAssignments(assignmentsList);
    }
  };

  const saveStationNeeds = async () => {
    const today = new Date().toISOString().split("T")[0];
    setLoading(true);

    for (const station of STATIONS) {
      const count = stationNeeds[station] || 0;
      await supabase.from("station_needs").upsert(
        {
          station,
          needed_count: count,
          need_date: today,
        },
        { onConflict: "station,need_date" }
      );
    }

    setLoading(false);
    toast({
      title: "Sparat!",
      description: "Personalbehovet har sparats",
    });
  };

  const getEmployeeHistory = async (employeeId: string) => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data } = await supabase
      .from("work_history")
      .select("station")
      .eq("employee_id", employeeId)
      .gte("work_date", sixMonthsAgo.toISOString().split("T")[0]);

    const stationCount: Record<string, number> = {};
    data?.forEach((item) => {
      stationCount[item.station] = (stationCount[item.station] || 0) + 1;
    });

    return stationCount;
  };

  const distributeEmployees = async () => {
    if (selectedEmployees.length === 0) {
      toast({
        title: "Ingen vald",
        description: "Välj minst en medarbetare",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const today = new Date().toISOString().split("T")[0];

    // Clear existing assignments
    await supabase.from("daily_assignments").delete().eq("assigned_date", today);

    // Get history for all selected employees
    const employeeHistories = await Promise.all(
      selectedEmployees.map(async (empId) => ({
        id: empId,
        history: await getEmployeeHistory(empId),
      }))
    );

    const newAssignments: Assignment[] = [];
    const assignedEmployees = new Set<string>();
    const stationsToFill = STATIONS.filter((s) => s !== "FL");

    // Sort stations by need (highest first)
    const sortedStations = stationsToFill
      .filter((station) => (stationNeeds[station] || 0) > 0)
      .sort((a, b) => (stationNeeds[b] || 0) - (stationNeeds[a] || 0));

    for (const station of sortedStations) {
      const needed = stationNeeds[station] || 0;

      // Sort employees by least time at this station
      const available = employeeHistories
        .filter((emp) => !assignedEmployees.has(emp.id))
        .sort((a, b) => {
          const aCount = a.history[station] || 0;
          const bCount = b.history[station] || 0;
          return aCount - bCount;
        });

      for (let i = 0; i < needed && i < available.length; i++) {
        const employee = available[i];
        const empName = employees.find((e) => e.id === employee.id)?.name || "";
        
        newAssignments.push({
          employeeId: employee.id,
          employeeName: empName,
          station,
          lane: null,
        });
        assignedEmployees.add(employee.id);

        // Save to database
        await supabase.from("daily_assignments").insert({
          employee_id: employee.id,
          station,
          assigned_date: today,
          lane: null,
        });

        // Save to history
        await supabase.from("work_history").insert({
          employee_id: employee.id,
          station,
          work_date: today,
          lane: null,
        });
      }
    }

    // Handle FL manual assignment
    if (flManual.trim()) {
      newAssignments.push({
        employeeId: "manual",
        employeeName: flManual,
        station: "FL",
        lane: null,
      });
    }

    setAssignments(newAssignments);
    setLoading(false);

    toast({
      title: "Fördelning klar!",
      description: `${assignedEmployees.size} medarbetare har tilldelats stationer`,
    });
  };

  const handleDragStart = (assignment: Assignment) => {
    setDraggedEmployee(assignment);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (toStation: string, toLane: number | null = null) => {
    if (!draggedEmployee || (draggedEmployee.station === toStation && draggedEmployee.lane === toLane)) {
      setDraggedEmployee(null);
      return;
    }

    // Check if employee has been at this station too often
    const history = await getEmployeeHistory(draggedEmployee.employeeId);
    const stationCount = history[toStation] || 0;
    const avgCount = Object.values(history).reduce((a, b) => a + b, 0) / Object.keys(history).length || 0;
    
    if (stationCount > avgCount * 1.5 && stationCount > 5) {
      // Show warning dialog
      setWarningDialog({
        show: true,
        employeeName: draggedEmployee.employeeName,
        toStation,
        count: stationCount,
        onConfirm: () => performMove(toStation, toLane),
      });
      return;
    }

    await performMove(toStation, toLane);
  };

  const performMove = async (toStation: string, toLane: number | null = null) => {
    if (!draggedEmployee) return;

    const today = new Date().toISOString().split("T")[0];
    setLoading(true);

    // Remove from assignments array
    const updatedAssignments = assignments.filter(
      (a) => !(a.employeeId === draggedEmployee.employeeId && a.station === draggedEmployee.station && a.lane === draggedEmployee.lane)
    );

    // Add to new location
    updatedAssignments.push({
      ...draggedEmployee,
      station: toStation,
      lane: toLane,
    });

    // Update database - delete old assignment
    await supabase
      .from("daily_assignments")
      .delete()
      .eq("employee_id", draggedEmployee.employeeId)
      .eq("assigned_date", today)
      .eq("station", draggedEmployee.station);

    // Insert new assignment
    await supabase.from("daily_assignments").insert({
      employee_id: draggedEmployee.employeeId,
      station: toStation,
      assigned_date: today,
      lane: toLane,
    });

    // Update work history
    await supabase
      .from("work_history")
      .delete()
      .eq("employee_id", draggedEmployee.employeeId)
      .eq("work_date", today)
      .eq("station", draggedEmployee.station);

    await supabase.from("work_history").insert({
      employee_id: draggedEmployee.employeeId,
      station: toStation,
      work_date: today,
      lane: toLane,
    });

    setAssignments(updatedAssignments);
    setDraggedEmployee(null);
    setWarningDialog(null);
    setLoading(false);

    toast({
      title: "Flyttad!",
      description: `${draggedEmployee.employeeName} har flyttats till ${toStation}${toLane ? ` Bana ${toLane}` : ""}`,
    });
  };

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesShift = shiftFilter === "Alla" || emp.shift === shiftFilter;
    return matchesSearch && matchesShift;
  });

  const getAssignmentsByStation = (station: string) => {
    return assignments.filter((a) => a.station === station);
  };

  const getAssignmentsByStationAndLane = (station: string, lane: number | null) => {
    return assignments.filter((a) => a.station === station && a.lane === lane);
  };

  const renderStationCard = (station: string) => {
    const stationAssignments = getAssignmentsByStation(station);
    if (stationAssignments.length === 0 && station !== "FL") return null;

    const hasLanes = STATION_LANES[station];

    if (station === "FL") {
      return (
        <Card key={station} className="p-4 bg-card shadow-card hover:shadow-hover transition-all">
          <h3 className="font-semibold text-lg mb-2 text-primary">{station}</h3>
          <p className="text-sm text-muted-foreground">{flManual || "Ingen tilldelad"}</p>
        </Card>
      );
    }

    if (hasLanes) {
      return (
        <Card key={station} className="p-4 bg-card shadow-card hover:shadow-hover transition-all">
          <h3 className="font-semibold text-lg mb-3 text-primary">{station}</h3>
          <div className="space-y-3">
            {Array.from({ length: hasLanes }, (_, i) => i + 1).map((lane) => {
              const laneAssignments = getAssignmentsByStationAndLane(station, lane);
              return (
                <div
                  key={lane}
                  className="p-3 rounded-md bg-muted/50 border-2 border-dashed border-border hover:border-primary/50 transition-colors"
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(station, lane)}
                >
                  <p className="text-xs font-medium text-muted-foreground mb-2">Bana {lane}</p>
                  <div className="flex flex-wrap gap-2">
                    {laneAssignments.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Dra hit medarbetare</p>
                    ) : (
                      laneAssignments.map((assignment, idx) => (
                        <Badge
                          key={`${assignment.employeeId}-${assignment.lane}-${idx}`}
                          variant="default"
                          className="cursor-move bg-primary hover:bg-primary/90"
                          draggable
                          onDragStart={() => handleDragStart(assignment)}
                        >
                          {assignment.employeeName}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      );
    }

    // Station without lanes
    return (
      <Card
        key={station}
        className="p-4 bg-card shadow-card hover:shadow-hover transition-all"
        onDragOver={handleDragOver}
        onDrop={() => handleDrop(station, null)}
      >
        <h3 className="font-semibold text-lg mb-3 text-primary">{station}</h3>
        <div className="flex flex-wrap gap-2">
          {stationAssignments.map((assignment, idx) => (
            <Badge
              key={`${assignment.employeeId}-${idx}`}
              variant="default"
              className="cursor-move bg-primary hover:bg-primary/90"
              draggable
              onDragStart={() => handleDragStart(assignment)}
            >
              {assignment.employeeName}
            </Badge>
          ))}
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            Personalbehovsplanering
          </CardTitle>
          <CardDescription>
            Ange hur många personer som behövs på varje station idag
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            {STATIONS.map((station) => (
              <div key={station} className="space-y-2">
                <Label htmlFor={`station-${station}`} className="text-sm font-medium">
                  {station}
                </Label>
                <Input
                  id={`station-${station}`}
                  type="number"
                  min="0"
                  value={stationNeeds[station] || 0}
                  onChange={(e) =>
                    setStationNeeds({
                      ...stationNeeds,
                      [station]: parseInt(e.target.value) || 0,
                    })
                  }
                  className="text-center font-semibold"
                  disabled={station === "FL"}
                />
              </div>
            ))}
          </div>
          <Button
            onClick={saveStationNeeds}
            disabled={loading}
            className="w-full bg-gradient-to-r from-primary to-accent"
          >
            Spara behov
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-lg border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Välj medarbetare för idag
          </CardTitle>
          <CardDescription>
            Välj vilka som arbetar idag innan du fördelar till stationer
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Sök medarbetare..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={shiftFilter} onValueChange={setShiftFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Alla">Alla skift</SelectItem>
                <SelectItem value="Skift 1">Skift 1</SelectItem>
                <SelectItem value="Skift 2">Skift 2</SelectItem>
                <SelectItem value="Natt">Natt</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {filteredEmployees.map((employee) => (
              <div
                key={employee.id}
                className="flex items-center space-x-2 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
              >
                <Checkbox
                  id={employee.id}
                  checked={selectedEmployees.includes(employee.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedEmployees([...selectedEmployees, employee.id]);
                    } else {
                      setSelectedEmployees(
                        selectedEmployees.filter((id) => id !== employee.id)
                      );
                    }
                  }}
                />
                <label
                  htmlFor={employee.id}
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  {employee.name}
                </label>
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-4 border-t">
            <Label htmlFor="fl-manual">FL Station (Manuell tilldelning)</Label>
            <Input
              id="fl-manual"
              placeholder="Skriv namn för FL station..."
              value={flManual}
              onChange={(e) => setFlManual(e.target.value)}
            />
          </div>

          <Button
            onClick={distributeEmployees}
            disabled={loading || selectedEmployees.length === 0}
            className="w-full gap-2 bg-gradient-to-r from-accent to-primary"
          >
            <Shuffle className="h-4 w-4" />
            Fördela medarbetare till stationer
          </Button>
        </CardContent>
      </Card>

      {assignments.length > 0 && (
        <Card className="shadow-lg border-border/50">
          <CardHeader>
            <CardTitle>Dagens tilldelningar</CardTitle>
            <CardDescription>
              Dra medarbetare mellan stationer och banor för att ändra tilldelning. Du kan ha flera personer per bana.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {STATIONS.map((station) => renderStationCard(station))}
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={warningDialog?.show} onOpenChange={(open) => !open && setWarningDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Varning: Ofta besökt station</AlertDialogTitle>
            <AlertDialogDescription>
              {warningDialog?.employeeName} har varit på {warningDialog?.toStation}{" "}
              {warningDialog?.count} gånger under de senaste 6 månaderna, vilket är mer än genomsnittet.
              Är du säker på att du vill flytta till denna station?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={() => warningDialog?.onConfirm()}>
              Bekräfta flytt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DailyPlanning;
