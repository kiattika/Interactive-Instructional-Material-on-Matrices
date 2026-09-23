import { createContext, useContext } from 'react';

// Lets a page (currently only TeacherPresentation's projector mode) ask AppLayout to drop its
// header/sidebar chrome and render the page edge to edge. AppLayout owns the state and resets it
// on every route change, so a page that forgets to clean up can never leak it elsewhere.
export interface PresentationChromeState {
  chromeHidden: boolean;
  setChromeHidden: (hidden: boolean) => void;
}

export const PresentationChromeContext = createContext<PresentationChromeState>({
  chromeHidden: false,
  setChromeHidden: () => {}
});

export function usePresentationChrome() {
  return useContext(PresentationChromeContext);
}
