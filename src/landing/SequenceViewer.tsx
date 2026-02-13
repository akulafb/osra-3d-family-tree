import { useRef, useEffect, useState, useCallback } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { useImageSequence } from '../hooks/useImageSequence';

interface SequenceViewerProps {
  frameCount?: number;
  baseUrl?: string;
  onFrameChange?: (frameIndex: number) => void;
}

export function SequenceViewer({
  frameCount = 100,
  baseUrl = '/frames',
  onFrameChange,
}: SequenceViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [showPreloader, setShowPreloader] = useState(true);
  const [debugInfo, setDebugInfo] = useState({ scrollProgress: 0, frameIndexValue: 0 });
  
  const { progress, isReady, getFrameUrl } = useImageSequence({
    baseUrl,
    frameCount,
    criticalFrameCount: 30,
  });

  // Scroll progress linked to frame index
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Map scroll progress (0-1) to frame index (0-99)
  const frameIndexValue = useTransform(scrollYProgress, [0, 1], [0, frameCount - 1]);

  // Update current frame when scroll changes - using onChange callback to avoid closure issues
  const updateFrame = useCallback((latest: number) => {
    const newFrame = Math.floor(latest);
    setCurrentFrame(prev => {
      if (newFrame !== prev) {
        onFrameChange?.(newFrame);
        return newFrame;
      }
      return prev;
    });
  }, [onFrameChange]);

  // Subscribe to scroll changes
  useEffect(() => {
    const unsubscribe = frameIndexValue.on('change', (latest) => {
      updateFrame(latest);
      setDebugInfo({
        scrollProgress: scrollYProgress.get(),
        frameIndexValue: latest,
      });
    });
    return unsubscribe;
  }, [frameIndexValue, scrollYProgress, updateFrame]);

  // Hide preloader when critical frames are ready
  useEffect(() => {
    if (isReady) {
      const timer = setTimeout(() => setShowPreloader(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isReady]);

  const currentFrameUrl = getFrameUrl(currentFrame);

  return (
    <div
      ref={containerRef}
      style={{
        height: '400vh', // 4x viewport height for scroll distance
        position: 'relative',
      }}
    >
      {/* Sticky container for the sequence */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          height: '100vh',
          width: '100%',
          overflow: 'hidden',
          background: '#000',
        }}
      >
        {/* Preloader overlay */}
        {showPreloader && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: isReady ? 0 : 1 }}
            transition={{ duration: 0.5 }}
            style={{
              position: 'absolute',
              inset: 0,
              background: '#000',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 20,
              color: '#fff',
            }}
          >
            <div style={{ fontSize: '1.2rem', marginBottom: '20px' }}>
              Preparing your journey...
            </div>
            <div
              style={{
                width: '200px',
                height: '4px',
                background: 'rgba(255,255,255,0.2)',
                borderRadius: '2px',
                overflow: 'hidden',
              }}
            >
              <motion.div
                style={{
                  height: '100%',
                  background: '#667eea',
                }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
              />
            </div>
            <div style={{ marginTop: '10px', fontSize: '0.9rem', color: '#888' }}>
              {progress}%
            </div>
            {!isReady && (
              <div style={{ marginTop: '20px', fontSize: '0.8rem', color: '#666' }}>
                Loading critical frames...
              </div>
            )}
          </motion.div>
        )}

        {/* Current frame */}
        <motion.img
          key={currentFrame}
          src={currentFrameUrl}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            willChange: 'transform',
          }}
          initial={{ opacity: 0.8 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.05 }}
        />

        {/* Frame counter and debug info */}
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            color: 'rgba(255,255,255,0.5)',
            fontSize: '0.7rem',
            fontFamily: 'monospace',
            textAlign: 'right',
            background: 'rgba(0,0,0,0.5)',
            padding: '8px 12px',
            borderRadius: '4px',
          }}
        >
          Frame: {String(currentFrame + 1).padStart(3, '0')} / {frameCount}
          <br />
          Scroll: {(debugInfo.scrollProgress * 100).toFixed(1)}%
          <br />
          Value: {debugInfo.frameIndexValue.toFixed(1)}
        </div>
      </div>
    </div>
  );
}
