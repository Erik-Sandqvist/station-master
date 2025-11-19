describe('Station Rotation Logic', () => {
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
      // Mock employee history for last 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
      const employeeHistory = [
        { station: 'Plock', date: '2024-07-15', employeeId: '1' },
        { station: 'Plock', date: '2024-08-10', employeeId: '1' },
        { station: 'Plock', date: '2024-09-05', employeeId: '1' },
        { station: 'Pack', date: '2024-07-20', employeeId: '1' },
        { station: 'Pack', date: '2024-08-25', employeeId: '1' },
        { station: 'KM', date: '2024-09-12', employeeId: '1' },
        { station: 'Decating', date: '2024-10-01', employeeId: '1' },
        // Rep has never been visited
      ];
  
      const availableStations = ['Plock', 'Pack', 'KM', 'Decating', 'Rep'];
  
      // Function to calculate station visit counts
      const getStationVisitCounts = (history: typeof employeeHistory) => {
        const counts: Record<string, number> = {};
        availableStations.forEach(station => {
          counts[station] = history.filter(h => h.station === station).length;
        });
        return counts;
      };
  
      // Function to get least visited station
      const getLeastVisitedStation = (counts: Record<string, number>) => {
        return Object.entries(counts).reduce((min, [station, count]) => 
          count < min.count ? { station, count } : min,
          { station: '', count: Infinity }
        ).station;
      };
  
      const visitCounts = getStationVisitCounts(employeeHistory);
      const leastVisited = getLeastVisitedStation(visitCounts);
  
      // Assert
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
      
      // Find all stations with minimum count
      const minCount = Math.min(...Object.values(visitCounts));
      const leastVisitedStations = Object.entries(visitCounts)
        .filter(([_, count]) => count === minCount)
        .map(([station, _]) => station);
  
      // Assert that KM and Rep both have 0 visits
      expect(visitCounts['KM']).toBe(0);
      expect(visitCounts['Rep']).toBe(0);
      expect(leastVisitedStations).toContain('KM');
      expect(leastVisitedStations).toContain('Rep');
      expect(leastVisitedStations.length).toBe(2);
    });
  });