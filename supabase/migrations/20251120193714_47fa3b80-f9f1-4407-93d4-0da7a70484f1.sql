-- Lägg till en tabell för medarbetarnas stationskompetenser
CREATE TABLE IF NOT EXISTS public.employee_stations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  station TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id, station)
);

-- Enable RLS
ALTER TABLE public.employee_stations ENABLE ROW LEVEL SECURITY;

-- Tillåt alla att läsa och skriva (samma som andra tabeller)
CREATE POLICY "Allow all access to employee_stations" 
ON public.employee_stations 
FOR ALL 
USING (true);