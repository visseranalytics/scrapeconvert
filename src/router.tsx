import { createBrowserRouter } from 'react-router-dom';
import { Layout } from '@/shared/components';
import { HomePage } from '@/features/home';
import { ConverterPage } from '@/features/converter';
import { ScraperPage, ScraperResultsPage } from '@/features/scraper';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'converter',
        element: <ConverterPage />,
      },
      {
        path: 'scraper',
        element: <ScraperPage />,
      },
      {
        path: 'scraper/results',
        element: <ScraperResultsPage />,
      },
    ],
  },
]);
