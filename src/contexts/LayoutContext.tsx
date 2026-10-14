import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type LayoutContextValue = {
  isFullScreen: boolean;
  setIsFullScreen: (value: boolean | ((prev: boolean) => boolean)) => void;
  toggleFullScreen: () => void;
};

const LayoutContext = createContext<LayoutContextValue | undefined>(undefined);

export const LayoutProvider = ({ children }: { children: ReactNode }) => {
  const [isFullScreen, setIsFullScreen] = useState(false);

  const toggleFullScreen = useCallback(() => {
    setIsFullScreen((prev) => {
      const next = !prev;
      if (next) {
        if (typeof document !== 'undefined' && document.documentElement.requestFullscreen && !document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {
            // Ignore fullscreen permission rejections (e.g. iframe sandbox / user gesture restrictions)
          });
        }
      } else {
        if (typeof document !== 'undefined' && document.exitFullscreen && document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      }
      return next;
    });
  }, []);

  // Sync when user exits browser native fullscreen or presses Escape
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isFullScreen) {
        setIsFullScreen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullScreen]);

  return (
    <LayoutContext.Provider value={{ isFullScreen, setIsFullScreen, toggleFullScreen }}>
      {children}
    </LayoutContext.Provider>
  );
};

export const useLayout = (): LayoutContextValue => {
  const context = useContext(LayoutContext);
  if (!context) {
    return {
      isFullScreen: false,
      setIsFullScreen: () => {},
      toggleFullScreen: () => {},
    };
  }
  return context;
};
