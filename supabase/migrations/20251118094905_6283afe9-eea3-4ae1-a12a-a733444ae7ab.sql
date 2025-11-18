-- Create employees table
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

-- Create work_history table to track where employees worked
CREATE TABLE public.work_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  station TEXT NOT NULL,
  work_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create daily_assignments table for current day's assignments
CREATE TABLE public.daily_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  station TEXT NOT NULL,
  assigned_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(employee_id, assigned_date)
);

-- Create station_needs table to store daily needs per station
CREATE TABLE public.station_needs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station TEXT NOT NULL,
  needed_count INTEGER NOT NULL DEFAULT 0,
  need_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(station, need_date)
);

-- Enable Row Level Security
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.station_needs ENABLE ROW LEVEL SECURITY;

-- Create policies (public access for now, can be restricted later)
CREATE POLICY "Allow all access to employees" ON public.employees FOR ALL USING (true);
CREATE POLICY "Allow all access to work_history" ON public.work_history FOR ALL USING (true);
CREATE POLICY "Allow all access to daily_assignments" ON public.daily_assignments FOR ALL USING (true);
CREATE POLICY "Allow all access to station_needs" ON public.station_needs FOR ALL USING (true);

-- Create indexes for performance
CREATE INDEX idx_work_history_employee ON public.work_history(employee_id);
CREATE INDEX idx_work_history_date ON public.work_history(work_date);
CREATE INDEX idx_daily_assignments_date ON public.daily_assignments(assigned_date);
CREATE INDEX idx_station_needs_date ON public.station_needs(need_date);