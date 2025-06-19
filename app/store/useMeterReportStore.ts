import { create } from 'zustand';
import { MeterReport } from '../api/meterApi';

interface MeterReportFilter {
  parameters: string[];
  startDate: Date;
  endDate: Date;
  title?: string;
}

interface MeterReportState {
  // Filter state
  filter: MeterReportFilter;
  // Reports history
  recentReports: MeterReport[];
  // Generated report state
  generatedReportId: string | null;
  isGenerating: boolean;
  
  // Actions
  setFilter: (filter: Partial<MeterReportFilter>) => void;
  resetFilter: () => void;
  setRecentReports: (reports: MeterReport[]) => void;
  addReport: (report: MeterReport) => void;
  setGeneratedReportId: (id: string | null) => void;
  setIsGenerating: (isGenerating: boolean) => void;
}

// Default filter: last 7 days, all parameters
const getDefaultFilter = (): MeterReportFilter => ({
  parameters: ['voltage', 'current', 'frequency', 'pf', 'energy', 'power'],
  startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  endDate: new Date()
});

export const useMeterReportStore = create<MeterReportState>((set) => ({
  // Initial state
  filter: getDefaultFilter(),
  recentReports: [],
  generatedReportId: null,
  isGenerating: false,
  
  // Actions
  setFilter: (filter) => set((state) => ({
    filter: { ...state.filter, ...filter }
  })),
  
  resetFilter: () => set({
    filter: getDefaultFilter()
  }),
  
  setRecentReports: (reports) => set({
    recentReports: reports
  }),
  
  addReport: (report) => set((state) => ({
    recentReports: [report, ...state.recentReports]
  })),
  
  setGeneratedReportId: (id) => set({
    generatedReportId: id
  }),
  
  setIsGenerating: (isGenerating) => set({
    isGenerating
  })
})); 