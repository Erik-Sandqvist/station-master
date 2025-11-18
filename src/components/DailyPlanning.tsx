import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Users, Shuffle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Employee {
  id: string;
  name: string;
}

interface StationNeed {
  station: string;
  count: number;
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

const DailyPlanning = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [stationNeeds, setStationNeeds] = useState<Record<string, number>>({});
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [flManual, setFlManual] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchEmployees();
    loadTodayNeeds();
    loadTodayAssignments();
  }, []);

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from("employees")
      .select("id, name")
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {employees.map((employee) => (
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

      {Object.keys(assignments).length > 0 && (
        <Card className="shadow-lg border-border/50">
          <CardHeader>
            <CardTitle>Dagens tilldelningar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {STATIONS.map((station) => {
                const assigned = assignments[station] || [];
                if (assigned.length === 0 && station !== "FL") return null;

                return (
                  <Card key={station} className="p-4 bg-secondary/30">
                    <h3 className="font-semibold text-lg mb-2 text-primary">
                      {station}
                    </h3>
                    {station === "FL" ? (
                      <p className="text-sm">{flManual || "Ingen tilldelad"}</p>
                    ) : (
                      <ul className="space-y-1">
                        {assigned.map((empId, idx) => (
                          <li key={idx} className="text-sm">
                            • {getEmployeeName(empId)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DailyPlanning;
