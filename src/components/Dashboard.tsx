import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Calendar, TrendingUp, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Stats {
  totalEmployees: number;
  activeEmployees: number;
  todayAssignments: number;
  stationsWithNeeds: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalEmployees: 0,
    activeEmployees: 0,
    todayAssignments: 0,
    stationsWithNeeds: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const today = new Date().toISOString().split("T")[0];

    // Get employee counts
    const { data: allEmployees } = await supabase
      .from("employees")
      .select("id, is_active");

    const totalEmployees = allEmployees?.length || 0;
    const activeEmployees =
      allEmployees?.filter((e) => e.is_active).length || 0;

    // Get today's assignments
    const { data: assignments } = await supabase
      .from("daily_assignments")
      .select("id")
      .eq("assigned_date", today);

    const todayAssignments = assignments?.length || 0;

    // Get stations with needs today
    const { data: needs } = await supabase
      .from("station_needs")
      .select("id")
      .eq("need_date", today)
      .gt("needed_count", 0);

    const stationsWithNeeds = needs?.length || 0;

    setStats({
      totalEmployees,
      activeEmployees,
      todayAssignments,
      stationsWithNeeds,
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-lg hover:shadow-xl transition-shadow border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Totalt medarbetare
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {stats.totalEmployees}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.activeEmployees} aktiva
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-lg hover:shadow-xl transition-shadow border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Dagens tilldelningar
            </CardTitle>
            <Calendar className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-accent">
              {stats.todayAssignments}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Medarbetare tilldelade
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-lg hover:shadow-xl transition-shadow border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Stationer med behov
            </CardTitle>
            <Activity className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">
              {stats.stationsWithNeeds}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              För idag
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-lg hover:shadow-xl transition-shadow border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <Badge
              className={
                stats.todayAssignments > 0
                  ? "bg-success text-success-foreground"
                  : "bg-muted text-muted-foreground"
              }
            >
              {stats.todayAssignments > 0 ? "Planerad" : "Inte planerad"}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">
              Dagens status
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg border-border/50">
        <CardHeader>
          <CardTitle>Välkommen till arbetsplatsplaneringen</CardTitle>
          <CardDescription>
            Hantera medarbetare och fördela dem till arbetsstationer effektivt
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Kom igång:</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Gå till <strong>Medarbetare</strong> och lägg till alla som jobbar på arbetsplatsen</li>
              <li>Gå till <strong>Dagsplanering</strong> och ange hur många som behövs på varje station</li>
              <li>Välj vilka som arbetar idag</li>
              <li>Klicka på "Fördela medarbetare" så fördelar systemet automatiskt baserat på historik</li>
              <li>FL-stationen kan du fylla i manuellt</li>
            </ol>
          </div>

          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
            <p className="text-sm text-foreground">
              <strong>Smart fördelning:</strong> Systemet kommer ihåg var varje person har arbetat de senaste 6 månaderna och ser till att fördela dem rättvist mellan stationerna.
            </p>
          </div>
        </CardContent>
      </Card>
      <div className="m-4">
        <p>Version 1.1.3</p>
        <p>Applikationen är under utveckling och kan innehålla buggar. Vid frågor och support, kontakta Erik Sandqvist.</p>
        <a className="underline" href="mailto:esandqvist04@gmail.com">esandqvist04@gmail.com</a>
      </div>
    </div>
  );
};

export default Dashboard;
