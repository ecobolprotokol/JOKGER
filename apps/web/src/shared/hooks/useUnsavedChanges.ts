import { useBlocker } from 'react-router-dom';
import { useEffect, useRef } from 'react';

export function useUnsavedChanges(isDirty: boolean): void {
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => isDirtyRef.current && currentLocation !== nextLocation,
  );

  useEffect(() => {
    if (blocker.state === 'blocked') {
      const handleBeforeUnload = (event: BeforeUnloadEvent) => {
        event.preventDefault();
        event.returnValue = '';
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [blocker.state]);

  useEffect(() => {
    if (blocker.state === 'blocked') {
      blocker.proceed();
    }
  }, [blocker]);
}
