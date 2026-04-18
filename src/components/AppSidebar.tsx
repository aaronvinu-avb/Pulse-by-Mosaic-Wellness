import {
  BarChart3,
  TrendingUp,
  Filter,
  CalendarRange,
  Wallet,
  DollarSign,
  Sun,
  Trophy,
  LayoutDashboard,
  Sliders,
  Activity,
  Stethoscope,
  Sparkles,
  HelpCircle,
  LineChart,
} from "lucide-react";
import { LumaLogo } from '@/components/LumaLogo';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";

// ── Nav definition ──────────────────────────────────────────────────────────

type NavItem = {
  title: string;
  url: string;
  icon: React.ElementType;
  indent?: boolean; // child page within a parent section
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: 'MEASUREMENT',
    items: [
      { title: 'Overview',                url: '/dashboard',  icon: LayoutDashboard },
      { title: 'Channel Performance',     url: '/channels',   icon: BarChart3 },
      { title: 'Traffic Quality Pipeline',url: '/funnel',     icon: Filter },
    ],
  },
  {
    label: 'STRATEGY',
    items: [
      { title: 'Scenario Planner', url: '/scenarios', icon: CalendarRange },
      { title: 'Budget Tracker',   url: '/budget',    icon: Wallet },
    ],
  },
  {
    label: 'MIX OPTIMISER',
    items: [
      { title: 'Current Mix',      url: '/optimizer/current-mix', icon: Sliders,       indent: true },
      { title: 'Diagnosis',        url: '/optimizer/diagnosis',   icon: Stethoscope,   indent: true },
      { title: 'Recommended Mix',  url: '/optimizer/recommended', icon: Sparkles,      indent: true },
      { title: 'Why It Works',     url: '/optimizer/why',         icon: HelpCircle,    indent: true },
      { title: 'Budget Scenarios', url: '/optimizer/scenarios',   icon: LineChart,     indent: true },
    ],
  },
  {
    label: 'INTELLIGENCE',
    items: [
      { title: 'Financial Insights', url: '/financials',   icon: DollarSign },
      { title: 'Trend Analysis',     url: '/trends',       icon: TrendingUp },
      { title: 'Daily Digest',       url: '/daily-digest', icon: Sun },
      { title: 'Best Days',          url: '/best-days',    icon: Trophy },
    ],
  },
];

// ── Component ───────────────────────────────────────────────────────────────

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();

  return (
    <Sidebar className="border-r-0 w-64 shadow-2xl">
      <SidebarContent style={{ backgroundColor: 'var(--bg-root)', borderRight: '1px solid var(--border-subtle)' }}>
        <SidebarHeader className="p-5 pb-2 text-[var(--text-primary)]">
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', overflow: 'hidden' }}>
            <LumaLogo scale={1.16} showWordmark={true} />
          </div>
          <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.02em', marginTop: 6, marginLeft: 44 }}>
            by Mosaic Wellness
          </p>
          <div style={{ borderBottom: '1px solid var(--border-subtle)', marginTop: 18 }} />
        </SidebarHeader>

        {navGroups.map((group) => (
          <SidebarGroup key={group.label} style={{ padding: '0 8px' }}>
            {!collapsed && (
              <p style={{
                fontFamily: 'Outfit', fontSize: 9, fontWeight: 600, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.1em',
                padding: '16px 12px 4px',
              }}>
                {group.label}
              </p>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = item.url === '/dashboard'
                    ? location.pathname === '/dashboard'
                    : location.pathname === item.url || location.pathname.startsWith(`${item.url}/`);

                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          end={item.url === '/'}
                          className="flex items-center gap-2.5 transition-all"
                          style={{
                            padding: item.indent ? '7px 12px 7px 24px' : '8px 12px',
                            borderRadius: 10,
                            backgroundColor: isActive ? 'var(--border-subtle)' : 'transparent',
                            color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                            fontSize: item.indent ? 12 : 13,
                            fontWeight: isActive ? 600 : 500,
                            transition: '140ms',
                          }}
                          activeClassName=""
                        >
                          <item.icon
                            style={{
                              width: item.indent ? 13 : 15,
                              height: item.indent ? 13 : 15,
                              flexShrink: 0,
                              color: isActive ? '#E8803A' : 'var(--text-secondary)',
                            }}
                          />
                          {!collapsed && (
                            <span className="flex items-center gap-2">
                              {item.title}
                            </span>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* Footer */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 20px',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: 'var(--bg-root)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'Outfit', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>MW</span>
          </div>
          <div>
            <p style={{ fontFamily: 'Outfit', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 }}>Admin User</p>
            <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>admin@mosaic.io</p>
          </div>
        </div>
        <ThemeToggle />
      </div>
    </Sidebar>
  );
}
