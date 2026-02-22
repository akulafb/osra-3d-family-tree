import React from 'react';

interface ViewModeToggleProps {
  mode: '3D' | '2D';
  onModeChange: (mode: '3D' | '2D') => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const ViewModeToggle: React.FC<ViewModeToggleProps> = ({
  mode,
  onModeChange,
  isOpen,
  onToggle,
}) => {
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onToggle}
        style={{
          padding: '8px 16px',
          backgroundColor: mode === '3D' ? '#3b82f6' : '#8b5cf6',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          transition: 'all 0.2s ease',
        }}
        title={mode === '3D' ? '3D Space View' : '2D Tree View'}
      >
        {mode === '3D' ? '🌌 3D' : '🌳 2D'}
        <span style={{ fontSize: '0.7rem' }}>▾</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            backgroundColor: 'rgba(30, 30, 40, 0.98)',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
            minWidth: '180px',
            zIndex: 100,
            overflow: 'hidden',
            animation: 'fadeIn 0.15s ease',
          }}
        >
          {/* View Mode Section */}
          <div style={sectionStyle}>View Mode</div>

          <button
            onClick={() => {
              onModeChange('3D');
              onToggle();
            }}
            style={menuItemStyle(mode === '3D')}
          >
            <span style={{ marginRight: '8px' }}>🌌</span>
            3D Space View
            {mode === '3D' && <span style={checkmarkStyle}>✓</span>}
          </button>

          <button
            onClick={() => {
              onModeChange('2D');
            }}
            style={menuItemStyle(mode === '2D')}
          >
            <span style={{ marginRight: '8px' }}>🌳</span>
            2D Tree View
            {mode === '2D' && <span style={checkmarkStyle}>✓</span>}
          </button>

        </div>
      )}
    </div>
  );
};

const sectionStyle: React.CSSProperties = {
  padding: '10px 16px 6px',
  fontSize: '0.65rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '1px',
  color: '#888',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  marginBottom: '4px',
};

const menuItemStyle = (isActive: boolean): React.CSSProperties => ({
  padding: '10px 16px',
  backgroundColor: isActive ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
  color: isActive ? '#60a5fa' : '#e5e7eb',
  border: 'none',
  cursor: 'pointer',
  fontSize: '0.85rem',
  textAlign: 'left',
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  transition: 'all 0.15s ease',
});

const checkmarkStyle: React.CSSProperties = {
  marginLeft: 'auto',
  color: '#60a5fa',
  fontWeight: 700,
};

export default ViewModeToggle;
