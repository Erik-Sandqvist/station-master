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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, Shuffle, Search, Info, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getEmployeesLastStations, canAssignToStation } from "@/utils/stationRotation";

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
  "Rework",
  "In/Ut",
  "Rep",
  "FL",
];

// Stationer som ska visas som del av en annan station
const SUB_STATIONS: Record<string, string> = {
  "Rework": "Decating", // Rework visas under Decanting
};

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
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employeeStations, setEmployeeStations] = useState<string[]>([]);
  const [stationStats, setStationStats] = useState<Record<string, number>>({});
  const [recentWork, setRecentWork] = useState<{station: string, work_date: string}[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
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

  // Get last assigned station for each employee
  const lastStationsMap = await getEmployeesLastStations(selectedEmployees);

  // Get history for all selected employees (for 6-month rotation logic)
  const employeeHistories = await Promise.all(
    selectedEmployees.map(async (empId) => ({
      id: empId,
      history: await getEmployeeHistory(empId),
      lastStation: lastStationsMap.get(empId) || null,
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

    // Filter out employees who were at this station last time
    // Then sort remaining by least time at this station
    const available = employeeHistories
      .filter((emp) => !assignedEmployees.has(emp.id))
      .filter((emp) => canAssignToStation(emp.id, station, lastStationsMap))
      .sort((a, b) => {
        const aCount = a.history[station] || 0;
        const bCount = b.history[station] || 0;
        return aCount - bCount;
      });

    for (let i = 0; i < needed && i < available.length; i++) {
      const employee = available[i];
      newAssignments[station].push(employee.id);
      assignedEmployees.add(employee.id);
    }
  }

  // If some employees couldn't be assigned due to last-station restriction,
  // try to assign them anyway (fallback)
  const unassignedDueToRestriction = employeeHistories
    .filter((emp) => !assignedEmployees.has(emp.id));
  
  if (unassignedDueToRestriction.length > 0) {
    // Try to fill remaining needs, ignoring the last-station rule
    for (const station of sortedStations) {
      const needed = stationNeeds[station] || 0;
      const currentCount = newAssignments[station]?.length || 0;
      
      if (currentCount < needed) {
        const stillAvailable = unassignedDueToRestriction
          .filter((emp) => !assignedEmployees.has(emp.id))
          .sort((a, b) => {
            const aCount = a.history[station] || 0;
            const bCount = b.history[station] || 0;
            return aCount - bCount;
          });
        
        for (let i = 0; i < (needed - currentCount) && i < stillAvailable.length; i++) {
          const employee = stillAvailable[i];
          if (!newAssignments[station]) newAssignments[station] = [];
          newAssignments[station].push(employee.id);
          assignedEmployees.add(employee.id);
        }
      }
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
      description: `${assignedEmployees.size} medarbetare har tilldelats stationer. Klicka på Spara för att spara till databasen.`,
    });
  };

  // const getEmployeeName = (id: string) => {
  //   return employees.find((e) => e.id === id)?.name || id;
  // };

  const getEmployeeShortName = (empId: string) => {
    const employee = employees.find(e => e.id === empId);
    if (!employee) return empId;
    
    const nameParts = employee.name.split(' ');
    if (nameParts.length === 1) return nameParts[0];
    
    const firstName = nameParts[0];
    const lastInitial = nameParts[nameParts.length - 1][0];
    return `${firstName} ${lastInitial}.`;
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

    // Check if employee has been at this station the most
    const history = await getEmployeeHistory(draggedEmployee.id);
    const stationCount = history[toStation] || 0;
    
    // Find the station with the highest count
    const maxStation = Object.entries(history).reduce((max, [station, count]) => 
      count > max.count ? { station, count } : max,
      { station: '', count: 0 }
    );
    
    // Show warning if moving to the station they've been to the most (and at least 3 times)
    if (maxStation.station === toStation && stationCount >= 3) {
      setWarningDialog({
        show: true,
        employeeName: getEmployeeShortName(draggedEmployee.id),
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

    setLoading(true);

    // Remove from old station
    const updatedAssignments = { ...assignments };
    
    // Only try to remove if not from unassigned list
    if (draggedEmployee.fromStation !== "unassigned" && updatedAssignments[draggedEmployee.fromStation]) {
      updatedAssignments[draggedEmployee.fromStation] = updatedAssignments[draggedEmployee.fromStation].filter(
        (id) => id !== draggedEmployee.id
      );
    }

    // Add to new station
    if (!updatedAssignments[toStation]) {
      updatedAssignments[toStation] = [];
    }
    updatedAssignments[toStation].push(draggedEmployee.id);

    setAssignments(updatedAssignments);
    setDraggedEmployee(null);
    setWarningDialog(null);
    setLoading(false);

    toast({
      title: "Flyttad!",
      description: `${getEmployeeShortName(draggedEmployee.id)} har flyttats till ${toStation}. Kom ihåg att spara!`,
    });
  };

  const handleDropOnPackPosition = (station: string, targetIdx: number) => {
    if (!draggedEmployee || !draggedFrom) return;
  
    setAssignments((prev) => {
      const updated = { ...prev };
      
      // Specialfall: Om draggedFrom är "unassigned", skapa det inte i updated
      if (draggedFrom !== "unassigned") {
        // Säkerställ att draggedFrom station existerar
        if (!updated[draggedFrom]) {
          console.warn(`Station ${draggedFrom} har inga tilldelningar`);
          return prev;
        }
        
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
          if (Array.isArray(updated[draggedFrom])) {
            updated[draggedFrom] = updated[draggedFrom].filter((id) => id !== draggedEmployee.id);
          }
        }
      }
  
      // Lägg till på ny plats
      const maxPositions = station === "Pack" ? 12 : 6;
      if (!updated[station]) {
        updated[station] = Array(maxPositions).fill("");
      }
      
      // Säkerställ att vi har en array med rätt storlek
      if (updated[station].length < maxPositions) {
        updated[station] = [...updated[station], ...Array(maxPositions - updated[station].length).fill("")];
      }
      
      updated[station] = [...updated[station]];
      updated[station][targetIdx] = draggedEmployee.id;
  
      return updated;
    });
  
    setDraggedEmployee(null);
    setDraggedFrom(null);
  };

  const handleSaveAssignments = async () => {
    const today = new Date().toISOString().split("T")[0];
  
    try {
      setIsSaving(true);
  
      const isUUID = (v: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

      // Bygg upp assignments med korrekt position_index
      const assignmentsToSave: any[] = [];
      const workHistoryToSave: any[] = [];

      // Filtrera bort FL station helt innan vi börjar
      const assignmentsWithoutFL = Object.entries(assignments).filter(([station]) => station !== "FL");

      assignmentsWithoutFL.forEach(([station, employeeIds]) => {
        if (!employeeIds || employeeIds.length === 0) return;

        employeeIds.forEach((empId, index) => {
          // Skippa tomma strängar eller null/undefined
          if (!empId || typeof empId !== 'string' || empId.trim() === '') return;

          const trimmedId = empId.trim();
          
          // Validera UUID
          if (!isUUID(trimmedId)) {
            console.warn(`Ogiltig employee_id: "${trimmedId}" på station ${station}`);
            return;
          }

          assignmentsToSave.push({
            employee_id: trimmedId,
            station,
            position_index: index,
            assigned_date: today,
          });

          workHistoryToSave.push({
            employee_id: trimmedId,
            station,
            work_date: today,
          });
        });
      });

      if (assignmentsToSave.length === 0) {
        toast({
          title: "Inget att spara",
          description: "Inga tilldelningar att spara",
          variant: "destructive",
        });
        return;
      }

      // Ta bort befintliga för idag
      const { error: deleteError } = await supabase
        .from("daily_assignments")
        .delete()
        .eq("assigned_date", today);

      if (deleteError) {
        console.error("Delete error:", deleteError);
        throw deleteError;
      }

      // Spara nya tilldelningar
      const { error: insertDailyError } = await supabase
        .from("daily_assignments")
        .insert(assignmentsToSave);

      if (insertDailyError) {
        console.error("daily_assignments insert error:", insertDailyError);
        throw insertDailyError;
      }

      // Spara work history
      const { error: insertHistoryError } = await supabase
        .from("work_history")
        .insert(workHistoryToSave);

      if (insertHistoryError) {
        console.error("work_history insert error:", insertHistoryError);
        throw insertHistoryError;
      }
  
      toast({
        title: "Sparat!",
        description: `${assignmentsToSave.length} tilldelningar sparade för idag (FL exkluderad)`,
      });
    } catch (err: any) {
      console.error("Save failed:", err);
    
      const message = err?.message || "Okänt fel vid sparning";
      const details = err?.details || "";
      const hint = err?.hint || "";
    
      toast({
        variant: "destructive",
        title: "Kunde inte spara",
        description: `${message}${details ? ` – ${details}` : ""}${hint ? ` (${hint})` : ""}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesShift = shiftFilter === "Alla" || emp.shift === shiftFilter;
    return matchesSearch && matchesShift;
  });

  const openEmployeeDetails = async (employee: Employee) => {
    setSelectedEmployee(employee);
    
    // Hämta medarbetarens stationer
    const { data } = await supabase
      .from("employee_stations")
      .select("station")
      .eq("employee_id", employee.id);
    
    setEmployeeStations(data?.map(d => d.station) || []);

    // Hämta statistik för senaste 6 månaderna
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 6);
    
    const { data: historyData } = await supabase
      .from("work_history")
      .select("station")
      .eq("employee_id", employee.id)
      .gte("work_date", threeMonthsAgo.toISOString().split('T')[0]);
    
    // Räkna antal gånger per station
    const stats: Record<string, number> = {};
    historyData?.forEach(record => {
      stats[record.station] = (stats[record.station] || 0) + 1;
    });
    setStationStats(stats);

    // Hämta de senaste 5 tilldelningarna från sparade fördelningar
    const { data: recentHistory } = await supabase
      .from("daily_assignments")
      .select("station, assigned_date")
      .eq("employee_id", employee.id)
      .order("assigned_date", { ascending: false })
      .limit(5);
    
    setRecentWork(recentHistory?.map(r => ({ station: r.station, work_date: r.assigned_date })) || []);
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

  const clearAllAssignments = () => {
    // Rensa assignments state (sparas inte till databasen förrän användaren klickar på Spara)
    setAssignments({});

    toast({
      title: "Rensat!",
      description: "Alla stationer har tömts på medarbetare. Klicka på Spara för att spara ändringarna.",
    });
  };

  const saveAllAssignments = async () => {
    const today = new Date().toISOString().split("T")[0];
    setLoading(true);

    try {
      // Ta bort alla befintliga tilldelningar för dagen
      await supabase.from("daily_assignments").delete().eq("assigned_date", today);
      await supabase.from("work_history").delete().eq("work_date", today);

      // Spara alla nya tilldelningar
      const assignmentsToSave: any[] = [];
      const historyToSave: any[] = [];

      Object.entries(assignments).forEach(([station, employeeIds]) => {
        employeeIds.forEach((empId) => {
          if (empId) { // Skippa tomma platser
            assignmentsToSave.push({
              employee_id: empId,
              station,
              assigned_date: today,
            });
            historyToSave.push({
              employee_id: empId,
              station,
              work_date: today,
            });
          }
        });
      });

      if (assignmentsToSave.length > 0) {
        await supabase.from("daily_assignments").insert(assignmentsToSave);
        await supabase.from("work_history").insert(historyToSave);
      }

      toast({
        title: "Sparat!",
        description: `${assignmentsToSave.length} tilldelningar har sparats till databasen`,
      });
    } catch (error) {
      toast({
        title: "Fel",
        description: "Kunde inte spara tilldelningarna",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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
              <div key={station} className="space-y-2 w-90%">
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
                  className="text-center font-semibold bg-sidebar-input large-spinner h-10"
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
          className="text-sm font-medium leading-none cursor-pointer flex-1"
        >
          {employee.name}
        </label>
        <button
          onClick={(e) => {
            e.preventDefault();
            openEmployeeDetails(employee);
          }}
          className="ml-auto p-1 rounded-full hover:bg-primary/20 transition-colors"
          title="Visa information"
        >
          <Info className="h-4 w-4 text-primary" />
        </button>
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
        {/* Unassigned employees list */}
        {(() => {
          const assignedEmployeeIds = new Set(
            Object.values(assignments).flat().filter(id => id)
          );
          const unassignedEmployees = selectedEmployees.filter(
            empId => !assignedEmployeeIds.has(empId)
          );

         
            return (
              <Card className="p-4 bg-gradient-to-br from-accent/20 to-primary/20 backdrop-blur-md border border-accent/50 shadow-xl col-span-full">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-foreground">
                    Ofördelade medarbetare
                  </h3>
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-accent/60 text-accent-foreground">
                    {unassignedEmployees.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {unassignedEmployees.map((empId) => (
                    <div
                      key={empId}
                      draggable
                      onDragStart={() => handleDragStart(empId, "unassigned")}
                      className="text-sm text-foreground cursor-move px-3 py-2 rounded-lg bg-background/80 hover:bg-primary/25 backdrop-blur-sm transition-all duration-200 border border-border/30"
                    >
                      {getEmployeeShortName(empId)}
                    </div>
                  ))}
                </div>
              </Card>
            );
        }
        )()}

{STATIONS.filter(station => !SUB_STATIONS[station]).map((station) => {
          const assigned = assignments[station] || [];
          const needed = stationNeeds[station] || 0;
          const filledCount = station === "Pack" || station === "Auto Pack" || station === "Auto Plock" 
            ? assigned.filter(a => a).length 
            : assigned.length;
          
          // Hitta understationer för denna station
          const subStations = Object.entries(SUB_STATIONS)
            .filter(([_, parent]) => parent === station)
            .map(([sub]) => sub);

          return (
            <Card
              key={station}
              className="p-4 bg-white backdrop-blur-md border border-white/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105"
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(station)}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-black">
                  {station}
                </h3>
                {station !== "FL" && (
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    filledCount >= needed 
                      ? 'bg-black/60 text-white' 
                      : 'bg-black/60 text-red-300'
                  }`}>
                    {filledCount}/{needed}
                  </span>
                )}
              </div>
              {station === "Pack" ? (
  <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
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
        className={`text-sm text-black p-2 rounded-lg ${
          assigned[idx] 
            ? 'bg-white cursor-move hover:bg-primary/25 backdrop-blur-sm' 
            : 'backdrop-blur-sm'
        } transition-all duration-200`}
      >
        {idx + 1}. {assigned[idx] ? getEmployeeShortName(assigned[idx]) : '–'}
      </div>
    ))}
  </div>
) : station === "Auto Pack" || station === "Auto Plock" ? (
  <div className="space-y-2 max-h-72 overflow-y-auto">
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
        className={`text-sm text-black p-2 rounded-lg ${
          assigned[idx] 
            ? 'bg-white cursor-move hover:bg-primary/25 backdrop-blur-sm' 
            : 'backdrop-blur-sm'
        } transition-all duration-200`}
      >
        {idx + 1}. {assigned[idx] ? getEmployeeShortName(assigned[idx]) : '–'}
      </div>
    ))}
  </div>
) : (
  <div className="space-y-2 max-h-72 overflow-y-auto">
    {assigned.map((empId, idx) => (
      <div
        key={idx}
        draggable
        onDragStart={() => handleDragStart(empId, station)}
        className="text-sm text-black cursor-move p-2 rounded-lg bg-white hover:bg-primary/25 backdrop-blur-sm transition-all duration-200"
      >
        • {getEmployeeShortName(empId)}
      </div>
    ))}
  </div>
)}

 {/* Rendera understationer */}
 {subStations.map((subStation) => {
                const subAssigned = assignments[subStation] || [];
                const subNeeded = stationNeeds[subStation] || 0;
                
                return (
                  <div
                    key={subStation}
                    className="mt-4 pt-3 border-t border-gray-200"
                    onDragOver={handleDragOver}
                    onDrop={(e) => {
                      e.stopPropagation();
                      handleDrop(subStation);
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm text-black/80">
                        {subStation}
                      </h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        subAssigned.length >= subNeeded 
                          ? 'bg-black/60 text-white' 
                          : 'bg-black/60 text-red-300'
                      }`}>
                        {subAssigned.length}/{subNeeded}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {subAssigned.length > 0 ? (
                        subAssigned.map((empId, idx) => (
                          <div
                            key={idx}
                            draggable
                            onDragStart={() => handleDragStart(empId, subStation)}
                            className="text-sm text-black cursor-move p-2 rounded-lg bg-gray-50 hover:bg-primary/25 backdrop-blur-sm transition-all duration-200"
                          >
                            • {getEmployeeShortName(empId)}
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-gray-400 p-2">
                          Dra hit för att tilldela
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </Card>
          );
        })}
      </div>
      {Object.keys(assignments).length > 0 && (
        <div className="flex justify-center gap-4 mt-4">
          <Button
            onClick={saveAllAssignments}
            disabled={loading}
            className="w-1/3 bg-gradient-to-r from-primary to-accent"
          >
            Spara
          </Button>
          <Button
            onClick={clearAllAssignments}
            disabled={loading}
            variant="destructive"
            className="w-1/3"
          >
            Rensa
          </Button>
        </div>
      )}
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

      {/* Dialog för medarbetarinformation */}
      <Dialog open={!!selectedEmployee} onOpenChange={() => setSelectedEmployee(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {selectedEmployee?.name}
            </DialogTitle>
            <DialogDescription>
              Välj vilka stationer {selectedEmployee?.name} kan arbeta på
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Skift</Label>
              <Badge variant="outline" className="text-sm">
                {selectedEmployee?.shift}
              </Badge>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Stationer</Label>
              <div className="grid gap-3">
                {STATIONS.map((station) => (
                  <div key={station} className="flex items-center justify-between space-x-3">
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id={`employee-station-${station}`}
                        checked={employeeStations.includes(station)}
                        onCheckedChange={() => toggleStation(station)}
                      />
                      <label
                        htmlFor={`employee-station-${station}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {station}
                      </label>
                    </div>
                    {stationStats[station] && (
                      <Badge variant="secondary" className="text-xs">
                        {stationStats[station]} gånger
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {recentWork.length > 0 && (
              <div className="space-y-2 pt-4 border-t">
                <Label className="text-sm font-medium">Senaste 5 stationerna</Label>
                <div className="space-y-2">
                  {recentWork.map((work, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 rounded-lg bg-secondary/30">
                      <span className="text-sm font-medium">{work.station}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(work.work_date).toLocaleDateString('sv-SE')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Object.keys(stationStats).length > 0 && (
              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  Statistik visar antal arbetspass de senaste 6 månaderna
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setSelectedEmployee(null)}>
              Stäng
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DailyPlanning;
