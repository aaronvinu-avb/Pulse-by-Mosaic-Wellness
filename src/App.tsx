import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/Layout";
import { LandingPage } from "@/components/LandingPage";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppProvider } from "@/contexts/AppContext";
import Overview from "@/pages/Overview";
import ChannelPerformance from "@/pages/ChannelPerformance";
import MixOptimizer from "@/pages/MixOptimizer";
import TrendAnalysis from "@/pages/TrendAnalysis";
import ScenarioPlanner from "@/pages/ScenarioPlanner";
import FunnelAnalysis from "@/pages/FunnelAnalysis";
import FinancialInsights from "@/pages/FinancialInsights";
import DailyDigest from "@/pages/DailyDigest";
import BudgetTracker from "@/pages/BudgetTracker";
import BestDays from "@/pages/BestDays";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppProvider>
        <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/dashboard"
            element={
              <Layout>
                <Overview />
              </Layout>
            }
          />
          <Route path="/channels" element={<Layout><ChannelPerformance /></Layout>} />
          <Route path="/optimizer" element={<Layout><MixOptimizer /></Layout>} />
          <Route path="/trends" element={<Layout><TrendAnalysis /></Layout>} />
          <Route path="/scenarios" element={<Layout><ScenarioPlanner /></Layout>} />
          <Route path="/funnel" element={<Layout><FunnelAnalysis /></Layout>} />
          <Route path="/financials" element={<Layout><FinancialInsights /></Layout>} />
          <Route path="/daily-digest" element={<Layout><DailyDigest /></Layout>} />
          <Route path="/budget" element={<Layout><BudgetTracker /></Layout>} />
          <Route path="/best-days" element={<Layout><BestDays /></Layout>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
  </ThemeProvider>
);

export default App;
