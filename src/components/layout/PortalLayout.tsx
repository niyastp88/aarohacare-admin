import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { NotificationBell } from './NotificationBell';
import { IconHome } from './icons';
import { LayoutProvider, useLayout } from '@/contexts/LayoutContext';

const PortalLayoutContent = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isFullScreen, toggleFullScreen, setIsFullScreen } = useLayout();

  return (
    <div className="admin-shell min-h-screen bg-[#EEF1F7] text-[15.5px] font-medium leading-relaxed text-[#0f172a]">
      <div className="flex min-h-screen">
        {!isFullScreen ? (
          <div className="hidden lg:block">
            <div className="sticky top-0 h-screen border-r border-[#E5EAF0] bg-[#F8FAFC]">
              <AdminSidebar />
            </div>
          </div>
        ) : null}

        {!isFullScreen && mobileOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-[#061526]/45"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
            />
            <div className="relative z-10 h-full w-[248px] bg-[#F8FAFC] shadow-2xl">
              <AdminSidebar onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          {!isFullScreen ? (
            <header className="flex items-center justify-between border-b border-[#E5EAF0] bg-white px-4 py-3 lg:hidden">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-[#D7DEE7] px-3 py-2 text-sm font-semibold text-[#1A1F36]"
                onClick={() => setMobileOpen(true)}
              >
                <IconHome />
                Menu
              </button>
              <span className="text-sm font-bold text-[#1A1F36]">Aarohcare</span>
              <NotificationBell />
            </header>
          ) : null}

          <main className={isFullScreen ? 'flex-1 px-4 py-4 sm:px-6 sm:py-6' : 'flex-1 px-5 py-6 sm:px-8 lg:px-10 lg:py-9'}>
            <Outlet context={{ isFullScreen, toggleFullScreen, setIsFullScreen }} />
          </main>
        </div>
      </div>
    </div>
  );
};

export const PortalLayout = () => {
  return (
    <LayoutProvider>
      <PortalLayoutContent />
    </LayoutProvider>
  );
};
