import { useState, useEffect, useRef, useCallback } from 'react';

interface UseImageSequenceOptions {
  baseUrl: string;
  frameCount: number;
  criticalFrameCount?: number; // First N frames to load immediately
}

interface UseImageSequenceReturn {
  progress: number; // 0-100
  loadedFrames: Set<number>;
  isReady: boolean; // At least critical frames loaded
  getFrameUrl: (index: number) => string;
  preloadFrame: (index: number) => Promise<void>;
}

export function useImageSequence({
  baseUrl,
  frameCount,
  criticalFrameCount = 30,
}: UseImageSequenceOptions): UseImageSequenceReturn {
  const [progress, setProgress] = useState(0);
  const [loadedFrames, setLoadedFrames] = useState<Set<number>>(new Set());
  const [isReady, setIsReady] = useState(false);
  
  // In-memory cache for Image objects
  const frameCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const abortController = useRef<AbortController | null>(null);

  // Generate frame URL with zero-padding (001.png, 002.png, etc.)
  const getFrameUrl = useCallback((index: number): string => {
    const padded = String(index + 1).padStart(3, '0');
    return `${baseUrl}/${padded}.png`;
  }, [baseUrl]);

  // Preload a single frame
  const preloadFrame = useCallback((index: number): Promise<void> => {
    const url = getFrameUrl(index);
    
    // Return cached promise if already loading/loaded
    if (frameCache.current.has(url)) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const img = new Image();
      
      img.onload = () => {
        frameCache.current.set(url, img);
        setLoadedFrames(prev => {
          const next = new Set(prev);
          next.add(index);
          return next;
        });
        resolve();
      };
      
      img.onerror = () => {
        // Don't block on error - just resolve
        console.warn(`Failed to load frame ${index}: ${url}`);
        resolve();
      };

      // Check for abort
      if (abortController.current?.signal.aborted) {
        resolve();
        return;
      }

      img.src = url;
    });
  }, [getFrameUrl]);

  // Phase 1: Load critical frames immediately
  useEffect(() => {
    abortController.current = new AbortController();
    
    const loadCritical = async () => {
      const promises: Promise<void>[] = [];
      
      for (let i = 0; i < Math.min(criticalFrameCount, frameCount); i++) {
        promises.push(preloadFrame(i));
      }
      
      await Promise.all(promises);
      setIsReady(true);
    };

    loadCritical();

    return () => {
      abortController.current?.abort();
    };
  }, [criticalFrameCount, frameCount, preloadFrame]);

  // Phase 2: Load remaining frames progressively
  useEffect(() => {
    if (!isReady) return;

    const loadRemaining = async () => {
      for (let i = criticalFrameCount; i < frameCount; i++) {
        // Check for abort
        if (abortController.current?.signal.aborted) break;
        
        await preloadFrame(i);
        
        // Update progress
        const currentProgress = Math.round(((i + 1) / frameCount) * 100);
        setProgress(currentProgress);
        
        // Small delay to not block the main thread
        if (i % 5 === 0) {
          await new Promise(r => setTimeout(r, 10));
        }
      }
    };

    loadRemaining();
  }, [isReady, criticalFrameCount, frameCount, preloadFrame]);

  return {
    progress,
    loadedFrames,
    isReady,
    getFrameUrl,
    preloadFrame,
  };
}
