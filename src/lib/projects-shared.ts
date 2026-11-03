// Small helpers about projects that the browser can use too (src/lib/projects.ts is server-only).
export const projectTitle = (p: { name: string | null; account_name: string; project_type: string }) => p.name || `${p.project_type} · ${p.account_name}`;
