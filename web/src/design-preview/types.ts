export type PageId = 'overview' | 'materials' | 'project' | 'projects' | 'login'
export type StyleId = 'carbon' | 'ibm' | 'sap' | 'notion' | 'stripe' | 'oura' | 'figma' | 'wired' | 'clay'
export interface Material { id: number; name: string; type: string; quantity: number; unit: string; factor: number; price: number }
