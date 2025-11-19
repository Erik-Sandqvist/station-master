-- Add lane column to daily_assignments table
ALTER TABLE public.daily_assignments 
ADD COLUMN lane integer;

-- Add lane column to work_history table for historical tracking
ALTER TABLE public.work_history 
ADD COLUMN lane integer;

-- Add index for better performance when querying by station and lane
CREATE INDEX idx_daily_assignments_station_lane ON public.daily_assignments(station, lane);
CREATE INDEX idx_work_history_station_lane ON public.work_history(station, lane);