// src/components/FamilyChat.tsx

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { useFamilyChat } from '../hooks/useFamilyChat';

export const FamilyChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const { messages, isLoading, error, sendMessage, clearChat } = useFamilyChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, isLoading]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const query = inputValue;
    setInputValue('');
    await sendMessage(query);
  };

  return (
    <div style={{ position: 'fixed', bottom: '20px', left: '20px', zIndex: 10000 }}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            style={{
              width: '400px',
              height: '500px',
              backgroundColor: '#1a1a1a',
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              border: '1px solid #333',
              display: 'flex',
              flexDirection: 'column',
              marginBottom: '15px',
              overflow: 'hidden'
            }}
          >
            {/* Header */}
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#2a2a2a',
              borderBottom: '1px solid #333',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }} >
              <div style={{ color: '#fff', fontWeight: 'bold' }}>Family Chat Bot</div>
              <button 
                onClick={clearChat}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#888',
                  cursor: 'pointer',
                  fontSize: '0.8rem'
                }}
              >
                Clear
              </button>
            </div>

            {/* Messages Area */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {messages.length === 0 && (
                <div style={{ color: '#666', textAlign: 'center', marginTop: '20px', fontSize: '0.9rem' }}>
                  Ask me anything about your family tree!
                </div>
              )}
              {messages.map((msg, idx) => (
                <div 
                  key={idx}
                  style={{
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    padding: '8px 12px',
                    borderRadius: '12px',
                    fontSize: '0.9rem',
                    lineHeight: '1.4',
                    backgroundColor: msg.role === 'user' ? '#3b82f6' : '#333',
                    color: '#fff',
                    borderBottomRightRadius: msg.role === 'user' ? '2px' : '12px',
                    borderBottomLeftRadius: msg.role === 'assistant' ? '2px' : '12px',
                  }}
                >
                  <ReactMarkdown 
                    components={{
                      p: ({children}) => <p style={{ margin: 0 }}>{children}</p>,
                      ul: ({children}) => <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>{children}</ul>,
                      ol: ({children}) => <ol style={{ margin: '8px 0', paddingLeft: '20px' }}>{children}</ol>,
                      li: ({children}) => <li style={{ marginBottom: '4px' }}>{children}</li>,
                      h3: ({children}) => <h3 style={{ fontSize: '1rem', margin: '12px 0 8px 0', color: '#3b82f6' }}>{children}</h3>,
                      strong: ({children}) => <strong style={{ color: '#fff', fontWeight: 'bold' }}>{children}</strong>
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              ))}
              {isLoading && (
                <div style={{ alignSelf: 'flex-start', padding: '8px 12px', backgroundColor: '#333', borderRadius: '12px', color: '#888', fontSize: '0.9rem' }}>
                  AI is thinking...
                </div>
              )}
              {error && (
                <div style={{ color: '#ef4444', fontSize: '0.8rem', textAlign: 'center', padding: '5px' }}>
                  Error: {error}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form 
              onSubmit={handleSend}
              style={{
                padding: '12px',
                backgroundColor: '#2a2a2a',
                borderTop: '1px solid #333',
                display: 'flex',
                gap: '8px'
              }}
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask about your family..."
                style={{
                  flex: 1,
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #444',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  color: '#fff',
                  outline: 'none'
                }}
              />
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  backgroundColor: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  cursor: isLoading ? 'default' : 'pointer',
                  opacity: isLoading ? 0.6 : 1,
                  fontWeight: 'bold'
                }}
              >
                Send
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '28px',
          backgroundColor: '#3b82f6',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontSize: '24px',
          float: 'left'
        }}
      >
        {isOpen ? '✕' : '🤖'}
      </motion.button>
    </div>
  );
};
