import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings } from "lucide-react";

interface Employee {
  id: string;
  name: string;
  shift: string;
  is_active?: boolean;
}

interface RecentWork {
  station: string;
  work_date: string;
}

interface EmployeeDetailsDialogProps {
  employee: Employee | null;
  onOpenChange: (open: boolean) => void;
  employeeStations: string[];
  stationStats: { [station: string]: number };
  recentWork: RecentWork[];
  stations: string[];
  onToggleStation: (station: string) => void;
}

export const EmployeeDetailsDialog = ({
  employee,
  onOpenChange,
  employeeStations,
  stationStats,
  recentWork,
  stations,
  onToggleStation,
}: EmployeeDetailsDialogProps) => {
  return (
    <Dialog open={!!employee} onOpenChange={() => onOpenChange(false)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {employee?.name}
          </DialogTitle>
          <div className="space-y-2">
          <Label className="text-sm font-medium">Status</Label>
       <Badge 
        variant="outline" 
        className={`text-sm ml-2 ${Boolean(employee?.is_active) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
        {Boolean(employee?.is_active) ? 'Aktiv' : 'Inaktiv'}
       </Badge>
          </div>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Skift</Label>
            <Badge variant="outline" className="text-sm ml-2">
              {employee?.shift}
            </Badge>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Stationer</Label>
            <div className="grid gap-3">
              {stations.map((station) => (
                <div key={station} className="flex items-center justify-between space-x-3">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id={`employee-station-${station}`}
                      checked={employeeStations.includes(station)}
                      onCheckedChange={() => onToggleStation(station)}
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
          <Button onClick={() => onOpenChange(false)}>
            Stäng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};