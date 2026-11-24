import { useEffect, useState } from 'preact/hooks';
import { t } from '~/lib/i18n';
import { Button } from '~/ui';

export interface AutoActionCountdownProps {
  label: string;
  seconds: number;
  onExecute: () => void;
  onCancel: () => void;
}

export function AutoActionCountdown({
  label,
  seconds,
  onExecute,
  onCancel,
}: AutoActionCountdownProps) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    setRemaining(seconds);
    const id = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(id);
          onExecute();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [seconds, onExecute]);

  return (
    <div class="player-countdown" role="region" aria-live="polite">
      <div>
        <div style={{ fontWeight: 700, fontSize: '13.5px' }}>
          {label} ({remaining}s)
        </div>
      </div>
      <Button variant="primary" onClick={onExecute}>
        {t('player.skipNow')}
      </Button>
      <Button variant="glass" onClick={onCancel}>
        {t('player.cancel')}
      </Button>
    </div>
  );
}
