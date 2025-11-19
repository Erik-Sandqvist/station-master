import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import { sv } from "date-fns/locale";

interface Assignment {
  employee_name: string;
  station: string;
  lane: number | null;
  assigned_date: string;
}

const HistoryView = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadWeekAssignments();
  }, [currentWeek]);

  const loadWeekAssignments = async () => {
    setLoading(true);
    const weekStart = format(startOfWeek(currentWeek, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const weekEnd = format(endOfWeek(currentWeek, { weekStartsOn: 1 }), "yyyy-MM-dd");

    const { data } = await supabase
      .from("daily_assignments")
      .select(`
        assigned_date,
        station,
        lane,
        employees(name)
      `)
      .gte("assigned_date", weekStart)
      .lte("assigned_date", weekEnd)
      .order("assigned_date", { ascending: true });

    if (data) {
      const formatted = data.map((item: any) => ({
        employee_name: item.employees?.name || "Okänd",
        station: item.station,
        lane: item.lane,
        assigned_date: item.assigned_date,
      }));
      setAssignments(formatted);
    }
    setLoading(false);
  };

  const getAssignmentsByDate = (date: string) => {
    return assignments.filter((a) => a.assigned_date === date);
  };

  const getWeekDates = () => {
    const start = startOfWeek(currentWeek, { weekStartsOn: 1 });
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const groupByStation = (assignments: Assignment[]) => {
    const grouped: Record<string, Assignment[]> = {};
    assignments.forEach((assignment) => {
      if (!grouped[assignment.station]) {
        grouped[assignment.station] = [];
      }
      grouped[assignment.station].push(assignment);
    });
    return grouped;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Historik - Fördelningar
              </CardTitle>
              <CardDescription>
                Vecka {format(currentWeek, "w", { locale: sv })} -{" "}
                {format(startOfWeek(currentWeek, { weekStartsOn: 1 }), "d MMM", { locale: sv })} till{" "}
                {format(endOfWeek(currentWeek, { weekStartsOn: 1 }), "d MMM yyyy", { locale: sv })}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => setCurrentWeek(new Date())}>
                Idag
              </Button>
              <Button variant="outline" size="icon" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Laddar...</div>
          ) : (
            <div className="space-y-6">
              {getWeekDates().map((date) => {
                const dateStr = format(date, "yyyy-MM-dd");
                const dayAssignments = getAssignmentsByDate(dateStr);
                const stationGroups = groupByStation(dayAssignments);

                return (
                  <Card key={dateStr} className="bg-muted/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">
                        {format(date, "EEEE d MMMM", { locale: sv })}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {dayAssignments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Inga fördelningar denna dag</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {Object.entries(stationGroups).map(([station, assignments]) => (
                            <div key={station} className="space-y-2">
                              <h4 className="font-semibold text-sm text-foreground">{station}</h4>
                              <div className="flex flex-wrap gap-2">
                                {assignments.map((assignment, idx) => (
                                  <Badge
                                    key={idx}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {assignment.employee_name}
                                    {assignment.lane && ` (Bana ${assignment.lane})`}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HistoryView;
