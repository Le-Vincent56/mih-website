// The Projects view (wheel or grid) the visitor last chose, kept for this page load so the
// section reopens in it after visiting a project page.

export type ProjectsView = 'wheel' | 'grid';

let last: ProjectsView = 'wheel';

export const rememberedView = (): ProjectsView => last;

export function rememberView(view: ProjectsView): void {
  last = view;
}
