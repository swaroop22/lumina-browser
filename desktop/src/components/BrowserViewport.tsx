import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import {
  ShieldCheck,
  RotateCw,
  ExternalLink,
  Bot,
  User,
  Pause,
  Play,
  Square,
  Lock,
  Maximize2,
  Sliders,
} from 'lucide-react';
import { Mascot } from './Mascot';

const REAL_CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

export interface BrowserViewportHandle {
  reload: () => void;
  goBack: () => void;
  goForward: () => void;
}

interface BrowserViewportProps {
  currentUrl: string;
  onUrlChange: (url: string) => void;
  onTitleChange?: (title: string) => void;
  activeTaskStatus?: string;
  currentStepDescription?: string;
  isUserInControl?: boolean;
  onTakeControl?: () => void;
  onHandBackToMuse?: () => void;
  onStopTask?: () => void;
  onReload?: () => void;
}

export const BrowserViewport = forwardRef<BrowserViewportHandle, BrowserViewportProps>(({
  currentUrl,
  onUrlChange,
  onTitleChange,
  activeTaskStatus,
  currentStepDescription,
  isUserInControl = false,
  onTakeControl,
  onHandBackToMuse,
  onStopTask,
  onReload,
}, ref) => {
  const [isLoading, setIsLoading] = useState(false);
  const webviewRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isDomReadyRef = useRef<boolean>(false);

  const isAgentActive = activeTaskStatus === 'running' || activeTaskStatus === 'planning';
  const isWaitingApproval = activeTaskStatus === 'waiting_for_approval';
  const isPaused = activeTaskStatus === 'paused';

  // Support Electron <webview> if running in Electron environment
  const isElectron = typeof window !== 'undefined' && Boolean((window as any).luminaDesktop);

  // Expose imperative methods to parent (App.tsx)
  useImperativeHandle(ref, () => ({
    reload: () => {
      const wv = webviewRef.current;
      if (wv && typeof wv.reload === 'function') {
        wv.reload();
      } else if (iframeRef.current) {
        iframeRef.current.src = currentUrl;
      }
    },
    goBack: () => {
      const wv = webviewRef.current;
      if (wv && typeof wv.canGoBack === 'function' && wv.canGoBack()) {
        wv.goBack();
      }
    },
    goForward: () => {
      const wv = webviewRef.current;
      if (wv && typeof wv.canGoForward === 'function' && wv.canGoForward()) {
        wv.goForward();
      }
    },
  }));

  function normalizeUrl(url?: string): string {
    if (!url) return '';
    return url.trim().replace(/\/+$/, '').toLowerCase();
  }

  const internalNavRef = useRef<boolean>(false);

  // Synchronize webview navigation whenever currentUrl prop updates
  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv || !currentUrl || currentUrl.startsWith('about:') || currentUrl.includes('blocked')) return;

    if (internalNavRef.current) {
      internalNavRef.current = false;
      return;
    }

    const currentLoaded = typeof wv.getURL === 'function' ? wv.getURL() : '';
    if (normalizeUrl(currentLoaded) === normalizeUrl(currentUrl)) {
      return;
    }

    try {
      if (typeof wv.loadURL === 'function' && isDomReadyRef.current) {
        wv.loadURL(currentUrl).catch(() => {});
      } else if (wv.src !== currentUrl) {
        wv.src = currentUrl;
      }
    } catch (err) {
      console.error('Webview load error:', err);
    }
  }, [currentUrl]);

  // Attach webview lifecycle and navigation events
  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) return;

    const handleDomReady = () => {
      isDomReadyRef.current = true;
      const currentLoaded = typeof wv.getURL === 'function' ? wv.getURL() : '';
      if (currentUrl && normalizeUrl(currentLoaded) !== normalizeUrl(currentUrl)) {
        try {
          wv.loadURL(currentUrl).catch(() => {});
        } catch (e) {}
      }
    };

    const handleDidNavigate = (e: any) => {
      if (
        e.url &&
        !e.url.startsWith('about:') &&
        !e.url.includes('blocked') &&
        (e.url.startsWith('http://') || e.url.startsWith('https://')) &&
        onUrlChange
      ) {
        internalNavRef.current = true;
        onUrlChange(e.url);
      }
    };

    const handlePageTitle = (e: any) => {
      if (e.title && onTitleChange) {
        onTitleChange(e.title);
      }
    };

    const handleStartLoading = () => setIsLoading(true);
    const handleStopLoading = () => setIsLoading(false);
    const handleFailLoad = () => setIsLoading(false);

    try {
      wv.addEventListener('dom-ready', handleDomReady);
      wv.addEventListener('did-navigate', handleDidNavigate);
      wv.addEventListener('did-navigate-in-page', handleDidNavigate);
      wv.addEventListener('page-title-updated', handlePageTitle);
      wv.addEventListener('did-start-loading', handleStartLoading);
      wv.addEventListener('did-stop-loading', handleStopLoading);
      wv.addEventListener('did-fail-load', handleFailLoad);
    } catch (e) {}

    return () => {
      try {
        wv.removeEventListener('dom-ready', handleDomReady);
        wv.removeEventListener('did-navigate', handleDidNavigate);
        wv.removeEventListener('did-navigate-in-page', handleDidNavigate);
        wv.removeEventListener('page-title-updated', handlePageTitle);
        wv.removeEventListener('did-start-loading', handleStartLoading);
        wv.removeEventListener('did-stop-loading', handleStopLoading);
        wv.removeEventListener('did-fail-load', handleFailLoad);
      } catch (e) {}
    };
  }, [onUrlChange, onTitleChange, currentUrl]);

  const handleManualReload = () => {
    const wv = webviewRef.current;
    if (wv && typeof wv.reload === 'function') {
      wv.reload();
    }
    if (onReload) onReload();
  };

  return (
    <div className="muse-viewport-container">
      {/* 1. Secure VM Top Banner */}
      <div className="muse-vm-header">
        <div className="muse-vm-badge-group">
          <div className="muse-vm-tag">
            <Lock size={12} color="#059669" />
            <span>Lumina SI Secure VM</span>
          </div>
          <span className="muse-vm-sep">/</span>
          <span className="muse-vm-detail">Sandboxed Chromium Session</span>
          <span className="muse-vm-sep">/</span>
          <span className="muse-vm-vault">🔒 Vault Credentials Protected</span>
        </div>

        <div className="muse-vm-tools">
          <button
            className="muse-vm-btn"
            onClick={handleManualReload}
            title="Reload Page"
          >
            <RotateCw size={13} />
          </button>
          <button
            className="muse-vm-btn"
            onClick={() => window.open(currentUrl, '_blank')}
            title="Open In External Browser"
          >
            <ExternalLink size={13} />
          </button>
        </div>
      </div>

      {/* 2. Floating Live Overseer Bar */}
      {(isAgentActive || isPaused || isUserInControl || isWaitingApproval) && (
        <div className={`muse-overseer-bar ${isUserInControl ? 'manual-mode' : isWaitingApproval ? 'approval-mode' : 'agent-mode'}`}>
          <div className="muse-overseer-left">
            {isUserInControl ? (
              <>
                <div className="muse-overseer-dot manual" />
                <User size={15} color="#0284c7" />
                <span className="muse-overseer-title">Manual Control Active</span>
                <span className="muse-overseer-sub">(Lumina SI is paused waiting for you)</span>
              </>
            ) : isWaitingApproval ? (
              <>
                <div className="muse-overseer-dot approval" />
                <Mascot mood="waiting_for_approval" size={20} showHalo={false} />
                <span className="muse-overseer-title">Consequential Action Paused</span>
                <span className="muse-overseer-sub">Approval needed to proceed</span>
              </>
            ) : (
              <>
                <div className="muse-overseer-dot agent" />
                <Mascot mood="browsing" size={20} showHalo={false} />
                <span className="muse-overseer-title">Lumina SI is browsing</span>
                <span className="muse-overseer-sub">
                  {currentStepDescription || 'Autonomous action in progress...'}
                </span>
              </>
            )}
          </div>

          <div className="muse-overseer-actions">
            {!isUserInControl && isAgentActive && onTakeControl && (
              <button
                className="muse-overseer-btn take-control"
                onClick={onTakeControl}
                title="Pause Lumina SI and take direct mouse/keyboard control"
              >
                <Pause size={12} /> Take Control
              </button>
            )}

            {(isUserInControl || isPaused) && onHandBackToMuse && (
              <button
                className="muse-overseer-btn hand-back"
                onClick={onHandBackToMuse}
                title="Hand control back to Lumina SI to resume autonomous execution"
              >
                <Play size={12} /> Hand Back to Lumina SI
              </button>
            )}

            {onStopTask && (isAgentActive || isPaused || isUserInControl) && (
              <button
                className="muse-overseer-btn stop"
                onClick={onStopTask}
                title="Emergency Halt"
              >
                <Square size={12} /> Stop
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. Interactive Web Viewport */}
      <div className="muse-viewport-frame">
        {isElectron ? (
          <webview
            ref={webviewRef}
            src={currentUrl || 'http://127.0.0.1:8765/test-site/laptops'}
            className="muse-native-webview"
            allowpopups
            partition="persist:lumina_vault"
            useragent={REAL_CHROME_UA}
          />
        ) : (
          <iframe
            ref={iframeRef}
            src={currentUrl || 'http://127.0.0.1:8765/test-site/laptops'}
            title="Lumina SI Browser Viewport"
            className="muse-frame"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            onLoad={() => setIsLoading(false)}
          />
        )}

        {/* Loading Progress Bar */}
        {isLoading && <div className="muse-viewport-loader" />}
      </div>
    </div>
  );
});
