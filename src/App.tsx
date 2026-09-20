/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';

// Every route past the landing page is code-split: Dashboard is the only page guaranteed
// to be needed on first paint, and MatrixLab/TeacherPresentation alone are >1000 lines each.
const LearningPath = lazy(() => import('./pages/LearningPath'));
const LessonView = lazy(() => import('./pages/LessonView'));
const PrePostTest = lazy(() => import('./pages/PrePostTest'));
const MatrixLab = lazy(() => import('./pages/MatrixLab'));
const HigherOrderLab = lazy(() => import('./pages/HigherOrderLab'));
const Exercises = lazy(() => import('./pages/Exercises'));
const TeacherPresentation = lazy(() => import('./pages/TeacherPresentation'));
const TeacherAnalytics = lazy(() => import('./pages/TeacherAnalytics'));
const TeacherSettingsPage = lazy(() => import('./pages/TeacherSettingsPage'));

function RouteFallback() {
  return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm font-bold">
      กำลังโหลด...
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/learning" element={<LearningPath />} />
            <Route path="/learning/lesson/:id" element={<LessonView />} />
            <Route path="/diagnostic" element={<PrePostTest />} />
            <Route path="/lab" element={<MatrixLab />} />
            <Route path="/higher-order-lab" element={<HigherOrderLab />} />
            <Route path="/exercises" element={<Exercises />} />
            <Route path="/presentation" element={<TeacherPresentation />} />
            <Route path="/teacher/analytics" element={<TeacherAnalytics />} />
            <Route path="/teacher/settings" element={<TeacherSettingsPage />} />
          </Routes>
        </Suspense>
      </AppLayout>
    </BrowserRouter>
  );
}
