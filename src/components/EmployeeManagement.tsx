import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, UserCheck, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  const [loading, setLoading] = useState(false);
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
          <UserCheck className="h-6 w-6 text-primary" />
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
              id="employee-name"
              placeholder="Ange namn..."
              value={newEmployeeName}
              onChange={(e) => setNewEmployeeName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addEmployee()}
            />
          </div>
          <div className="w-40 space-y-2">
            <Label htmlFor="employee-shift">Skift</Label>
            <Select value={newEmployeeShift} onValueChange={setNewEmployeeShift}>
              <SelectTrigger id="employee-shift">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Skift 1">Skift 1</SelectItem>
                <SelectItem value="Skift 2">Skift 2</SelectItem>
                <SelectItem value="Natt">Natt</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              onClick={addEmployee}
              disabled={loading}
              className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" />
              Lägg till
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">
            Alla medarbetare ({employees.length})
          </h3>
          <div className="grid gap-2">
            {employees.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Inga medarbetare än. Lägg till din första medarbetare ovan.
              </p>
            ) : (
              employees.map((employee) => (
                <Card
                  key={employee.id}
                  className="p-4 flex items-center justify-between hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{employee.name}</span>
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
    </Card>
  );
};

export default EmployeeManagement;
