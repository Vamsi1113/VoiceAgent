import { useEffect, useRef } from 'react';
import styles from './MessageList.module.css';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface Props {
  messages: Message[];
  isThinking: boolean;
}

export default function MessageList({ messages, isThinking }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  return (
    <div className={styles.list}>
      {messages.map((msg) => {
        if (msg.role === 'system') {
          return (
            <div key={msg.id} className={styles.system}>
              {msg.content}
            </div>
          );
        }
        return (
          <div key={msg.id} className={`${styles.row} ${styles[msg.role]}`}>
            <div className={styles.bubble}>
              {msg.content || (msg.role === 'assistant' ? <span className={styles.cursor}>▋</span> : '')}
            </div>
          </div>
        );
      })}
      {isThinking && (
        <div className={`${styles.row} ${styles.assistant}`}>
          <div className={`${styles.bubble} ${styles.thinking}`}>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

