import { supabase } from "@/integrations/supabase/client";

export interface EmployeeLastStation {
  employeeId: string;
  lastStation: string | null;
}

/**
 * Fetches the last assigned station for each employee from daily_assignments
 */
export const getEmployeesLastStations = async (employeeIds: string[]): Promise<Map<string, string | null>> => {
  const lastStationsMap = new Map<string, string | null>();
  
  // Initialize all employees with null (no previous assignment)
  employeeIds.forEach(id => lastStationsMap.set(id, null));
  
  if (employeeIds.length === 0) return lastStationsMap;
  
  // Get the most recent assignment for each employee
  const { data } = await supabase
    .from("daily_assignments")
    .select("employee_id, station, assigned_date")
    .in("employee_id", employeeIds)
    .order("assigned_date", { ascending: false });
  
  if (data) {
    // Group by employee and get the most recent one
    const seenEmployees = new Set<string>();
    data.forEach((assignment) => {
      if (!seenEmployees.has(assignment.employee_id)) {
        lastStationsMap.set(assignment.employee_id, assignment.station);
        seenEmployees.add(assignment.employee_id);
      }
    });
  }
  
  return lastStationsMap;
};

/**
 * Checks if an employee can be assigned to a station (not the same as last time)
 */
export const canAssignToStation = (
  employeeId: string,
  station: string,
  lastStationsMap: Map<string, string | null>
): boolean => {
  const lastStation = lastStationsMap.get(employeeId);
  
  // If no previous assignment, they can be assigned anywhere
  if (!lastStation) return true;
  
  // Cannot be assigned to the same station as last time
  return lastStation !== station;
};

/**
 * Gets available stations for an employee (excludes their last station)
 */
export const getAvailableStationsForEmployee = (
  employeeId: string,
  allStations: string[],
  lastStationsMap: Map<string, string | null>
): string[] => {
  const lastStation = lastStationsMap.get(employeeId);
  
  if (!lastStation) return allStations;
  
  return allStations.filter(station => station !== lastStation);
};
