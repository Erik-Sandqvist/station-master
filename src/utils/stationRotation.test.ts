import { canAssignToStation, getAvailableStationsForEmployee } from './stationRotation';

describe('Station Rotation Logic', () => {
  describe('canAssignToStation', () => {
    test('should return true when employee has no previous assignment', () => {
      const lastStationsMap = new Map<string, string | null>();
      lastStationsMap.set('emp1', null);
      
      expect(canAssignToStation('emp1', 'Plock', lastStationsMap)).toBe(true);
      expect(canAssignToStation('emp1', 'Pack', lastStationsMap)).toBe(true);
    });

    test('should return false when trying to assign to same station as last time', () => {
      const lastStationsMap = new Map<string, string | null>();
      lastStationsMap.set('emp1', 'Plock');
      
      expect(canAssignToStation('emp1', 'Plock', lastStationsMap)).toBe(false);
    });

    test('should return true when assigning to different station than last time', () => {
      const lastStationsMap = new Map<string, string | null>();
      lastStationsMap.set('emp1', 'Plock');
      
      expect(canAssignToStation('emp1', 'Pack', lastStationsMap)).toBe(true);
      expect(canAssignToStation('emp1', 'KM', lastStationsMap)).toBe(true);
    });

    test('should handle unknown employee (not in map)', () => {
      const lastStationsMap = new Map<string, string | null>();
      
      // Employee not in map should be allowed anywhere
      expect(canAssignToStation('unknown-emp', 'Plock', lastStationsMap)).toBe(true);
    });
  });

  describe('getAvailableStationsForEmployee', () => {
    const allStations = ['Plock', 'Pack', 'KM', 'Decating', 'Rep'];

    test('should return all stations when employee has no previous assignment', () => {
      const lastStationsMap = new Map<string, string | null>();
      lastStationsMap.set('emp1', null);
      
      const available = getAvailableStationsForEmployee('emp1', allStations, lastStationsMap);
      
      expect(available).toEqual(allStations);
      expect(available.length).toBe(5);
    });

    test('should exclude last station from available stations', () => {
      const lastStationsMap = new Map<string, string | null>();
      lastStationsMap.set('emp1', 'Plock');
      
      const available = getAvailableStationsForEmployee('emp1', allStations, lastStationsMap);
      
      expect(available).not.toContain('Plock');
      expect(available).toContain('Pack');
      expect(available).toContain('KM');
      expect(available.length).toBe(4);
    });

    test('should return all stations for unknown employee', () => {
      const lastStationsMap = new Map<string, string | null>();
      
      const available = getAvailableStationsForEmployee('unknown-emp', allStations, lastStationsMap);
      
      expect(available).toEqual(allStations);
    });
  });

  describe('Distribution scenarios', () => {
    test('should prevent consecutive assignment to same station', () => {
      // Simulate a distribution scenario
      const lastStationsMap = new Map<string, string | null>();
      lastStationsMap.set('emp1', 'Plock');
      lastStationsMap.set('emp2', 'Pack');
      lastStationsMap.set('emp3', 'KM');
      
      // emp1 was at Plock, so should NOT be able to go to Plock
      expect(canAssignToStation('emp1', 'Plock', lastStationsMap)).toBe(false);
      expect(canAssignToStation('emp1', 'Pack', lastStationsMap)).toBe(true);
      
      // emp2 was at Pack, so should NOT be able to go to Pack
      expect(canAssignToStation('emp2', 'Pack', lastStationsMap)).toBe(false);
      expect(canAssignToStation('emp2', 'Plock', lastStationsMap)).toBe(true);
      
      // emp3 was at KM, so should NOT be able to go to KM
      expect(canAssignToStation('emp3', 'KM', lastStationsMap)).toBe(false);
      expect(canAssignToStation('emp3', 'Decating', lastStationsMap)).toBe(true);
    });

    test('should handle multiple employees with same last station', () => {
      const lastStationsMap = new Map<string, string | null>();
      lastStationsMap.set('emp1', 'Plock');
      lastStationsMap.set('emp2', 'Plock');
      
      // Both were at Plock, neither should be able to go back
      expect(canAssignToStation('emp1', 'Plock', lastStationsMap)).toBe(false);
      expect(canAssignToStation('emp2', 'Plock', lastStationsMap)).toBe(false);
      
      // But they can go to other stations
      expect(canAssignToStation('emp1', 'Pack', lastStationsMap)).toBe(true);
      expect(canAssignToStation('emp2', 'Pack', lastStationsMap)).toBe(true);
    });
  });

  // Keep the old tests for station visit counting logic
  describe('Station Visit Counting (legacy)', () => {
    test('should detect if employee visited station recently', () => {
      const employeeHistory = [
        { station: 'Plock', date: '2024-01-15' },
        { station: 'Pack', date: '2024-01-16' },
        { station: 'Plock', date: '2024-01-17' },
      ];
      
      const recentVisit = employeeHistory.filter(h => h.station === 'Plock').length;
      expect(recentVisit).toBeGreaterThan(1);
    });
  
    test('should return true when employee has not visited station in last 5 days', () => {
      const lastVisit = 6; // days ago
      expect(lastVisit).toBeGreaterThan(5);
    });
  
    test('should assign employee to least visited station in last 6 months', () => {
      const employeeHistory = [
        { station: 'Plock', date: '2024-07-15', employeeId: '1' },
        { station: 'Plock', date: '2024-08-10', employeeId: '1' },
        { station: 'Plock', date: '2024-09-05', employeeId: '1' },
        { station: 'Pack', date: '2024-07-20', employeeId: '1' },
        { station: 'Pack', date: '2024-08-25', employeeId: '1' },
        { station: 'KM', date: '2024-09-12', employeeId: '1' },
        { station: 'Decating', date: '2024-10-01', employeeId: '1' },
      ];
  
      const availableStations = ['Plock', 'Pack', 'KM', 'Decating', 'Rep'];
  
      const getStationVisitCounts = (history: typeof employeeHistory) => {
        const counts: Record<string, number> = {};
        availableStations.forEach(station => {
          counts[station] = history.filter(h => h.station === station).length;
        });
        return counts;
      };
  
      const getLeastVisitedStation = (counts: Record<string, number>) => {
        return Object.entries(counts).reduce((min, [station, count]) => 
          count < min.count ? { station, count } : min,
          { station: '', count: Infinity }
        ).station;
      };
  
      const visitCounts = getStationVisitCounts(employeeHistory);
      const leastVisited = getLeastVisitedStation(visitCounts);
  
      expect(visitCounts['Plock']).toBe(3);
      expect(visitCounts['Pack']).toBe(2);
      expect(visitCounts['KM']).toBe(1);
      expect(visitCounts['Decating']).toBe(1);
      expect(visitCounts['Rep']).toBe(0);
      expect(leastVisited).toBe('Rep');
    });
  
    test('should handle tie-breaker when multiple stations have same visit count', () => {
      const employeeHistory = [
        { station: 'Plock', date: '2024-09-15', employeeId: '1' },
        { station: 'Pack', date: '2024-09-16', employeeId: '1' },
      ];
  
      const availableStations = ['Plock', 'Pack', 'KM', 'Rep'];
  
      const getStationVisitCounts = (history: typeof employeeHistory) => {
        const counts: Record<string, number> = {};
        availableStations.forEach(station => {
          counts[station] = history.filter(h => h.station === station).length;
        });
        return counts;
      };
  
      const visitCounts = getStationVisitCounts(employeeHistory);
      
      const minCount = Math.min(...Object.values(visitCounts));
      const leastVisitedStations = Object.entries(visitCounts)
        .filter(([_, count]) => count === minCount)
        .map(([station, _]) => station);
  
      expect(visitCounts['KM']).toBe(0);
      expect(visitCounts['Rep']).toBe(0);
      expect(leastVisitedStations).toContain('KM');
      expect(leastVisitedStations).toContain('Rep');
      expect(leastVisitedStations.length).toBe(2);
    });
  });
});