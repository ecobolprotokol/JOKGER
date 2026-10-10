import { useBlocker } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { strings } from '../strings/id';

export function useUnsavedChanges(isDirty: boolean): void {
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => isDirtyRef.current && currentLocation !== nextLocation,
  );

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm(strings.common.unsavedChanges)) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);
}
