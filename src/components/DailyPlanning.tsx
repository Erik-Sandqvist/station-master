import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

const DailyPlanning = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [stationNeeds, setStationNeeds] = useState<Record<string, number>>({});
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [flManual, setFlManual] = useState("");
  const [loading, setLoading] = useState(false);
  const [draggedEmployee, setDraggedEmployee] = useState<{ id: string; fromStation: string } | null>(null);
  const [draggedFrom, setDraggedFrom] = useState<string | null>(null);
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
      .select("employee_id, station, employees(name)")
      .eq("assigned_date", today);

    if (data) {
      const assignmentsMap: Record<string, string[]> = {};
      data.forEach((item: any) => {
        if (!assignmentsMap[item.station]) {
          assignmentsMap[item.station] = [];
        }
        assignmentsMap[item.station].push(item.employees.name);
      });
      setAssignments(assignmentsMap);
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

    const newAssignments: Record<string, string[]> = {};
    const assignedEmployees = new Set<string>();
    const stationsToFill = STATIONS.filter((s) => s !== "FL");

    // Sort stations by need (highest first)
    const sortedStations = stationsToFill
      .filter((station) => (stationNeeds[station] || 0) > 0)
      .sort((a, b) => (stationNeeds[b] || 0) - (stationNeeds[a] || 0));

    for (const station of sortedStations) {
      const needed = stationNeeds[station] || 0;
      newAssignments[station] = [];

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
        newAssignments[station].push(employee.id);
        assignedEmployees.add(employee.id);

        // Save to database
        await supabase.from("daily_assignments").insert({
          employee_id: employee.id,
          station,
          assigned_date: today,
        });

        // Save to history
        await supabase.from("work_history").insert({
          employee_id: employee.id,
          station,
          work_date: today,
        });
      }
    }

    // Handle FL manual assignment
    if (flManual.trim()) {
      newAssignments["FL"] = [flManual];
    }

    setAssignments(newAssignments);
    setLoading(false);

    toast({
      title: "Fördelning klar!",
      description: `${assignedEmployees.size} medarbetare har tilldelats stationer`,
    });
  };

  const getEmployeeName = (id: string) => {
    return employees.find((e) => e.id === id)?.name || id;
  };

  const handleDragStart = (employeeId: string, fromStation: string) => {
    setDraggedEmployee({ id: employeeId, fromStation });
    setDraggedFrom(fromStation);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (toStation: string) => {
    if (!draggedEmployee || draggedEmployee.fromStation === toStation) {
      setDraggedEmployee(null);
      return;
    }

    // Check if employee has been at this station too often
    const history = await getEmployeeHistory(draggedEmployee.id);
    const stationCount = history[toStation] || 0;
    const avgCount = Object.values(history).reduce((a, b) => a + b, 0) / Object.keys(history).length || 0;
    
    if (stationCount > avgCount * 1.5 && stationCount > 5) {
      // Show warning dialog
      setWarningDialog({
        show: true,
        employeeName: getEmployeeName(draggedEmployee.id),
        toStation,
        count: stationCount,
        onConfirm: () => performMove(toStation),
      });
      return;
    }

    await performMove(toStation);
  };

  const performMove = async (toStation: string) => {
    if (!draggedEmployee) return;

    const today = new Date().toISOString().split("T")[0];
    setLoading(true);

    // Remove from old station
    const updatedAssignments = { ...assignments };
    updatedAssignments[draggedEmployee.fromStation] = updatedAssignments[draggedEmployee.fromStation].filter(
      (id) => id !== draggedEmployee.id
    );

    // Add to new station
    if (!updatedAssignments[toStation]) {
      updatedAssignments[toStation] = [];
    }
    updatedAssignments[toStation].push(draggedEmployee.id);

    // Update database - delete old assignment
    await supabase
      .from("daily_assignments")
      .delete()
      .eq("employee_id", draggedEmployee.id)
      .eq("assigned_date", today)
      .eq("station", draggedEmployee.fromStation);

    // Insert new assignment
    await supabase.from("daily_assignments").insert({
      employee_id: draggedEmployee.id,
      station: toStation,
      assigned_date: today,
    });

    // Update work history
    await supabase
      .from("work_history")
      .delete()
      .eq("employee_id", draggedEmployee.id)
      .eq("work_date", today)
      .eq("station", draggedEmployee.fromStation);

    await supabase.from("work_history").insert({
      employee_id: draggedEmployee.id,
      station: toStation,
      work_date: today,
    });

    setAssignments(updatedAssignments);
    setDraggedEmployee(null);
    setWarningDialog(null);
    setLoading(false);

    toast({
      title: "Flyttad!",
      description: `${getEmployeeName(draggedEmployee.id)} har flyttats till ${toStation}`,
    });
  };

  const handleDropOnPackPosition = (station: string, targetIdx: number) => {
    if (!draggedEmployee || !draggedFrom) return;

    setAssignments((prev) => {
      const updated = { ...prev };
      
      // Ta bort från ursprunglig plats
      if (draggedFrom === station) {
        // Flyttar inom samma station
        const sourceIdx = updated[draggedFrom].indexOf(draggedEmployee.id);
        if (sourceIdx !== -1) {
          updated[draggedFrom] = [...updated[draggedFrom]];
          updated[draggedFrom][sourceIdx] = "";
        }
      } else {
        // Flyttar från annan station
        updated[draggedFrom] = updated[draggedFrom].filter((id) => id !== draggedEmployee.id);
      }

      // Lägg till på ny plats
      const maxPositions = station === "Pack" ? 12 : 6;
      if (!updated[station]) {
        updated[station] = Array(maxPositions).fill("");
      }
      updated[station] = [...updated[station]];
      updated[station][targetIdx] = draggedEmployee.id;

      return updated;
    });

    setDraggedEmployee(null);
    setDraggedFrom(null);
  };

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesShift = shiftFilter === "Alla" || emp.shift === shiftFilter;
    return matchesSearch && matchesShift;
  });

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
                  className="text-center font-semibold bg-sidebar-input"
                  disabled={station === "FL"}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-center">
          <Button
          onClick={saveStationNeeds}
          disabled={loading}
          className="w-3/5 h-12 bg-gradient-to-r from-primary to-white backdrop-blur-lg border
            shadow-2xl hover:from-primary/70 hover:to-secondary/70 hover:shadow-3xl
            transition-all duration-300 hover:scale-[1.02] text-xl z-0"
            >
         Spara behov
        </Button>
        </div>
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
        className="pl-9 bg-sidebar-input"
      />
    </div>
    <Select value={shiftFilter} onValueChange={setShiftFilter}>
      <SelectTrigger className="w-40 bg-sidebar-input">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="Alla">Alla skift</SelectItem>
        <SelectItem value="Skift 1">Skift 1</SelectItem>
        <SelectItem value="Skift 2">Skift 2</SelectItem>
        <SelectItem value="Natt">Natt</SelectItem>
        <SelectItem value="Bemanningsföretag">Bemaningsföretag</SelectItem>
      </SelectContent>
    </Select>
    <Button
      variant="outline"
      onClick={() => {
        if (selectedEmployees.length === filteredEmployees.length) {
          // Avmarkera alla
          setSelectedEmployees([]);
        } else {
          // Välj alla filtrerade medarbetare
          setSelectedEmployees(filteredEmployees.map(e => e.id));
        }
      }}
      className="whitespace-nowrap"
    >
      {selectedEmployees.length === filteredEmployees.length ? 'Avmarkera alla' : 'Välj alla'}
    </Button>
  </div>

  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
    {filteredEmployees.map((employee) => (
      <div
        key={employee.id}
        className="flex items-center space-x-2 p-3 rounded-lg bg-secondary/50 hover:bg-backdrop-blur-lg"
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
              className="bg-sidebar-input"
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


      {/* Tilldelnings kortet */}
      {Object.keys(assignments).length > 0 && (
        <Card className="shadow-lg border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Dagens tilldelningar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {STATIONS.map((station) => {
                const assigned = assignments[station] || [];
                const needed = stationNeeds[station] || 0;
                const filledCount = station === "Pack" || station === "Auto Pack" || station === "Auto Plock" 
                  ? assigned.filter(a => a).length 
                  : assigned.length;
                if (assigned.length === 0 && station !== "FL") return null;

                return (
                  <Card
  key={station}
  className="p-4 bg-white/40 backdrop-blur-md border border-white/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-15"
  onDragOver={handleDragOver}
  onDrop={() => handleDrop(station)}
>
  <div className="flex items-center justify-between mb-3">
    <h3 className="font-semibold text-base text-primary">
      {station}
    </h3>
    {station !== "FL" && (
      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
        filledCount >= needed 
          ? 'bg-primary/20 text-primary' 
          : 'bg-accent/20 text-accent'
      }`}>
        {filledCount}/{needed}
      </span>
    )}
  </div>
  {station === "FL" ? (
    <p className="text-sm text-muted-foreground">{flManual || "Ingen tilldelad"}</p>
  ) : station === "Pack" ? (
    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
      {Array.from({ length: 12 }, (_, idx) => (
        <div
          key={idx}
          draggable={!!assigned[idx]}
          onDragStart={() => assigned[idx] && handleDragStart(assigned[idx], station)}
          onDragOver={handleDragOver}
          onDrop={(e) => {
            e.stopPropagation();
            handleDropOnPackPosition(station, idx);
          }}
          className={`text-sm p-2 rounded-lg ${
            assigned[idx] 
              ? 'bg-primary/15 cursor-move hover:bg-primary/25 backdrop-blur-sm' 
              : 'bg-muted/40 text-muted-foreground backdrop-blur-sm'
          } transition-all duration-200`}
        >
          {idx + 1}. {assigned[idx] ? getEmployeeName(assigned[idx]).split(' ')[0] : '–'}
        </div>
      ))}
    </div>
  ) : station === "Auto Pack" || station === "Auto Plock" ? (
    <div className="space-y-2 max-h-40 overflow-y-auto">
      {Array.from({ length: 6 }, (_, idx) => (
        <div
          key={idx}
          draggable={!!assigned[idx]}
          onDragStart={() => assigned[idx] && handleDragStart(assigned[idx], station)}
          onDragOver={handleDragOver}
          onDrop={(e) => {
            e.stopPropagation();
            handleDropOnPackPosition(station, idx);
          }}
          className={`text-sm p-2 rounded-lg ${
            assigned[idx] 
              ? 'bg-primary/15 cursor-move hover:bg-primary/25 backdrop-blur-sm' 
              : 'bg-muted/40 text-muted-foreground backdrop-blur-sm'
          } transition-all duration-200`}
        >
          {idx + 1}. {assigned[idx] ? getEmployeeName(assigned[idx]).split(' ')[0] : '–'}
        </div>
      ))}
    </div>
  ) : (
    <div className="space-y-2 max-h-40 overflow-y-auto">
      {assigned.map((empId, idx) => (
        <div
          key={idx}
          draggable
          onDragStart={() => handleDragStart(empId, station)}
          className="text-sm cursor-move p-2 rounded-lg bg-primary/15 hover:bg-primary/25 backdrop-blur-sm transition-all duration-200"
        >
          • {getEmployeeName(empId)}
        </div>
      ))}
    </div>
  )}
</Card>
                );
              })}
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
