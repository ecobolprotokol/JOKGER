import { RouterProvider } from 'react-router-dom';
import { AppProviders } from './providers';
import { router } from './router';
import { strings } from '../shared/strings/id';

export function App() {
  return (
    <AppProviders>
      <a className="skip-link" href="#main-content">
        {strings.common.skipToContent}
      </a>
      <div id="main-content">
        <RouterProvider router={router} />
      </div>
    </AppProviders>
  );
}
